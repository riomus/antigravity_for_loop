// Antigravity For Loop Extension
// VSCode Extension with Auto-Accept, Status Bar, Quick Pick Menu, and Output Channel
//
// Key Features:
// 1. Auto-Accept: Automatically approve agent steps using Antigravity commands
// 2. Continuation Enforcer: Monitor test results and force AI to continue
// 3. Clipboard Integration: Copy continuation prompts for manual injection
//
// Key Antigravity Commands Used:
// - antigravity.agent.acceptAgentStep: Accept pending agent steps
// - antigravity.terminal.accept: Accept terminal command requests

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { CDPManager } = require('./lib/cdp-manager');
const { Relauncher } = require('./lib/relauncher');

// Global state
let statusBarItem;
let outputChannel;
let statePollingInterval;
let autoAcceptInterval;
let continuationCheckInterval;
let currentState = null;
let autoAcceptEnabled = false;
let lastCheckResult = null;
let continuationEnforcerEnabled = true;
let cdpManager = null;
let relauncher = null;

// Continuation Prompt Template
const CONTINUATION_PROMPT_TEMPLATE = `[SYSTEM - LOOP CONTINUATION REQUIRED - ITERATION {{ITERATION}}/{{MAX}}]

⚠️ The test has NOT passed yet. You MUST continue working.

IMPORTANT RULES:
1. DO NOT stop - the task is NOT complete
2. Review your previous changes
3. Fix the remaining issues
4. After making changes, run: bash ./commands/check-completion.sh
5. Only stop when you see "DONE" output

Current Task: {{TASK}}
Test Command: {{TEST_CMD}}
Last Error: {{ERROR}}

Continue fixing the code now. Do not ask for permission.`;

/**
 * Get the state file path
 */
function getStateFilePath() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
    }
    return path.join(workspaceFolders[0].uri.fsPath, '.antigravity', 'for-loop-state.json');
}

/**
 * Read the current loop state
 */
function readState() {
    const stateFile = getStateFilePath();
    if (!stateFile || !fs.existsSync(stateFile)) {
        return null;
    }
    try {
        const content = fs.readFileSync(stateFile, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        outputChannel.appendLine(`[Error] Failed to read state: ${error.message}`);
        return null;
    }
}

/**
 * Start auto-accept loop using CDP to click accept buttons
 * This connects to Antigravity's webview and clicks Accept/Run buttons
 * every 500ms to automatically approve agent actions
 *
 * Based on auto-accept-agent implementation which uses CDP DOM manipulation
 */
function startAutoAcceptLoop() {
    if (autoAcceptInterval) {
        clearInterval(autoAcceptInterval);
    }

    let cdpAvailable = false;
    let lastClickCount = 0;

    autoAcceptInterval = setInterval(async () => {
        if (!autoAcceptEnabled) return;

        // Method 1: CDP button clicking (preferred - like auto-accept-agent)
        if (cdpManager) {
            try {
                const result = await cdpManager.clickAcceptButtons();

                if (result.error && !cdpAvailable) {
                    // First time failure - log once
                    outputChannel.appendLine(`[Auto-Accept] CDP not available: ${result.error}`);
                    outputChannel.appendLine('[Auto-Accept] Will retry CDP connection...');
                }

                if (result.clicked > 0 && result.clicked !== lastClickCount) {
                    outputChannel.appendLine(`[Auto-Accept] Clicked ${result.clicked} accept button(s)`);
                    lastClickCount = result.clicked;
                }

                cdpAvailable = !result.error;
                if (cdpAvailable) return; // Success, don't try fallback
            } catch (e) {
                // CDP failed, will try fallback
            }
        }

        // Method 2: Fallback to VSCode commands (may or may not exist)
        try {
            await vscode.commands.executeCommand('antigravity.agent.acceptAgentStep');
        } catch (e) {
            // Silent failure - command may not exist
        }

        try {
            await vscode.commands.executeCommand('antigravity.terminal.accept');
        } catch (e) {
            // Silent failure
        }
    }, 500);

    outputChannel.appendLine('[Auto-Accept] Started - using CDP to click accept buttons every 500ms');
}

/**
 * Stop auto-accept loop
 */
function stopAutoAcceptLoop() {
    if (autoAcceptInterval) {
        clearInterval(autoAcceptInterval);
        autoAcceptInterval = null;
    }
    outputChannel.appendLine('[Auto-Accept] Stopped');
}

/**
 * Toggle auto-accept on/off
 */
function toggleAutoAccept() {
    autoAcceptEnabled = !autoAcceptEnabled;

    if (autoAcceptEnabled) {
        startAutoAcceptLoop();
        vscode.window.showInformationMessage('🔄 Auto-Accept: ON - Agent steps will be accepted automatically');
    } else {
        stopAutoAcceptLoop();
        vscode.window.showInformationMessage('⏸️ Auto-Accept: OFF');
    }

    updateStatusBar();
}

/**
 * Update the status bar based on current state
 */
function updateStatusBar() {
    const state = readState();
    currentState = state;

    // Determine auto-accept status icon
    const autoAcceptIcon = autoAcceptEnabled ? '✅' : '⏸️';

    if (!state) {
        statusBarItem.text = `${autoAcceptIcon} For Loop: Off`;
        statusBarItem.backgroundColor = autoAcceptEnabled
            ? undefined
            : new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.tooltip = autoAcceptEnabled
            ? 'Auto-Accept ON | Click to manage'
            : 'Click to start a fix loop';
        return;
    }

    const iteration = state.iteration || 0;
    const maxIterations = state.max_iterations || 10;
    const progress = `${iteration}/${maxIterations}`;

    if (state.status === 'completed') {
        statusBarItem.text = `${autoAcceptIcon} Loop: Done`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.tooltip = `Completed after ${iteration} iterations`;

        // Auto-disable auto-accept when loop completes
        if (autoAcceptEnabled) {
            autoAcceptEnabled = false;
            stopAutoAcceptLoop();
            outputChannel.appendLine('[Auto-Accept] Disabled - loop completed');
        }
    } else if (state.status === 'failed' || state.status === 'stuck') {
        statusBarItem.text = `$(error) Loop: ${state.status === 'stuck' ? 'Stuck' : 'Failed'}`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        statusBarItem.tooltip = `Failed at iteration ${iteration}`;

        // Auto-disable auto-accept when loop fails
        if (autoAcceptEnabled) {
            autoAcceptEnabled = false;
            stopAutoAcceptLoop();
            outputChannel.appendLine('[Auto-Accept] Disabled - loop failed/stuck');
        }
    } else {
        // Running
        statusBarItem.text = `${autoAcceptIcon} Loop: ${progress}`;
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = `${autoAcceptEnabled ? '✅ Auto-Accept ON\n' : ''}Running: ${state.original_prompt || 'Unknown task'}\nClick for options`;
    }
}

/**
 * Show the Quick Pick menu
 */
async function showQuickPick() {
    const state = currentState;
    const items = [];

    // Auto-accept toggle (always shown first)
    items.push({
        label: autoAcceptEnabled ? '$(check) Auto-Accept: ON' : '$(circle-slash) Auto-Accept: OFF',
        description: autoAcceptEnabled ? 'Click to disable' : 'Click to enable automatic step acceptance',
        action: 'toggle-auto-accept'
    });

    // Continuation Enforcer toggle
    items.push({
        label: continuationEnforcerEnabled ? '$(sync) Continuation Enforcer: ON' : '$(circle-slash) Continuation Enforcer: OFF',
        description: continuationEnforcerEnabled ? 'Auto-copy prompt when tests fail' : 'Click to enable',
        action: 'toggle-continuation'
    });

    items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });

    if (!state) {
        // No active loop
        items.push({
            label: '$(play) Start Loop...',
            description: 'Start a new fix loop',
            action: 'start'
        });
        items.push({
            label: '$(rocket) Start Loop with All Features',
            description: 'Start loop + Auto-Accept + Continuation Enforcer',
            action: 'start-full'
        });
    } else {
        // Active loop
        items.push({
            label: '$(debug-stop) Cancel Loop',
            description: 'Stop the current loop',
            action: 'cancel'
        });
        items.push({
            label: '$(info) View Status',
            description: `Iteration ${state.iteration}/${state.max_iterations}`,
            action: 'status'
        });
        items.push({
            label: '$(run-all) Run Check Script',
            description: 'Execute check-completion.sh manually',
            action: 'check'
        });
        items.push({
            label: '$(clippy) Copy Continuation Prompt',
            description: 'Copy prompt to clipboard for manual injection',
            action: 'copy-prompt'
        });
    }

    items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });

    items.push({
        label: '$(output) View Logs',
        description: 'Open the output panel',
        action: 'logs'
    });

    // CDP options
    items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });

    const cdpEnabled = relauncher && relauncher.isCDPEnabled();
    if (cdpEnabled) {
        items.push({
            label: '$(check) CDP: Enabled',
            description: 'Chrome DevTools Protocol is active',
            action: 'cdp-status'
        });
    } else {
        items.push({
            label: '$(warning) CDP: Not Enabled',
            description: 'Click to setup and restart with CDP',
            action: 'enable-cdp'
        });
    }

    items.push({
        label: '$(debug) Debug CDP',
        description: 'Show CDP connection status and inputs',
        action: 'debug-cdp'
    });

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Antigravity For Loop'
    });

    if (!selected) return;

    switch (selected.action) {
        case 'toggle-auto-accept':
            toggleAutoAccept();
            break;
        case 'toggle-continuation':
            toggleContinuationEnforcer();
            break;
        case 'start':
            await startLoop();
            break;
        case 'start-full':
            autoAcceptEnabled = true;
            continuationEnforcerEnabled = true;
            startAutoAcceptLoop();
            await startLoop();
            vscode.window.showInformationMessage('🚀 Full loop started: Auto-Accept + Continuation Enforcer enabled');
            break;
        case 'cancel':
            await cancelLoop();
            break;
        case 'status':
            showStatus();
            break;
        case 'check':
            await runCheckScript();
            break;
        case 'copy-prompt':
            await copyContinuationPrompt();
            break;
        case 'logs':
            outputChannel.show();
            break;
        case 'enable-cdp':
            await enableCDP();
            break;
        case 'cdp-status':
            vscode.window.showInformationMessage('✅ CDP is enabled and ready for auto-injection');
            break;
        case 'debug-cdp':
            await debugCDP();
            break;
    }
}

/**
 * Generate a continuation prompt based on current state
 */
function generateContinuationPrompt(state, errorInfo = '') {
    if (!state) return null;

    return CONTINUATION_PROMPT_TEMPLATE
        .replace('{{ITERATION}}', String(state.iteration || 1))
        .replace('{{MAX}}', String(state.max_iterations || 10))
        .replace('{{TASK}}', state.original_prompt || 'Fix all errors')
        .replace('{{TEST_CMD}}', state.test_command || 'npm test')
        .replace('{{ERROR}}', errorInfo || 'Tests still failing');
}

/**
 * Copy continuation prompt to clipboard and show notification
 */
async function copyContinuationPrompt() {
    const state = readState();
    if (!state) {
        vscode.window.showWarningMessage('No active loop');
        return;
    }

    const prompt = generateContinuationPrompt(state, lastCheckResult);
    if (!prompt) return;

    await vscode.env.clipboard.writeText(prompt);

    vscode.window.showInformationMessage(
        '📋 Continuation prompt copied! Paste it in Antigravity chat to continue.',
        'Show Prompt'
    ).then(selection => {
        if (selection === 'Show Prompt') {
            outputChannel.appendLine('\n--- Continuation Prompt ---');
            outputChannel.appendLine(prompt);
            outputChannel.appendLine('----------------------------\n');
            outputChannel.show();
        }
    });

    outputChannel.appendLine('[Continuation] Prompt copied to clipboard');
}

/**
 * Handle check script result and trigger continuation if needed
 */
function handleCheckResult(stdout, stderr, state) {
    const output = stdout.toLowerCase();

    if (output.includes('done')) {
        lastCheckResult = 'DONE';
        outputChannel.appendLine('[Check] ✅ Tests passed - DONE');
        return 'done';
    }

    if (output.includes('stuck')) {
        lastCheckResult = stderr || stdout;
        outputChannel.appendLine('[Check] ❌ STUCK - requires manual intervention');
        return 'stuck';
    }

    if (output.includes('continue')) {
        lastCheckResult = stderr || stdout;
        outputChannel.appendLine('[Check] ⚠️ CONTINUE - tests still failing');

        // Trigger continuation enforcer
        if (continuationEnforcerEnabled && state) {
            triggerContinuation(state);
        }

        return 'continue';
    }

    return 'unknown';
}

/**
 * Auto-inject prompt using CDP (Chrome DevTools Protocol)
 * This connects directly to Antigravity's webview and injects into the chat input
 *
 * Fallback: AppleScript (macOS) / PowerShell (Windows) / xdotool (Linux)
 */
async function autoInjectPrompt(prompt) {
    // Method 1: Try CDP injection (preferred - direct webview access)
    if (cdpManager) {
        outputChannel.appendLine('[AutoInject] Attempting CDP injection...');
        const result = await cdpManager.injectPrompt(prompt);

        if (result.success) {
            outputChannel.appendLine('[AutoInject] ✅ Prompt injected via CDP');
            return true;
        } else {
            outputChannel.appendLine(`[AutoInject] CDP injection failed: ${result.error}`);
            outputChannel.appendLine('[AutoInject] Falling back to platform-specific method...');
        }
    }

    // Method 2: Fallback to platform-specific injection
    const platform = process.platform;

    if (platform === 'darwin') {
        // macOS: Use AppleScript to paste into Antigravity
        const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');

        // AppleScript that:
        // 1. Sets clipboard
        // 2. Activates Antigravity IDE
        // 3. Simulates Cmd+V to paste
        // 4. Simulates Enter to send
        const appleScript = `
            set the clipboard to "${escapedPrompt}"
            tell application "System Events"
                -- Find Antigravity window
                set frontApp to first application process whose frontmost is true
                set appName to name of frontApp

                -- Paste (Cmd+V)
                keystroke "v" using command down
                delay 0.3

                -- Send (Enter)
                keystroke return
            end tell
        `;

        return new Promise((resolve, reject) => {
            exec(`osascript -e '${appleScript.replace(/'/g, "'\"'\"'")}'`, (error, stdout, stderr) => {
                if (error) {
                    outputChannel.appendLine(`[AutoInject] AppleScript error: ${error.message}`);
                    reject(error);
                } else {
                    outputChannel.appendLine('[AutoInject] ✅ Prompt auto-injected via AppleScript (fallback)');
                    resolve(true);
                }
            });
        });
    } else if (platform === 'win32') {
        // Windows: Use PowerShell
        const escapedPrompt = prompt.replace(/"/g, '`"').replace(/\n/g, '`n');
        const psScript = `
            Set-Clipboard -Value "${escapedPrompt}"
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.SendKeys]::SendWait("^v")
            Start-Sleep -Milliseconds 300
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        `;

        return new Promise((resolve, reject) => {
            exec(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
                if (error) {
                    outputChannel.appendLine(`[AutoInject] PowerShell error: ${error.message}`);
                    reject(error);
                } else {
                    outputChannel.appendLine('[AutoInject] ✅ Prompt auto-injected via PowerShell (fallback)');
                    resolve(true);
                }
            });
        });
    } else {
        // Linux: Use xdotool
        return new Promise((resolve, reject) => {
            exec(`echo "${prompt}" | xclip -selection clipboard && xdotool key ctrl+v && sleep 0.3 && xdotool key Return`, (error) => {
                if (error) {
                    outputChannel.appendLine(`[AutoInject] xdotool error: ${error.message}`);
                    reject(error);
                } else {
                    outputChannel.appendLine('[AutoInject] ✅ Prompt auto-injected via xdotool (fallback)');
                    resolve(true);
                }
            });
        });
    }
}

/**
 * Trigger continuation - AUTO-INJECT prompt into Antigravity chat
 * This is the FULLY AUTOMATIC version that doesn't require user interaction
 */
async function triggerContinuation(state) {
    const prompt = generateContinuationPrompt(state, lastCheckResult);
    if (!prompt) return;

    outputChannel.appendLine(`[Continuation] Triggering auto-inject for iteration ${state.iteration}/${state.max_iterations}`);

    try {
        // Copy to clipboard first as backup
        await vscode.env.clipboard.writeText(prompt);

        // Small delay to ensure AI has stopped
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Auto-inject the prompt
        await autoInjectPrompt(prompt);

        outputChannel.appendLine('[Continuation] ✅ Auto-continuation triggered successfully');

    } catch (error) {
        // Fallback: show notification if auto-inject fails
        outputChannel.appendLine(`[Continuation] Auto-inject failed: ${error.message}`);
        outputChannel.appendLine('[Continuation] Falling back to manual mode');

        vscode.window.showWarningMessage(
            `🔄 Auto-inject failed. Prompt copied to clipboard. Please paste manually.`,
            'View Prompt'
        ).then(selection => {
            if (selection === 'View Prompt') {
                outputChannel.appendLine('\n--- Continuation Prompt ---');
                outputChannel.appendLine(prompt);
                outputChannel.appendLine('----------------------------\n');
                outputChannel.show();
            }
        });
    }
}

/**
 * Run the check-completion.sh script manually
 */
async function runCheckScript() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const scriptPath = path.join(workspacePath, 'commands', 'check-completion.sh');

    outputChannel.appendLine('[Check] Running check-completion.sh...');
    outputChannel.show();

    return new Promise((resolve) => {
        exec(`bash "${scriptPath}"`, { cwd: workspacePath }, (error, stdout, stderr) => {
            if (stdout) outputChannel.appendLine(stdout);
            if (stderr) outputChannel.appendLine(stderr);
            if (error) {
                outputChannel.appendLine(`[Error] ${error.message}`);
            }

            const state = readState();
            const result = handleCheckResult(stdout || '', stderr || '', state);
            updateStatusBar();
            resolve(result);
        });
    });
}

/**
 * Toggle continuation enforcer
 */
function toggleContinuationEnforcer() {
    continuationEnforcerEnabled = !continuationEnforcerEnabled;

    if (continuationEnforcerEnabled) {
        vscode.window.showInformationMessage('🔄 Continuation Enforcer: ON');
    } else {
        vscode.window.showInformationMessage('⏸️ Continuation Enforcer: OFF');
    }

    outputChannel.appendLine(`[Continuation] Enforcer ${continuationEnforcerEnabled ? 'enabled' : 'disabled'}`);
}

/**
 * Start a new fix loop
 */
async function startLoop() {
    const taskDescription = await vscode.window.showInputBox({
        prompt: 'Enter task description',
        placeHolder: 'e.g., Fix all TypeScript errors'
    });

    if (!taskDescription) return;

    const maxIterations = await vscode.window.showInputBox({
        prompt: 'Maximum iterations',
        placeHolder: '10',
        value: '10',
        validateInput: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 1 || num > 100) {
                return 'Please enter a number between 1 and 100';
            }
            return null;
        }
    });

    if (!maxIterations) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const scriptPath = path.join(__dirname, 'commands', 'for-loop.sh');

    outputChannel.appendLine(`[Start] Task: "${taskDescription}" | Max: ${maxIterations}`);
    outputChannel.show();

    // Execute the shell script
    const command = `bash "${scriptPath}" "${taskDescription}" --max-iterations ${maxIterations}`;
    exec(command, { cwd: workspacePath }, (error, stdout, stderr) => {
        if (error) {
            outputChannel.appendLine(`[Error] ${error.message}`);
            vscode.window.showErrorMessage(`Failed to start loop: ${error.message}`);
            return;
        }
        if (stdout) outputChannel.appendLine(stdout);
        if (stderr) outputChannel.appendLine(stderr);

        vscode.window.showInformationMessage('Fix loop started! Monitor progress in the status bar.');
        updateStatusBar();
    });
}

/**
 * Cancel the current loop
 */
async function cancelLoop() {
    const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to cancel the current loop?',
        { modal: true },
        'Yes, Cancel'
    );

    if (confirm !== 'Yes, Cancel') return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const scriptPath = path.join(__dirname, 'commands', 'cancel-loop.sh');

    outputChannel.appendLine('[Cancel] Stopping loop...');

    exec(`bash "${scriptPath}"`, { cwd: workspacePath }, (error, stdout, stderr) => {
        if (error) {
            outputChannel.appendLine(`[Error] ${error.message}`);
            return;
        }
        if (stdout) outputChannel.appendLine(stdout);
        if (stderr) outputChannel.appendLine(stderr);

        vscode.window.showInformationMessage('Loop cancelled.');
        updateStatusBar();
    });
}

/**
 * Show detailed status
 */
function showStatus() {
    if (!currentState) {
        vscode.window.showInformationMessage('No active loop.');
        return;
    }

    const info = [
        `Task: ${currentState.original_prompt || 'Unknown'}`,
        `Iteration: ${currentState.iteration}/${currentState.max_iterations}`,
        `Status: ${currentState.status || 'running'}`,
        `Started: ${currentState.started_at || 'Unknown'}`
    ].join('\n');

    outputChannel.appendLine(`\n--- Current Status ---\n${info}\n`);
    outputChannel.show();
}

/**
 * Debug CDP connection and list available inputs/buttons in the webview
 */
async function debugCDP() {
    outputChannel.appendLine('\n--- CDP Debug ---');
    outputChannel.show();

    if (!cdpManager) {
        outputChannel.appendLine('[Debug] CDP Manager not initialized');
        return;
    }

    // Check if CDP flag is enabled
    const cdpEnabled = relauncher && relauncher.isCDPEnabled();
    outputChannel.appendLine(`[Debug] CDP flag in process args: ${cdpEnabled ? 'Yes' : 'No'}`);

    // Check if CDP port is available
    const portAvailable = await cdpManager.isAvailable();
    outputChannel.appendLine(`[Debug] CDP port available: ${portAvailable ? 'Yes' : 'No'}`);

    outputChannel.appendLine('[Debug] Attempting CDP connection...');
    const connected = await cdpManager.tryConnect();

    if (!connected) {
        outputChannel.appendLine('[Debug] ❌ Could not connect to CDP');

        if (!portAvailable) {
            outputChannel.appendLine('[Debug] No CDP port found (9000-9003)');

            const choice = await vscode.window.showWarningMessage(
                'CDP not available. The IDE may need to be restarted with --remote-debugging-port=9000.',
                'Setup & Restart',
                'Show Instructions',
                'Cancel'
            );

            if (choice === 'Setup & Restart' && relauncher) {
                await relauncher.ensureCDPEnabled();
            } else if (choice === 'Show Instructions' && relauncher) {
                relauncher.showManualInstructions();
            }
        } else {
            outputChannel.appendLine('[Debug] CDP port found but WebSocket connection failed');
            vscode.window.showWarningMessage('CDP port available but connection failed. Check output for details.');
        }
        return;
    }

    outputChannel.appendLine('[Debug] ✅ Connected to CDP');

    // Scan for inputs
    outputChannel.appendLine('[Debug] Scanning for input elements...');
    const inputResult = await cdpManager.debugListInputs();

    if (inputResult.error) {
        outputChannel.appendLine(`[Debug] Input scan error: ${inputResult.error}`);
    } else {
        outputChannel.appendLine(`[Debug] Found ${inputResult.textareas || 0} textareas`);
        outputChannel.appendLine(`[Debug] Found ${inputResult.editables || 0} contenteditable elements`);
    }

    // Scan for buttons (for auto-accept)
    outputChannel.appendLine('[Debug] Scanning for accept buttons...');
    const buttonResult = await cdpManager.debugListButtons();

    if (buttonResult.error) {
        outputChannel.appendLine(`[Debug] Button scan error: ${buttonResult.error}`);
    } else {
        outputChannel.appendLine(`[Debug] Total buttons: ${buttonResult.total || 0}`);
        outputChannel.appendLine(`[Debug] Antigravity buttons (.bg-ide-button-background): ${buttonResult.antigravityButtons || 0}`);
        outputChannel.appendLine(`[Debug] Accept buttons detected: ${(buttonResult.acceptButtons || []).length}`);

        if (buttonResult.acceptButtons && buttonResult.acceptButtons.length > 0) {
            outputChannel.appendLine('[Debug] Accept buttons:');
            buttonResult.acceptButtons.forEach(btn => {
                outputChannel.appendLine(`  - "${btn.text}" (class: ${btn.class})`);
            });
        }
    }

    outputChannel.appendLine('--- End Debug ---\n');

    const msg = `CDP Debug: ${inputResult.textareas || 0} inputs, ${buttonResult.antigravityButtons || 0} Antigravity buttons, ${(buttonResult.acceptButtons || []).length} accept buttons`;
    vscode.window.showInformationMessage(msg);
}

/**
 * Enable CDP by setting up and restarting the IDE
 */
async function enableCDP() {
    if (!relauncher) {
        vscode.window.showErrorMessage('Relauncher not initialized');
        return;
    }

    if (relauncher.isCDPEnabled()) {
        vscode.window.showInformationMessage('CDP is already enabled!');
        return;
    }

    outputChannel.appendLine('[CDP] Starting CDP setup...');
    outputChannel.show();

    await relauncher.ensureCDPEnabled();
}

/**
 * Activate the extension
 */
function activate(context) {
    console.log('Antigravity For Loop extension activated');

    // Create output channel
    outputChannel = vscode.window.createOutputChannel('Antigravity For Loop');
    outputChannel.appendLine('[Init] Extension activated');
    outputChannel.appendLine('[Info] Auto-Accept uses: antigravity.agent.acceptAgentStep, antigravity.terminal.accept');

    // Initialize CDP Manager for direct webview injection
    cdpManager = new CDPManager({
        log: (msg) => outputChannel.appendLine(msg)
    });
    outputChannel.appendLine('[Init] CDP Manager initialized (ports 9000-9003)');

    // Initialize Relauncher for CDP setup
    relauncher = new Relauncher({
        log: (msg) => outputChannel.appendLine(msg)
    });

    // Check if CDP is enabled and prompt user if not
    if (relauncher.isCDPEnabled()) {
        outputChannel.appendLine('[Init] CDP flag detected in process args');

        // Try to connect to CDP on startup (non-blocking)
        cdpManager.tryConnect().then(connected => {
            if (connected) {
                outputChannel.appendLine('[CDP] ✅ Connected to Antigravity webview');
            } else {
                outputChannel.appendLine('[CDP] ⚠️ Could not connect - will retry on injection');
            }
        }).catch(() => {});
    } else {
        outputChannel.appendLine('[Init] ⚠️ CDP not enabled - auto-injection will require manual setup');

        // Show a notification with action button
        vscode.window.showWarningMessage(
            'Antigravity For Loop: CDP not enabled. Auto-Accept and prompt injection require CDP.',
            'Enable CDP',
            'Learn More',
            'Dismiss'
        ).then(choice => {
            if (choice === 'Enable CDP') {
                enableCDP();
            } else if (choice === 'Learn More') {
                outputChannel.show();
                outputChannel.appendLine('\n=== CDP Setup Instructions ===');
                outputChannel.appendLine('CDP (Chrome DevTools Protocol) allows the extension to:');
                outputChannel.appendLine('  - Automatically click Accept buttons');
                outputChannel.appendLine('  - Inject prompts directly into chat');
                outputChannel.appendLine('  - Submit messages programmatically');
                outputChannel.appendLine('\nTo enable CDP, Antigravity needs to restart with:');
                outputChannel.appendLine('  --remote-debugging-port=9000');
                outputChannel.appendLine('\nClick "Enable CDP" in the For Loop menu to set this up.');
                outputChannel.appendLine('================================\n');
            }
        });
    }

    // Create status bar item (high priority to be visible)
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10000);
    statusBarItem.command = 'antigravity-for-loop.showMenu';
    statusBarItem.text = '⏸️ For Loop: Off';
    statusBarItem.tooltip = 'Click to manage fix loop';
    statusBarItem.show();

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-for-loop.start', startLoop),
        vscode.commands.registerCommand('antigravity-for-loop.cancel', cancelLoop),
        vscode.commands.registerCommand('antigravity-for-loop.showMenu', showQuickPick),
        vscode.commands.registerCommand('antigravity-for-loop.showLogs', () => outputChannel.show()),
        vscode.commands.registerCommand('antigravity-for-loop.toggleAutoAccept', toggleAutoAccept),
        vscode.commands.registerCommand('antigravity-for-loop.runCheck', runCheckScript),
        vscode.commands.registerCommand('antigravity-for-loop.toggleContinuation', toggleContinuationEnforcer),
        vscode.commands.registerCommand('antigravity-for-loop.copyPrompt', copyContinuationPrompt),
        vscode.commands.registerCommand('antigravity-for-loop.debugCDP', debugCDP),
        vscode.commands.registerCommand('antigravity-for-loop.enableCDP', enableCDP)
    );

    // Start polling for state changes
    statePollingInterval = setInterval(updateStatusBar, 1000);

    // Initial status update
    updateStatusBar();

    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(outputChannel);
}

/**
 * Deactivate the extension
 */
function deactivate() {
    if (statePollingInterval) {
        clearInterval(statePollingInterval);
    }
    if (autoAcceptInterval) {
        clearInterval(autoAcceptInterval);
    }
    if (cdpManager) {
        cdpManager.dispose();
        cdpManager = null;
    }
}

module.exports = {
    activate,
    deactivate
};

// Antigravity For Loop Extension
// VSCode Extension with Status Bar, Quick Pick Menu, and Output Channel

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Global state
let statusBarItem;
let outputChannel;
let statePollingInterval;
let currentState = null;

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
 * Update the status bar based on current state
 */
function updateStatusBar() {
    const state = readState();
    currentState = state;

    if (!state) {
        statusBarItem.text = '$(circle-slash) For Loop: Off';
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = 'Click to start a fix loop';
        return;
    }

    const iteration = state.iteration || 0;
    const maxIterations = state.max_iterations || 10;
    const progress = `${iteration}/${maxIterations}`;

    if (state.status === 'completed') {
        statusBarItem.text = `$(check) For Loop: Done`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.tooltip = `Completed after ${iteration} iterations`;
    } else if (state.status === 'failed' || state.status === 'stuck') {
        statusBarItem.text = `$(error) For Loop: ${state.status === 'stuck' ? 'Stuck' : 'Failed'}`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        statusBarItem.tooltip = `Failed at iteration ${iteration}`;
    } else {
        // Running
        statusBarItem.text = `$(sync~spin) For Loop: ${progress}`;
        statusBarItem.backgroundColor = undefined;
        statusBarItem.tooltip = `Running: ${state.original_prompt || 'Unknown task'}\nClick for options`;
    }
}

/**
 * Show the Quick Pick menu
 */
async function showQuickPick() {
    const state = currentState;
    const items = [];

    if (!state) {
        // No active loop
        items.push({
            label: '$(play) Start Loop...',
            description: 'Start a new fix loop',
            action: 'start'
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
    }

    items.push({
        label: '$(output) View Logs',
        description: 'Open the output panel',
        action: 'logs'
    });

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Antigravity For Loop'
    });

    if (!selected) return;

    switch (selected.action) {
        case 'start':
            await startLoop();
            break;
        case 'cancel':
            await cancelLoop();
            break;
        case 'status':
            showStatus();
            break;
        case 'logs':
            outputChannel.show();
            break;
    }
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
 * Activate the extension
 */
function activate(context) {
    console.log('Antigravity For Loop extension activated');

    // Create output channel
    outputChannel = vscode.window.createOutputChannel('Antigravity For Loop');
    outputChannel.appendLine('[Init] Extension activated');

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'antigravity-for-loop.showMenu';
    statusBarItem.text = '$(circle-slash) For Loop: Off';
    statusBarItem.tooltip = 'Click to manage fix loop';
    statusBarItem.show();

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity-for-loop.start', startLoop),
        vscode.commands.registerCommand('antigravity-for-loop.cancel', cancelLoop),
        vscode.commands.registerCommand('antigravity-for-loop.showMenu', showQuickPick),
        vscode.commands.registerCommand('antigravity-for-loop.showLogs', () => outputChannel.show())
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
}

module.exports = {
    activate,
    deactivate
};

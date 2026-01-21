const vscode = require('vscode');

class SidebarProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
        this._view = undefined;
    }

    resolveWebviewView(webviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,

            // Restrict the webview to only load resources from the `media` directory
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'startLoop': {
                    vscode.commands.executeCommand('antigravity-for-loop.start', data.options);
                    break;
                }
                case 'stopLoop': {
                    vscode.commands.executeCommand('antigravity-for-loop.cancel');
                    break;
                }
                case 'toggleContinuation': {
                    vscode.commands.executeCommand('antigravity-for-loop.toggleContinuation');
                    break;
                }
                case 'pauseLoop': {
                    vscode.commands.executeCommand('antigravity-for-loop.pause');
                    break;
                }
                case 'resumeLoop': {
                    vscode.commands.executeCommand('antigravity-for-loop.resume');
                    break;
                }
                case 'enableCDP': {
                    vscode.commands.executeCommand('antigravity-for-loop.enableCDP');
                    break;
                }
                case 'updatePrompt': {
                    vscode.commands.executeCommand('antigravity-for-loop.updatePrompt', data.prompt);
                    break;
                }
                case 'updatePreIterationPrompt': {
                    vscode.commands.executeCommand('antigravity-for-loop.updatePreIterationPrompt', data.prompt);
                    break;
                }
                case 'updatePreStartPrompt': {
                    vscode.commands.executeCommand('antigravity-for-loop.updatePreStartPrompt', data.prompt);
                    break;
                }
                case 'updatePostIterationPrompt': {
                    vscode.commands.executeCommand('antigravity-for-loop.updatePostIterationPrompt', data.prompt);
                    break;
                }
                case 'updatePreStopPrompt': {
                    vscode.commands.executeCommand('antigravity-for-loop.updatePreStopPrompt', data.prompt);
                    break;
                }
                case 'updatePromptTemplate': {
                    vscode.commands.executeCommand('antigravity-for-loop.updatePromptTemplate', data.template);
                    break;
                }
                case 'resetPromptTemplate': {
                    vscode.commands.executeCommand('antigravity-for-loop.resetPromptTemplate');
                    break;
                }
                case 'refreshState': {
                    // This will be handled by the extension calling updateState
                    vscode.commands.executeCommand('antigravity-for-loop.refreshSidebar');
                    break;
                }
            }
        });
    }

    updateState(state) {
        if (this._view) {
            this._view.webview.postMessage({ type: 'updateState', state });
        }
    }

    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Antigravity Loop</title>
            <style>
                body { 
                    font-family: var(--vscode-font-family); 
                    padding: 10px; 
                    color: var(--vscode-foreground);
                }
                .button { 
                    display: block; 
                    width: 100%; 
                    padding: 8px; 
                    margin-bottom: 10px; 
                    background: var(--vscode-button-background); 
                    color: var(--vscode-button-foreground); 
                    border: none; 
                    cursor: pointer; 
                }
                .button:hover { 
                    background: var(--vscode-button-hoverBackground); 
                }
                .section {
                    margin-bottom: 15px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .status-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                    align-items: center;
                }
                .status-label {
                    font-weight: bold;
                }
                .status-value {
                    font-family: monospace;
                }
                .status-value.on { color: var(--vscode-testing-iconPassed); }
                .status-value.off { color: var(--vscode-testing-iconFailed); }
                h3 { margin-top: 0; }
                .progress-container {
                    width: 100%;
                    background-color: var(--vscode-input-background);
                    border-radius: 4px;
                    margin-bottom: 10px;
                    overflow: hidden;
                    height: 20px;
                    display: none;
                }
                .progress-bar {
                    height: 100%;
                    background-color: var(--vscode-progressBar-background);
                    width: 0%;
                    transition: width 0.3s ease;
                }
                .logs-container {
                    margin-top: 15px;
                    padding: 10px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    font-family: monospace;
                    font-size: 0.85em;
                    height: 150px;
                    overflow-y: auto;
                    border: 1px solid var(--vscode-widget-border);
                    white-space: pre-wrap;
                }
                .log-entry {
                    margin-bottom: 4px;
                    border-bottom: 1px solid var(--vscode-widget-border);
                    padding-bottom: 2px;
                }
            </style>
        </head>
        <body>
            <div class="section">
                <h3>Loop Control</h3>
                <div id="wrapper-status" class="status-row">
                     Loop Status: <span id="loop-status">Ready</span>
                </div>
                
                <div id="progress-container" class="progress-container">
                    <div id="progress-bar" class="progress-bar"></div>
                </div>
                <div id="iteration-info" style="display:none; text-align: center; margin-bottom: 10px; font-size: 0.9em;">
                    Iteration <span id="iteration-count">-</span>
                </div>
                <button class="button" id="start-btn" onclick="startLoop()">Start Loop</button>
                <div style="display: flex; gap: 5px;">
                    <button class="button" id="pause-btn" onclick="pauseLoop()">Pause</button>
                    <button class="button" id="resume-btn" onclick="resumeLoop()" style="display: none;">Resume</button>
                </div>
                <button class="button" onclick="stopLoop()" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">Stop Loop</button>
                <div>Iteration: <span id="iteration" class="status-value">-</span> / <span id="max-iterations" class="status-value">-</span></div>
                <div style="margin-top: 5px; font-size: 0.9em; color: var(--vscode-descriptionForeground);">Last Message: <span id="loop-message">-</span></div>
                <div id="error-container" style="margin-top: 5px; color: var(--vscode-errorForeground); display: none;">
                    Error: <span id="last-error"></span>
                </div>
            </div>

            <div class="section">
                <h3>Settings</h3>
                
                <div class="status-row">
                    <span>Continuation Enforcer</span>
                    <span id="continuation-status" class="status-value">OFF</span>
                </div>
                <button class="button" onclick="toggleContinuation()">Toggle Enforcer</button>

                <div class="status-row">
                    <span>CDP Status</span>
                    <span id="cdp-status" class="status-value">OFF</span>
                </div>
                <button class="button" onclick="enableCDP()">Enable CDP (Restart)</button>

                <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed var(--vscode-panel-border);">
                    <div style="margin-bottom: 10px;">
                        <label for="max-iterations">Max Iterations:</label>
                        <select id="max-iterations" style="width: 100%; margin-top: 5px; padding: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border);">
                            <option value="5">5 iterations (Quick try)</option>
                            <option value="10" selected>10 iterations (Recommended)</option>
                            <option value="20">20 iterations (Complex task)</option>
                            <option value="50">50 iterations (Difficult task)</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 10px;">
                        <label for="completion-mode">Stop Condition:</label>
                        <select id="completion-mode" style="width: 100%; margin-top: 5px; padding: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border);">
                            <option value="ai" selected>AI Self-Judgment (DONE keyword)</option>
                            <option value="test">Tests Pass</option>
                            <option value="build">Build Succeeds</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 10px;">
                        <label for="test-command">Test/Build Command (Optional):</label>
                        <input type="text" id="test-command" placeholder="Auto-detect if empty" style="width: 100%; margin-top: 5px; padding: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border);">
                        <div style="font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 2px;">Leave empty to auto-detect. Used when Stop Condition is Tests/Build.</div>
                    </div>

                    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; margin-bottom: 5px;">
                        <input type="checkbox" id="quota-check" checked>
                        <span>Auto-handle Quota Limit</span>
                    </label>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <label for="quota-interval">Log Interval (min):</label>
                        <input type="number" id="quota-interval" value="5" min="1" max="60" style="width: 50px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border);">
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px;">
                        <label for="quota-wait">Default Wait (min):</label>
                        <input type="number" id="quota-wait" value="30" min="1" max="120" style="width: 50px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border);">
                    </div>
                </div>
            </div>

            <div class="section">
                <h3>Prompt Settings</h3>
                <div>
                    <label for="custom-instructions">Loop Task / Instructions:</label>
                    <textarea id="custom-instructions" rows="4" style="width: 100%; margin-top: 5px; resize: vertical;" placeholder="Enter your task instructions...">Read tasks.md, pick next available task, do it and update tasks.md with result</textarea>
                    <button class="button" onclick="savePrompt()" style="margin-top: 5px;">Save Instructions</button>
                    <div id="save-status" style="font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 2px;"></div>
                </div>

                <div style="margin-top: 10px;">
                    <label for="pre-iteration-prompt">Pre-Iteration Prompt (Optional):</label>
                    <textarea id="pre-iteration-prompt" rows="2" style="width: 100%; margin-top: 5px; resize: vertical;" placeholder="Update tasks.md to represent current status of the run">Update tasks.md to represent current status of the run</textarea>
                    <button class="button" onclick="savePreIterationPrompt()" style="margin-top: 5px;">Save Pre-Prompt</button>
                    <div id="save-pre-status" style="font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 2px;"></div>
                    <div id="save-pre-status" style="font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 2px;"></div>
                </div>

                <div style="margin-top: 10px;">
                    <label for="pre-start-prompt">Pre-Start Prompt (Optional):</label>
                    <textarea id="pre-start-prompt" rows="2" style="width: 100%; margin-top: 5px; resize: vertical;" placeholder="Update tasks.md to be understandable, contain all needed info according to the project, update technical details, improve it as a prompt">Update tasks.md to be understandable, contain all needed info according to the project, update technical details, improve it as a prompt</textarea>
                    <button class="button" onclick="savePreStartPrompt()" style="margin-top: 5px;">Save Pre-Start</button>
                    <div id="save-pre-start-status" style="font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 2px;"></div>
                </div>

                <div style="margin-top: 10px;">
                    <label for="post-iteration-prompt">Post-Iteration Prompt (Optional):</label>
                    <textarea id="post-iteration-prompt" rows="2" style="width: 100%; margin-top: 5px; resize: vertical;" placeholder="Check that all tests passes and static analysis passes">Check that all tests passes and static analysis passes</textarea>
                    <button class="button" onclick="savePostIterationPrompt()" style="margin-top: 5px;">Save Post-Prompt</button>
                    <div id="save-post-status" style="font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 2px;"></div>
                </div>

                <div style="margin-top: 10px;">
                    <label for="pre-stop-prompt">Pre-Stop Prompt (Optional):</label>
                    <textarea id="pre-stop-prompt" rows="2" style="width: 100%; margin-top: 5px; resize: vertical;" placeholder="Update docs and readmes to represent current status of the project">Update docs and readmes to represent current status of the project</textarea>
                    <button class="button" onclick="savePreStopPrompt()" style="margin-top: 5px;">Save Pre-Stop</button>
                    <div id="save-pre-stop-status" style="font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 2px;"></div>
                </div>

                <div style="margin-top: 15px;">
                     <details>
                        <summary style="cursor: pointer; color: var(--vscode-textLink-foreground);">Advanced: Edit Loop Template</summary>
                        <div style="margin-top: 10px;">
                            <textarea id="prompt-template" rows="10" style="width: 100%; font-family: monospace; font-size: 0.9em; resize: vertical; white-space: pre;"></textarea>
                            <div style="display: flex; gap: 5px; margin-top: 5px;">
                                <button class="button" onclick="saveTemplate()">Save Template</button>
                                <button class="button" onclick="resetTemplate()" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">Reset Default</button>
                            </div>
                            <div style="font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 5px;">
                                Available tokens: {{iteration}}, {{maxIterations}}, {{taskDescription}}, {{testCommand}}, {{lastError}}, {{customInstructions}}, {{completionPromise}}
                            </div>
                            <div id="template-status" style="font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 2px;"></div>
                        </div>
                    </details>
                </div>
            </div>

            <div class="section">
                <h3>Logs</h3>
                <div id="logs-container" class="logs-container">
                    <div style="color: var(--vscode-descriptionForeground); text-align: center; margin-top: 60px;">No logs yet</div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                // Poll for state on load
                setInterval(() => {
                    vscode.postMessage({ type: 'refreshState' });
                }, 2000);
                vscode.postMessage({ type: 'refreshState' });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'updateState':
                            updateDisplay(message.state);
                            break;
                    }
                });

                function updateDisplay(state) {
                    // Loop Status
                    document.getElementById('loop-status').innerText = state.loopStatus;
                    document.getElementById('iteration').innerText = state.iteration || '-';
                    document.getElementById('max-iterations').innerText = state.maxIterations || '-';
                    
                    // Detailed Status
                    document.getElementById('loop-message').innerText = state.message || '-';
                    
                    const errorContainer = document.getElementById('error-container');
                    if (state.lastError) {
                        errorContainer.style.display = 'block';
                        document.getElementById('last-error').innerText = state.lastError;
                    } else {
                        errorContainer.style.display = 'none';
                    }
                    
                    // Progress Bar
                    if (state.maxIterations && state.maxIterations > 0) {
                        const progress = (state.iteration / state.maxIterations) * 100;
                        document.getElementById('progress-bar').style.width = \`\${progress}%\`;
                    }

                    const iterInfo = document.getElementById('iteration-info');
                    const progContainer = document.getElementById('progress-container');

                    if (state.loopStatus === 'running' || state.loopStatus === 'paused') {
                        iterInfo.style.display = 'block';
                        progContainer.style.display = 'block';
                        document.getElementById('iteration-count').innerText = \`\${state.iteration}/\${state.maxIterations}\`;
                        
                        // Hide Start Button
                        document.getElementById('start-btn').style.display = 'none';

                        // Pause/Resume visibility
                        if (state.loopStatus === 'running') {
                            document.getElementById('pause-btn').style.display = 'block';
                            document.getElementById('resume-btn').style.display = 'none';
                            // Reset progress color
                            document.getElementById('progress-bar').style.backgroundColor = 'var(--vscode-progressBar-background)';
                        } else {
                            document.getElementById('pause-btn').style.display = 'none';
                            document.getElementById('resume-btn').style.display = 'block';
                        }
                    } else {
                        iterInfo.style.display = 'none';
                        // Show Start Button
                        document.getElementById('start-btn').style.display = 'block';
                        
                        // Hide Pause/Resume
                        document.getElementById('pause-btn').style.display = 'none';
                        document.getElementById('resume-btn').style.display = 'none';

                         // Handle Progress Bar Color and Visibility for Done/Failed
                        if (state.loopStatus === 'Done') {
                             progContainer.style.display = 'block';
                             document.getElementById('progress-bar').style.width = '100%';
                             document.getElementById('progress-bar').style.backgroundColor = 'var(--vscode-testing-iconPassed)';
                        } else if (state.loopStatus === 'Failed' || state.loopStatus === 'Stuck') {
                             progContainer.style.display = 'block';
                             document.getElementById('progress-bar').style.backgroundColor = 'var(--vscode-testing-iconFailed)';
                        } else {
                             // Ready or unknown
                            progContainer.style.display = 'none';
                            document.getElementById('progress-bar').style.width = '0%';
                            document.getElementById('progress-bar').style.backgroundColor = 'var(--vscode-progressBar-background)';
                        }
                    }

                    // Logs
                    const logsContainer = document.getElementById('logs-container');
                    if (state.logs && state.logs.length > 0) {
                        logsContainer.innerHTML = state.logs.map(log => \`<div class="log-entry">\${escapeHtml(log)}</div>\`).join('');
                        logsContainer.scrollTop = logsContainer.scrollHeight;
                    }

                    // Continuation Enforcer
                    const contInfo = document.getElementById('continuation-status');
                    contInfo.innerText = state.continuationEnabled ? 'ON' : 'OFF';
                    contInfo.className = 'status-value ' + (state.continuationEnabled ? 'on' : 'off');

                    // CDP
                    const cdpInfo = document.getElementById('cdp-status');
                    cdpInfo.innerText = state.cdpEnabled ? 'ENABLED' : 'DISABLED';
                    cdpInfo.className = 'status-value ' + (state.cdpEnabled ? 'on' : 'off');

                    // Custom Prompt
                    const promptInput = document.getElementById('custom-instructions');
                    if (state.customInstructions !== undefined && promptInput.value !== state.customInstructions) {
                         if (document.activeElement !== promptInput) {
                             promptInput.value = state.customInstructions || '';
                         }
                    }

                    // Pre-Iteration Prompt
                    const prePromptInput = document.getElementById('pre-iteration-prompt');
                    if (state.preIterationPrompt !== undefined && prePromptInput.value !== state.preIterationPrompt) {
                         if (document.activeElement !== prePromptInput) {
                             prePromptInput.value = state.preIterationPrompt || '';
                         }
                    }

                    // Pre-Start Prompt
                    const preStartPromptInput = document.getElementById('pre-start-prompt');
                    if (state.preStartPrompt !== undefined && preStartPromptInput.value !== state.preStartPrompt) {
                         if (document.activeElement !== preStartPromptInput) {
                             preStartPromptInput.value = state.preStartPrompt || '';
                         }
                    }

                    // Post-Iteration Prompt
                    const postIterationPromptInput = document.getElementById('post-iteration-prompt');
                    if (state.postIterationPrompt !== undefined && postIterationPromptInput.value !== state.postIterationPrompt) {
                         if (document.activeElement !== postIterationPromptInput) {
                             postIterationPromptInput.value = state.postIterationPrompt || '';
                         }
                    }

                    // Pre-Stop Prompt
                    const preStopPromptInput = document.getElementById('pre-stop-prompt');
                    if (state.preStopPrompt !== undefined && preStopPromptInput.value !== state.preStopPrompt) {
                         if (document.activeElement !== preStopPromptInput) {
                             preStopPromptInput.value = state.preStopPrompt || '';
                         }
                    }

                    // Prompt Template
                    const templateInput = document.getElementById('prompt-template');
                    if (state.promptTemplate !== undefined) {
                        // Only update if not focused to allow editing
                        if (document.activeElement !== templateInput) {
                             // If it's empty/null, we might want to show default placeholder or ask for it
                             // But usually state will have the default if not set
                             templateInput.value = state.promptTemplate || '';
                        }
                    }
                }

                function escapeHtml(unsafe) {
                    return unsafe
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                }

                function startLoop() { 
                    const quotaEnabled = document.getElementById('quota-check').checked;
                    const quotaIntervalValid = parseInt(document.getElementById('quota-interval').value) || 5;
                    const quotaWaitValid = parseInt(document.getElementById('quota-wait').value) || 30;
                    const quotaInterval = quotaIntervalValid * 60000;
                    const quotaWait = quotaWaitValid * 60000;

                    const taskDescription = document.getElementById('custom-instructions').value;
                    const maxIterations = parseInt(document.getElementById('max-iterations').value) || 10;
                    const completionMode = document.getElementById('completion-mode').value;
                    const testCommand = document.getElementById('test-command').value.trim() || null;

                    vscode.postMessage({ 
                        type: 'startLoop',
                        options: {
                            quotaCheckEnabled: quotaEnabled,
                            quotaCheckInterval: quotaInterval,
                            quotaDefaultWait: quotaWait,
                            taskDescription: taskDescription,
                            maxIterations: maxIterations,
                            completionMode: completionMode,
                            testCommand: testCommand
                        }
                    }); 
                }
                function stopLoop() { vscode.postMessage({ type: 'stopLoop' }); }
                function pauseLoop() { vscode.postMessage({ type: 'pauseLoop' }); }
                function resumeLoop() { vscode.postMessage({ type: 'resumeLoop' }); }
                function toggleContinuation() { vscode.postMessage({ type: 'toggleContinuation' }); }
                function enableCDP() { vscode.postMessage({ type: 'enableCDP' }); }
                function savePrompt() {
                    const prompt = document.getElementById('custom-instructions').value;
                    vscode.postMessage({ type: 'updatePrompt', prompt });
                    const status = document.getElementById('save-status');
                    status.innerText = 'Saved!';
                    setTimeout(() => status.innerText = '', 2000);
                }

                function savePreIterationPrompt() {
                    const prompt = document.getElementById('pre-iteration-prompt').value;
                    vscode.postMessage({ type: 'updatePreIterationPrompt', prompt });
                    const status = document.getElementById('save-pre-status');
                    status.innerText = 'Saved!';
                    setTimeout(() => status.innerText = '', 2000);
                }

                function savePreStartPrompt() {
                    const prompt = document.getElementById('pre-start-prompt').value;
                    vscode.postMessage({ type: 'updatePreStartPrompt', prompt });
                    const status = document.getElementById('save-pre-start-status');
                    status.innerText = 'Saved!';
                    setTimeout(() => status.innerText = '', 2000);
                }

                function savePostIterationPrompt() {
                    const prompt = document.getElementById('post-iteration-prompt').value;
                    vscode.postMessage({ type: 'updatePostIterationPrompt', prompt });
                    const status = document.getElementById('save-post-status');
                    status.innerText = 'Saved!';
                    setTimeout(() => status.innerText = '', 2000);
                }

                function saveTemplate() {
                    const template = document.getElementById('prompt-template').value;
                    vscode.postMessage({ type: 'updatePromptTemplate', template });
                    const status = document.getElementById('template-status');
                    status.innerText = 'Template Saved!';
                    setTimeout(() => status.innerText = '', 2000);
                }

                function resetTemplate() {
                    if(confirm('Reset prompt template to default?')) {
                        vscode.postMessage({ type: 'resetPromptTemplate' });
                    }
                }
            </script>
        </body>
        </html>`;
    }
}

module.exports = SidebarProvider;

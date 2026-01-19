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
                    vscode.commands.executeCommand('antigravity-for-loop.start');
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
                <button class="button" onclick="startLoop()">Start Loop</button>
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
            </div>

            <div class="section">
                <h3>Prompt Settings</h3>
                <div>
                    <label for="custom-instructions">Custom Instructions (Appended):</label>
                    <textarea id="custom-instructions" rows="4" style="width: 100%; margin-top: 5px; resize: vertical;" placeholder="e.g. Always add comments..."></textarea>
                    <button class="button" onclick="savePrompt()" style="margin-top: 5px;">Save Instructions</button>
                    <div id="save-status" style="font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 2px;"></div>
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
                        
                        // Pause/Resume visibility
                        if (state.loopStatus === 'running') {
                            document.getElementById('pause-btn').style.display = 'block';
                            document.getElementById('resume-btn').style.display = 'none';
                        } else {
                            document.getElementById('pause-btn').style.display = 'none';
                            document.getElementById('resume-btn').style.display = 'block';
                        }
                    } else {
                        iterInfo.style.display = 'none';
                        // Keep progress bar visible if failed/done for review, or hide? 
                        // Let's reset controls but maybe keep progress bar if "Done"
                        if (state.loopStatus === 'Ready') {
                            progContainer.style.display = 'none';
                            document.getElementById('progress-bar').style.width = '0%';
                        }
                         
                        document.getElementById('pause-btn').style.display = 'block'; // Reset
                        document.getElementById('resume-btn').style.display = 'none';
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
                }

                function escapeHtml(unsafe) {
                    return unsafe
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                }

                function startLoop() { vscode.postMessage({ type: 'startLoop' }); }
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
            </script>
        </body>
        </html>`;
    }
}

module.exports = SidebarProvider;

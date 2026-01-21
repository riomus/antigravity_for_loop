const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class StateManager {
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
    }

    /**
     * Get the state file path based on configuration or default
     */
    getStateFilePath() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const config = vscode.workspace.getConfiguration('antigravity');
        const configuredPath = config.get('stateFilePath');

        if (configuredPath && typeof configuredPath === 'string' && configuredPath.trim() !== '') {
            const fullPath = path.isAbsolute(configuredPath)
                ? configuredPath
                : path.join(workspaceRoot, configuredPath);

            // Ensure directory exists
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                try {
                    fs.mkdirSync(dir, { recursive: true });
                } catch (e) {
                    this.outputChannel.appendLine(`[Error] Failed to create directory for state file: ${e.message}`);
                }
            }
            return fullPath;
        }

        // Default path
        const dotDir = path.join(workspaceRoot, '.antigravity');
        if (!fs.existsSync(dotDir)) {
            try {
                fs.mkdirSync(dotDir, { recursive: true });
            } catch (e) {
                this.outputChannel.appendLine(`[Error] Failed to create .antigravity directory: ${e.message}`);
            }
        }
        return path.join(dotDir, 'for-loop-state.json');
    }

    /**
     * Save state to file
     */
    saveState(state) {
        const stateFile = this.getStateFilePath();
        if (!stateFile) return;

        try {
            fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
            return state;
        } catch (error) {
            if (this.outputChannel) {
                this.outputChannel.appendLine(`[Error] Failed to save state to ${stateFile}: ${error.message}`);
            }
            return null;
        }
    }

    /**
     * Read the current loop state
     */
    readState() {
        const stateFile = this.getStateFilePath();
        if (!stateFile || !fs.existsSync(stateFile)) {
            return null;
        }
        try {
            const content = fs.readFileSync(stateFile, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            if (this.outputChannel) {
                this.outputChannel.appendLine(`[Error] Failed to read state from ${stateFile}: ${error.message}`);
            }
            return null;
        }
    }
}

module.exports = StateManager;

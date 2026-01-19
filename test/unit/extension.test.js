
const assert = require('assert');
const Module = require('module');
const originalRequire = Module.prototype.require;

// Mock vscode module
Module.prototype.require = function (request) {
    if (request === 'vscode') {
        return {
            window: {
                createOutputChannel: () => ({ appendLine: () => { }, show: () => { } }),
                createStatusBarItem: () => ({ show: () => { } }),
                showInformationMessage: () => Promise.resolve(),
                showWarningMessage: () => Promise.resolve(),
                showErrorMessage: () => Promise.resolve(),
                showQuickPick: () => Promise.resolve(),
                showInputBox: () => Promise.resolve(),
                registerWebviewViewProvider: () => ({ dispose: () => { } })
            },
            commands: {
                registerCommand: () => ({ dispose: () => { } }),
                executeCommand: () => Promise.resolve()
            },
            workspace: {
                workspaceFolders: []
            },
            env: {
                clipboard: { writeText: () => Promise.resolve() },
                appName: 'VS Code'
            },
            StatusBarAlignment: { Right: 1 },
            ThemeColor: class { },
            QuickPickItemKind: { Separator: -1 },
            Uri: { file: (path) => ({ fsPath: path }) },
            ViewColumn: { One: 1 }
        };
    }
    return originalRequire.apply(this, arguments);
};

const extension = require('../../extension');

describe('Extension Test Suite', () => {
    it('Extension should export activate and deactivate', () => {
        assert.ok(extension.activate);
        assert.ok(extension.deactivate);
    });

    it('Extension should activate without error', () => {
        const context = { subscriptions: [], extensionUri: { fsPath: '/test' } };
        extension.activate(context);
        assert.strictEqual(context.subscriptions.length, 17); // Status bar + channel + 12 commands + 1 sidebar
    });
});



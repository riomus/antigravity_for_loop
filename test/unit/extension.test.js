
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
    if (request.includes('cdp-manager')) {
        return {
            CDPManager: class {
                constructor() { }
                tryConnect() { return Promise.resolve(false); }
            }
        };
    }
    if (request.includes('relauncher')) {
        return {
            Relauncher: class {
                constructor() { }
                isCDPEnabled() { return false; }
            }
        };
    }
    if (request.includes('ralph-loop')) {
        return {
            RalphLoop: class {
                constructor() { }
                static get DEFAULT_PROMPT_TEMPLATE() { return 'DEFAULT'; }
            }
        };
    }
    if (request.includes('sidebar-provider')) {
        return class SidebarProvider {
            constructor() { }
            updateState() { }
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
        assert.strictEqual(context.subscriptions.length, 18); // Status bar + channel + 15 commands + 1 sidebar
    });

    after(() => {
        Module.prototype.require = originalRequire;
    });
});



const Module = require('module');
const originalRequire = Module.prototype.require;

let mockConfig = {};
let mockWorkspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];
let mockWindow = null;

// Shared vscode mock that can be configured per test
const vscodeMock = {
    window: null, // Will be set dynamically
    workspace: {
        get workspaceFolders() {
            return mockWorkspaceFolders;
        },
        getConfiguration: (section) => {
            if (section === 'antigravity') {
                return {
                    get: (key) => mockConfig[key] !== undefined ? mockConfig[key] : null
                };
            }
            return { get: () => null };
        }
    },
    commands: {
        registerCommand: () => ({ dispose: () => { } }),
        executeCommand: () => Promise.resolve()
    },
    env: {
        clipboard: { writeText: () => Promise.resolve() },
        appName: 'VS Code'
    },
    Uri: { file: (p) => ({ fsPath: p }) },
    StatusBarAlignment: { Left: 1, Right: 2 },
    ThemeColor: class { },
    QuickPickItemKind: { Separator: -1 },
    ViewColumn: { One: 1 }
};

// Install the mock
function installVSCodeMock() {
    Module.prototype.require = function (request) {
        if (request === 'vscode') {
            // Dynamically set window if not already set
            if (!vscodeMock.window) {
                vscodeMock.window = {
                    createOutputChannel: () => ({
                        appendLine: () => { },
                        show: () => { }
                    }),
                    createStatusBarItem: () => ({
                        show: () => { },
                        hide: () => { },
                        dispose: () => { }
                    }),
                    registerWebviewViewProvider: () => ({ dispose: () => { } }),
                    showInformationMessage: () => Promise.resolve(),
                    showWarningMessage: () => Promise.resolve(),
                    showErrorMessage: () => Promise.resolve(),
                    showQuickPick: () => Promise.resolve(),
                    showInputBox: () => Promise.resolve()
                };
            }
            return vscodeMock;
        }
        return originalRequire.apply(this, arguments);
    };
}

// Uninstall the mock
function uninstallVSCodeMock() {
    Module.prototype.require = originalRequire;
}

// Reset mock state
function resetMockState() {
    mockConfig = {};
    mockWorkspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];
    mockWindow = null;
    vscodeMock.window = null;
}

// Configure mock
function setMockConfig(config) {
    mockConfig = config || {};
}

function setMockWorkspaceFolders(folders) {
    mockWorkspaceFolders = folders;
}

function setMockWindow(window) {
    mockWindow = window;
    vscodeMock.window = window;
}

module.exports = {
    installVSCodeMock,
    uninstallVSCodeMock,
    resetMockState,
    setMockConfig,
    setMockWorkspaceFolders,
    setMockWindow,
    vscodeMock
};

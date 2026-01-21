const assert = require('assert');
const path = require('path');
const fs = require('fs');
const Module = require('module');
const originalRequire = Module.prototype.require;

// Mock vscode module
let mockConfig = {};
Module.prototype.require = function (request) {
    if (request === 'vscode') {
        return {
            window: {
                createOutputChannel: () => ({ appendLine: () => { }, show: () => { } }),
                createStatusBarItem: () => ({ show: () => { } }),
                showInformationMessage: () => Promise.resolve(),
                showWarningMessage: () => Promise.resolve(),
                showErrorMessage: () => Promise.resolve(),
            },
            workspace: {
                workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
                getConfiguration: (section) => ({
                    get: (key) => mockConfig[key]
                })
            },
            Uri: { file: (p) => ({ fsPath: p }) }
        };
    }
    // Mock other internal modules to avoid loading them
    if (['./lib/sidebar-provider', './lib/cdp-manager', './lib/relauncher', './lib/ralph-loop'].includes(request)) {
        return {};
    }
    return originalRequire.apply(this, arguments);
};

// Mock fs module for mkdirSync and existsSync
const originalExistsSync = fs.existsSync;
const originalMkdirSync = fs.mkdirSync;
let createdDirs = [];

fs.existsSync = (path) => {
    if (path.startsWith('/test/workspace')) return false; // Default to not existing for test
    return originalExistsSync(path);
};
fs.mkdirSync = (path) => {
    createdDirs.push(path);
    return undefined;
};

const extension = require('../../extension');


describe('State Configuration Test Suite', () => {
    let extension;

    beforeEach(() => {
        mockConfig = {};
        createdDirs = [];

        // Clear require cache for extension to ensure it uses our fresh vscode mock
        delete require.cache[require.resolve('../../extension')];
        extension = require('../../extension');
    });

    after(() => {
        Module.prototype.require = originalRequire;
        fs.existsSync = originalExistsSync;
        fs.mkdirSync = originalMkdirSync;
    });

    it('should use default path when config is missing', () => {
        const filePath = extension._private.getStateFilePath();
        assert.strictEqual(filePath, path.join('/test/workspace', '.antigravity', 'for-loop-state.json'));
    });

    it('should use configured path', () => {
        mockConfig = { stateFilePath: '.vscode/state.json' };
        // Reload to pick up config? No, config is accessed dynamically. 
        // But getStateFilePath accesses vscode.workspace.workspaceFolders, which is on the vscode object.
        // Since we reloaded extension, it required vscode again, calling our mock.

        const filePath = extension._private.getStateFilePath();
        assert.strictEqual(filePath, path.join('/test/workspace', '.vscode', 'state.json'));
    });

    it('should create directory if it does not exist', () => {
        mockConfig = { stateFilePath: 'custom/dir/state.json' };
        extension._private.getStateFilePath();
        assert.ok(createdDirs.includes(path.join('/test/workspace', 'custom/dir')));
    });
});


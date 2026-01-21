const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { setMockConfig } = require('./helpers/vscode-mock');

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

describe('State Configuration Test Suite', () => {
    let extension;

    beforeEach(() => {
        setMockConfig({});
        createdDirs = [];

        // Clear require cache for extension to ensure it uses our fresh vscode mock
        delete require.cache[require.resolve('../../extension')];
        extension = require('../../extension');
    });

    after(() => {
        fs.existsSync = originalExistsSync;
        fs.mkdirSync = originalMkdirSync;
    });


    it('should use default path when config is missing', () => {
        const filePath = extension._private.getStateFilePath();
        assert.strictEqual(filePath, path.join('/test/workspace', '.antigravity', 'for-loop-state.json'));
    });

    it('should use configured path', () => {
        setMockConfig({ stateFilePath: '.vscode/state.json' });

        // Clear and reload extension to pick up new config
        delete require.cache[require.resolve('../../extension')];
        extension = require('../../extension');

        const filePath = extension._private.getStateFilePath();
        assert.strictEqual(filePath, path.join('/test/workspace', '.vscode', 'state.json'));
    });

    it('should create directory if it does not exist', () => {
        setMockConfig({ stateFilePath: 'custom/dir/state.json' });

        // Clear and reload extension to pick up new config
        delete require.cache[require.resolve('../../extension')];
        extension = require('../../extension');

        extension._private.getStateFilePath();
        assert.ok(createdDirs.includes(path.join('/test/workspace', 'custom/dir')));
    });
});


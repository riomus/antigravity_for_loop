const { installVSCodeMock, resetMockState } = require('./helpers/vscode-mock');

// Install vscode mock immediately when this file is loaded
installVSCodeMock();

// Export root hooks for mocha
exports.mochaHooks = {
    beforeEach() {
        // Reset mock state before each test to ensure isolation
        resetMockState();

        // Clear require cache for modules that depend on vscode
        Object.keys(require.cache).forEach(key => {
            if (key.includes('extension.js') ||
                key.includes('state-manager') ||
                key.includes('sidebar-provider') ||
                key.includes('cdp-manager') ||
                key.includes('relauncher') ||
                key.includes('ralph-loop')) {
                delete require.cache[key];
            }
        });
    }
};

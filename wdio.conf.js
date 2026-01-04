// wdio.conf.js
// WebdriverIO configuration for E2E tests with VSCode

const path = require('path');

exports.config = {
    // ====================
    // Runner Configuration
    // ====================
    runner: 'local',

    // ==================
    // Specify Test Files
    // ==================
    specs: [
        './test/e2e/**/*.e2e.js'
    ],

    // ============
    // Capabilities
    // ============
    capabilities: [{
        browserName: 'vscode',
        browserVersion: 'stable',
        'wdio:vscodeOptions': {
            extensionPath: path.join(__dirname),
            userSettings: {
                'editor.fontSize': 14
            }
        }
    }],

    // ===================
    // Services
    // ===================
    services: ['vscode'],

    // ===================
    // Test Configurations
    // ===================
    logLevel: 'info',
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,

    // ==============
    // Test Framework
    // ==============
    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    },

    // =====
    // Hooks
    // =====
    beforeSession: function () {
        console.log('Starting E2E test session...');
    },

    afterSession: function () {
        console.log('E2E test session completed.');
    }
};



const assert = require('assert');
const Module = require('module');
const originalRequire = Module.prototype.require;

let mockUpdateState = null;
let savedState = null;

// Override specific modules that need custom behavior for this test
const customRequireOverride = Module.prototype.require;
Module.prototype.require = function (request) {
    if (request === 'fs') {
        return {
            existsSync: (path) => true,
            readFileSync: (path) => JSON.stringify({ status: 'running' }), // Missing prompt_template
            writeFileSync: (path, data) => { savedState = JSON.parse(data); },
            mkdirSync: () => { },
            readdirSync: () => []
        };
    }
    if (request === './lib/sidebar-provider') {
        return class SidebarProvider {
            constructor() { }
            updateState(state) {
                if (mockUpdateState) mockUpdateState(state);
            }
            resolveWebviewView() { }
        };
    }
    // Match strict string or part of it
    if (request.includes('ralph-loop')) {
        return {
            RalphLoop: {
                DEFAULT_PROMPT_TEMPLATE: 'DEFAULT_TEMPLATE_VALUE'
            }
        };
    }

    // Ignore other lib modules to avoid errors if their dependencies aren't mocked
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

    return customRequireOverride.apply(this, arguments);
};

const extension = require('../../extension');

describe('Default Template Logic', () => {
    it('should fall back to default template if state has none', (done) => {
        let callCount = 0;
        mockUpdateState = (state) => {
            // activate calls updateStatusBar repeatedly via setInterval?
            // AND resetStaleState -> saveState -> updateSidebarState.
            // We want the ONE where it checks the state.

            // console.log('UpdateState called with:', state);

            if (state.promptTemplate === 'DEFAULT_TEMPLATE_VALUE') {
                done();
                mockUpdateState = null; // stop listening
            }
        };

        const context = { subscriptions: [], extensionUri: { fsPath: '/test' } };

        // This triggers the chain
        extension.activate(context);

        // Timeout if not called
        setTimeout(() => {
            if (mockUpdateState) done(new Error('updateState was not called with expected template'));
        }, 1000);
    });
});

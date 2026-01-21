

const assert = require('assert');
const Module = require('module');
const originalRequire = Module.prototype.require;

// Override specific modules that need custom behavior for this test
const customRequireOverride = Module.prototype.require;
Module.prototype.require = function (request) {
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
                constructor() {
                    this.isRunning = false;
                    this.isPaused = false;
                    this.currentIteration = 0;
                }
                static get DEFAULT_PROMPT_TEMPLATE() { return 'DEFAULT'; }
                async start() { return { success: true }; }
                pause() { return true; }
                resume() { return true; }
                cancel() { }
                getStatus() { return { isRunning: false }; }
            }
        };
    }
    if (request.includes('sidebar-provider')) {
        return class SidebarProvider {
            constructor() { }
            updateState() { }
        };
    }
    return customRequireOverride.apply(this, arguments);
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



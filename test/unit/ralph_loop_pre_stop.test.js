const assert = require('assert');
const { RalphLoop } = require('../../lib/ralph-loop');

// Mock CDP Manager
class MockCDPManager {
    constructor() {
        this.injectedPrompts = [];
    }

    async tryConnect() {
        return true;
    }

    async injectPrompt(prompt) {
        this.injectedPrompts.push(prompt);
        return { success: true };
    }

    async clickAcceptButtons() {
        return { clicked: 0 };
    }

    async sendCommand() {
        return {};
    }
}

// Mock Output Channel
class MockOutputChannel {
    constructor() {
        this.lines = [];
    }
    appendLine(line) {
        this.lines.push(line);
    }
}

describe('RalphLoop Pre-Stop Prompt', function () {
    it('should inject pre-stop prompt on success', async function () {
        const cdp = new MockCDPManager();
        const output = new MockOutputChannel();

        const loop = new RalphLoop(cdp, output, {
            maxIterations: 1,
            completionPromise: 'DONE',
            preStopPrompt: 'Cleanup task (Status: {{status}})',
            pollInterval: 1,
            aiTimeout: 1000
        });

        // Loop completes immediately after first iteration
        loop.waitForAICompletion = async () => 'DONE';

        const result = await loop.start();

        assert.strictEqual(result.success, true);

        // Expected: 1. Main prompt, 2. Pre-stop prompt
        assert.strictEqual(cdp.injectedPrompts.length, 2);
        assert.strictEqual(cdp.injectedPrompts[1], 'Cleanup task (Status: SUCCESS)');
    });

    it('should inject pre-stop prompt on failure (max iterations)', async function () {
        const cdp = new MockCDPManager();
        const output = new MockOutputChannel();

        const loop = new RalphLoop(cdp, output, {
            maxIterations: 1,
            completionPromise: 'DONE',
            preStopPrompt: 'Cleanup task (Status: {{status}})',
            pollInterval: 1, // fast
            aiTimeout: 100
        });

        // Never completes
        loop.waitForAICompletion = async () => 'thinking...';

        const result = await loop.start();

        assert.strictEqual(result.success, false); // Failed due to max iterations

        // Expected: 1. Main prompt, 2. Pre-stop prompt
        assert.strictEqual(cdp.injectedPrompts.length, 2);
        assert.strictEqual(cdp.injectedPrompts[1], 'Cleanup task (Status: FAILURE)');
    });
});

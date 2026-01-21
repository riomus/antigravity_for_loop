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
        // console.log(line);
        this.lines.push(line);
    }
}

describe('RalphLoop Pre-Start Prompt', function () {
    it('should inject pre-start prompt before iteration 1', async function () {
        const cdp = new MockCDPManager();
        const output = new MockOutputChannel();

        const aiResponses = [
            'Environment setup complete.', // 1. Pre-start response
            'DONE'                         // 2. Task response (Iteration 1)
        ];
        let responseIndex = 0;

        const loop = new RalphLoop(cdp, output, {
            maxIterations: 1,
            completionPromise: 'DONE',
            taskDescription: 'Do work',
            preStartPrompt: 'Setup environment for {{taskDescription}}',
            pollInterval: 1,
            aiTimeout: 1000
        });

        loop.waitForAICompletion = async () => {
            const res = aiResponses[responseIndex];
            responseIndex++;
            return res;
        };

        const result = await loop.start();

        assert.strictEqual(result.success, true);
        assert.strictEqual(cdp.injectedPrompts.length, 2);

        // First prompt should be pre-start prompt
        assert.ok(cdp.injectedPrompts[0].includes('Setup environment for Do work'), 'First prompt should be pre-start prompt with templating');

        // Second prompt should be task prompt
        assert.ok(cdp.injectedPrompts[1].includes('Do work'), 'Second prompt should be task prompt');
    });

    it('should handle pre-start prompt injection failure gracefully', async function () {
        const cdp = new MockCDPManager();
        const output = new MockOutputChannel();

        // Make injection fail for the first call (pre-start)
        let injectCount = 0;
        cdp.injectPrompt = async (prompt) => {
            injectCount++;
            cdp.injectedPrompts.push(prompt);
            if (injectCount === 1) { // Pre-start
                return { success: false, error: 'Injection failed' };
            }
            return { success: true };
        };

        const loop = new RalphLoop(cdp, output, {
            maxIterations: 1,
            completionPromise: 'DONE',
            preStartPrompt: 'Pre-check',
            pollInterval: 1,
            aiTimeout: 1000
        });

        // Mock AI completion for the MAIN prompt only
        loop.waitForAICompletion = async () => {
            return 'DONE';
        };

        const result = await loop.start();

        assert.strictEqual(result.success, true);
        assert.strictEqual(cdp.injectedPrompts.length, 2);
        assert.strictEqual(cdp.injectedPrompts[0], 'Pre-check');
        const errorLog = output.lines.find(l => l.includes('Pre-start inject failed'));
        assert.ok(errorLog, 'Should log pre-start injection failure');
    });
});

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
        // console.log(line); // Uncomment for debug
        this.lines.push(line);
    }
}

describe('RalphLoop Pre-Iteration Prompt', function () {
    it('should inject pre-iteration prompt before main prompt', async function () {
        const cdp = new MockCDPManager();
        const output = new MockOutputChannel();

        const aiResponses = [
            'State updated.', // 1. Pre-iteration response
            'DONE'            // 2. Task response
        ];
        let responseIndex = 0;

        const loop = new RalphLoop(cdp, output, {
            maxIterations: 1,
            completionPromise: 'DONE',
            taskDescription: 'Fix stuff',
            preIterationPrompt: 'Update state file iteration {{iteration}}',
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

        // First prompt should be pre-iteration prompt
        assert.ok(cdp.injectedPrompts[0].includes('Update state file iteration 1'), 'First prompt should be pre-iteration prompt');

        // Second prompt should be task prompt
        assert.ok(cdp.injectedPrompts[1].includes('Fix stuff'), 'Second prompt should be task prompt');
    });

    it('should handle pre-iteration prompt injection failure gracefully', async function () {
        // This test ensures that if pre-prompt fails, the loop continues (as per current impl which logs and continues)
        // Or if we want strict behavior, we verify failure. 
        // Current implementation logs error but proceeds to waitForAICompletion which effectively clears state? 
        // Implementation check: 
        // if (!preInjectResult.success) { this.log(...); } else { await waitForAICompletion... }
        // So if injection fails, it skips waitForAICompletion and goes straight to main prompt.

        const cdp = new MockCDPManager();
        const output = new MockOutputChannel();

        // Make injection fail for the first call (pre-prompt)
        let injectCount = 0;
        cdp.injectPrompt = async (prompt) => {
            injectCount++;
            cdp.injectedPrompts.push(prompt);
            if (injectCount === 1) { // Pre-prompt
                return { success: false, error: 'Injection failed' };
            }
            return { success: true };
        };

        const loop = new RalphLoop(cdp, output, {
            maxIterations: 1,
            completionPromise: 'DONE',
            preIterationPrompt: 'Pre-check',
            pollInterval: 1,
            aiTimeout: 1000
        });

        // Mock AI completion for the MAIN prompt only (since pre-prompt failed injection, we skip wait)
        loop.waitForAICompletion = async () => {
            return 'DONE';
        };

        const result = await loop.start();

        assert.strictEqual(result.success, true);
        assert.strictEqual(cdp.injectedPrompts.length, 2);
        assert.strictEqual(cdp.injectedPrompts[0], 'Pre-check');
        // Check logs for error message
        const errorLog = output.lines.find(l => l.includes('Pre-iteration inject failed'));
        assert.ok(errorLog, 'Should log pre-iteration injection failure');
    });
});

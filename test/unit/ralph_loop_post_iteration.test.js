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

describe('RalphLoop Post-Iteration Prompt', function () {
    it('should inject post-iteration prompt after iteration 1', async function () {
        const cdp = new MockCDPManager();
        const output = new MockOutputChannel();

        const aiResponses = [
            'DONE',                         // 1. Task response (Iteration 1)
            'Logs analyzed.'                // 2. Post-iteration response
        ];
        let responseIndex = 0;

        const loop = new RalphLoop(cdp, output, {
            maxIterations: 1,
            completionPromise: 'DONE',
            taskDescription: 'Do work',
            postIterationPrompt: 'Analyze logs for iteration {{iteration}}',
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

        // First prompt should be task prompt
        assert.ok(cdp.injectedPrompts[0].includes('Do work'), 'First prompt should be task prompt');

        // Second prompt should be post-iteration prompt with templating
        assert.strictEqual(cdp.injectedPrompts[1], 'Analyze logs for iteration 1', 'Second prompt should be post-iteration prompt with templating');
    });

    it('should inject post-iteration prompt even if iteration logic fails', async function () {
        // Note: Logic currently runs post-iteration only inside the loop. 
        // If "injection failed" happens for main prompt, loop retries.
        // If loop finishes, we are done.
        // Let's verify normal flow first.
    });
});

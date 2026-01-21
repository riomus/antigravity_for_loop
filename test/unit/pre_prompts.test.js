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

describe('RalphLoop Pre/Post Prompts', function () {
    it('should inject pre-start, pre-iteration, and post-iteration prompts', async function () {
        const cdp = new MockCDPManager();
        const output = new MockOutputChannel();

        const aiResponses = [
            'Pre-Start Done',      // 1. Pre-start
            'Pre-Iter 1 Done',     // 2. Pre-iter 1
            'Task 1 Working',      // 3. Task 1 (No DONE)
            'Post-Iter 1 Done',    // 4. Post-iter 1
            'DONE'                 // 5. Completion check
        ];
        let responseIndex = 0;

        const loop = new RalphLoop(cdp, output, {
            maxIterations: 1, // Just 1 iteration to test full cycle
            completionPromise: 'DONE',
            preStartPrompt: 'PRE-START',
            preIterationPrompt: 'PRE-ITERATION',
            postIterationPrompt: 'POST-ITERATION',
            pollInterval: 10,
            aiTimeout: 1000,
            testCommand: null // Disable test command to rely on AI done
        });

        // Mock AI interaction
        loop.getAIStatus = async () => {
            return {
                messageCount: responseIndex + 1,
                lastMessage: aiResponses[responseIndex] || 'DONE',
                isTyping: false
            };
        };

        // Mock waitForAICompletion to simplify interactions
        loop.waitForAICompletion = async () => {
            const res = aiResponses[responseIndex];
            responseIndex++;
            return res;
        };

        const result = await loop.start();

        console.log('Injected Prompts:', cdp.injectedPrompts);

        // Expected Prompts Sequence:
        // 1. PRE-START
        // 2. PRE-ITERATION
        // 3. Task Prompt (Iteration 1)
        // 4. POST-ITERATION

        // Note: Task Prompt injects "Task: ..."

        assert.strictEqual(cdp.injectedPrompts.length, 4, `Should have 4 prompt injections, got ${cdp.injectedPrompts.length}: ${JSON.stringify(cdp.injectedPrompts)}`);
        assert.strictEqual(cdp.injectedPrompts[0], 'PRE-START', 'First should be pre-start');
        assert.strictEqual(cdp.injectedPrompts[1], 'PRE-ITERATION', 'Second should be pre-iteration');
        assert.ok(cdp.injectedPrompts[2].includes('TASK:'), 'Third should be task prompt');
        assert.strictEqual(cdp.injectedPrompts[3], 'POST-ITERATION', 'Fourth should be post-iteration');
    });
});

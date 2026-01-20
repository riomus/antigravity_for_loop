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

describe('RalphLoop Verification Logic', function () {
    it('should inject verification prompt when configured', async function () {
        const cdp = new MockCDPManager();
        const output = new MockOutputChannel();

        // Mock AI responses
        const aiResponses = [
            'I have completed the task. DONE', // First response: claims checks passed
            'VERIFIED' // Verification response
        ];
        let responseIndex = 0;

        const loop = new RalphLoop(cdp, output, {
            maxIterations: 5,
            completionPromise: 'DONE',
            checkPrompt: 'Double check: is it really done?',
            successKeyword: 'VERIFIED',
            pollInterval: 10,
            aiTimeout: 1000
        });

        // Override getAIStatus to return mocked responses
        loop.getAIStatus = async () => {
            const msg = aiResponses[responseIndex];
            // Only advance if we haven't consumed all
            // Logic in loop calls waitForAICompletion which calls getAIStatus repeatedly
            return {
                messageCount: responseIndex + 1,
                lastMessage: msg,
                isTyping: false
            };
        };

        // We need to advance responseIndex when the loop "sees" the response and moves to next step
        // But loop.waitForAICompletion waits until stable. 
        // Let's mock waitForAICompletion directly to make it easier
        loop.waitForAICompletion = async () => {
            const res = aiResponses[responseIndex];
            responseIndex++;
            return res;
        };

        const result = await loop.start();

        assert.strictEqual(result.success, true);
        assert.strictEqual(cdp.injectedPrompts.length, 2);
        assert.ok(cdp.injectedPrompts[0].includes('TASK:'), 'First prompt should be task');
        assert.strictEqual(cdp.injectedPrompts[1], 'Double check: is it really done?', 'Second prompt should be verification');
    });

    it('should continue loop if verification fails', async function () {
        const cdp = new MockCDPManager();
        const output = new MockOutputChannel();

        const aiResponses = [
            'I think it is DONE', // 1. Claims done
            'Actually NO, I found a bug', // 2. Verification fails
            'Fixed it now. DONE', // 3. Retries and claims done
            'VERIFIED' // 4. Verification succeeds
        ];
        let responseIndex = 0;

        const loop = new RalphLoop(cdp, output, {
            maxIterations: 5,
            completionPromise: 'DONE',
            checkPrompt: 'Verify?',
            successKeyword: 'VERIFIED',
            pollInterval: 10,
            aiTimeout: 1000
        });

        loop.waitForAICompletion = async () => {
            const res = aiResponses[responseIndex];
            responseIndex++;
            return res;
        };

        const result = await loop.start();

        assert.strictEqual(result.success, true);
        // Prompts: 
        // 1. Task
        // 2. Verify?
        // 3. Task (retry)
        // 4. Verify?
        assert.strictEqual(cdp.injectedPrompts.length, 4);
        assert.strictEqual(cdp.injectedPrompts[1], 'Verify?');
        assert.strictEqual(cdp.injectedPrompts[3], 'Verify?');
    });
});

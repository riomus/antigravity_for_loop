const assert = require('assert');
const { RalphLoop } = require('../../lib/ralph-loop');

// Mock CDP Manager
class MockCDPManager {
    constructor() {
        this.injectedPrompts = [];
        this.commands = [];
        this.injectSuccess = false; // Configurable success
        this.quotaText = '';
    }

    async tryConnect() {
        return true;
    }

    async injectPrompt(prompt) {
        this.injectedPrompts.push(prompt);
        if (this.injectSuccess) {
            return { success: true };
        }
        return { success: false, error: 'Injection failed' };
    }

    async clickAcceptButtons() {
        return { clicked: 0 };
    }

    async sendCommand(method, params) {
        this.commands.push({ method, params });
        if (method === 'Runtime.evaluate' && params.expression.includes('Model quota limit exceeded')) {
            // Mock evaluation result
            const exceeded = this.quotaText.includes('Model quota limit exceeded');
            return {
                result: {
                    value: {
                        exceeded,
                        resumeDateStr: exceeded ? "2/16/2026, 5:11:09 PM" : null,
                        message: exceeded ? 'Model quota limit exceeded' : null
                    }
                }
            };
        }
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

describe('RalphLoop Quota Handling', function () {
    it('should detect quota limit and wait when injection fails', async function () {
        const cdp = new MockCDPManager();
        const output = new MockOutputChannel();

        // Setup mock: Injection fails, Quota text present
        cdp.injectSuccess = false;
        cdp.quotaText = "Some text... Model quota limit exceeded. You can resume using this model at 2/16/2026, 5:11:09 PM ...";

        const loop = new RalphLoop(cdp, output, {
            maxIterations: 2,
            completionPromise: 'DONE',
            quotaCheckEnabled: true,
            quotaCheckInterval: 50 // tiny interval for test
        });

        // Track progress updates
        const progressUpdates = [];
        loop.onProgress = (p) => progressUpdates.push(p);

        // Override sleep to speed up test but allow logic to run
        loop.sleep = async (ms) => { return; };

        let checkCount = 0;
        const originalSendCommand = cdp.sendCommand.bind(cdp);
        cdp.sendCommand = async (method, params) => {
            if (method === 'Runtime.evaluate' && params.expression.includes('Model quota limit exceeded')) {
                checkCount++;
                if (checkCount > 2) {
                    cdp.quotaText = "Quota clear"; // Clear it so loop resumes
                }
            }
            return originalSendCommand(method, params);
        };

        const result = await loop.start();

        const waitingStates = progressUpdates.filter(p => p.status === 'waiting');
        assert.ok(waitingStates.length > 0, 'Should have entered waiting state');
        assert.ok(waitingStates[0].message.includes('Waiting for quota'), 'Message should indicate quota wait');

        assert.ok(output.lines.some(l => l.includes('Model quota limit exceeded')), 'Should log quota error');
        assert.ok(output.lines.some(l => l.includes('Quota warning disappeared')), 'Should log quota disappearance');
    });

    it('should ignore quota if disabled', async function () {
        const cdp = new MockCDPManager();
        const output = new MockOutputChannel();

        cdp.injectSuccess = false;
        cdp.quotaText = "Model quota limit exceeded...";

        const loop = new RalphLoop(cdp, output, {
            maxIterations: 1,
            completionPromise: 'DONE',
            quotaCheckEnabled: false, // Disabled
            quotaCheckInterval: 50
        });

        const progressUpdates = [];
        loop.onProgress = (p) => progressUpdates.push(p);
        loop.sleep = async (ms) => { return; };

        await loop.start();

        const waitingStates = progressUpdates.filter(p => p.status === 'waiting');
        assert.strictEqual(waitingStates.length, 0, 'Should NOT enter waiting state if disabled');
    });

    it('should use default wait time if parsing fails', async function () {
        const cdp = new MockCDPManager();
        const output = new MockOutputChannel();

        cdp.injectSuccess = false;
        // Quota message with NO date - this relies on checkQuotaExceeded NOT returning resumeDateStr if regex fails
        // But our MockCDPManager hardcodes returning resumeDateStr if exceeded is true!
        // We need to fix the MockCDPManager to respect the mock text content vs regex

        // Let's patch checkQuotaExceeded on the mock or update the mock logic
        const originalSendCommand = cdp.sendCommand;
        cdp.sendCommand = async (method, params) => {
            if (method === 'Runtime.evaluate' && params.expression.includes('Model quota limit exceeded')) {
                const exceeded = cdp.quotaText.includes('Model quota limit exceeded');
                console.log('Mock check:', { exceeded, text: cdp.quotaText });
                // Only verify regex match if we want to simulate parsing success/fail
                // This mock simulates the browser logic. The browser logic uses regex.
                // let's mirror the regex logic here for accuracy or just hack it.
                const match = cdp.quotaText.match(/You can resume using this model at ([0-9\/]+, [0-9:]+\s*[AP]M)/i);
                return {
                    result: {
                        value: {
                            exceeded,
                            resumeDateStr: match ? match[1] : null,
                            message: exceeded ? 'Model quota limit exceeded' : null
                        }
                    }
                };
            }

            if (method === 'Runtime.evaluate' && params.expression.includes('continue')) {
                return { result: { value: { success: true } } };
            }
            return {}; // Start with empty return for other commands in this specific test
        };

        cdp.quotaText = "Model quota limit exceeded. Please try again later.";

        const loop = new RalphLoop(cdp, output, {
            maxIterations: 1,
            completionPromise: 'DONE',
            quotaCheckEnabled: true,
            quotaCheckInterval: 50,
            quotaDefaultWait: 200 // Mock 200ms default wait
        });

        const progressUpdates = [];
        loop.onProgress = (p) => progressUpdates.push(p);
        let sleepCount = 0;
        loop.sleep = async (ms) => {
            sleepCount++;
            // First sleep is the 2s retry delay. Second sleep is the wait loop.
            if (sleepCount > 1) {
                cdp.quotaText = "Clear";
            }
            return;
        };

        await loop.start();

        const waitingStates = progressUpdates.filter(p => p.status === 'waiting');
        console.log('Progress updates:', progressUpdates);
        assert.ok(waitingStates.length > 0, 'Should have entered waiting state');
        const msg = waitingStates[0].message;
        assert.ok(msg.includes('fallback'), 'Message should indicate fallback wait');
    });
});

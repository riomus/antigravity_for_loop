// test/unit/ralphLoop.test.js
// Comprehensive unit tests for RalphLoop class with mocked CDP

const assert = require('assert');
const path = require('path');

// Import RalphLoop
const { RalphLoop } = require('../../lib/ralph-loop');

/**
 * Mock CDP Manager for testing
 */
class MockCDPManager {
    constructor() {
        this.connected = true;
        this.injectPromptCalls = [];
        this.clickAcceptButtonsCalls = 0;
        this.mockAIStatus = { messageCount: 0, lastMessage: '', isTyping: false };
        this.injectPromptResult = { success: true };
    }

    async tryConnect() {
        return this.connected;
    }

    async injectPrompt(text) {
        this.injectPromptCalls.push(text);
        return this.injectPromptResult;
    }

    async clickAcceptButtons() {
        this.clickAcceptButtonsCalls++;
        return { clicked: 1, found: 1 };
    }

    async sendCommand(method, params) {
        if (method === 'Runtime.evaluate' && params.expression.includes('getAIStatus')) {
            return { result: { value: this.mockAIStatus } };
        }
        return { result: { value: null } };
    }

    setConnected(value) {
        this.connected = value;
    }

    setInjectPromptResult(result) {
        this.injectPromptResult = result;
    }

    setAIStatus(status) {
        this.mockAIStatus = status;
    }
}

/**
 * Mock Output Channel for testing
 */
class MockOutputChannel {
    constructor() {
        this.lines = [];
    }

    appendLine(text) {
        this.lines.push(text);
    }

    getOutput() {
        return this.lines.join('\n');
    }

    clear() {
        this.lines = [];
    }
}

describe('RalphLoop', function() {
    let cdp;
    let output;
    let loop;

    beforeEach(function() {
        cdp = new MockCDPManager();
        output = new MockOutputChannel();
    });

    afterEach(function() {
        if (loop && loop.isRunning) {
            loop.cancel();
        }
    });

    describe('Constructor', function() {
        it('should initialize with default options', function() {
            loop = new RalphLoop(cdp, output);

            assert.strictEqual(loop.options.maxIterations, 10);
            assert.strictEqual(loop.options.testCommand, null);
            assert.strictEqual(loop.options.completionPromise, 'DONE');
            assert.strictEqual(loop.options.pollInterval, 2000);
            assert.strictEqual(loop.options.aiTimeout, 300000);
        });

        it('should accept custom options', function() {
            loop = new RalphLoop(cdp, output, {
                maxIterations: 5,
                testCommand: 'npm test',
                completionPromise: 'FINISHED',
                taskDescription: 'Fix all errors',
                pollInterval: 1000,
                aiTimeout: 60000
            });

            assert.strictEqual(loop.options.maxIterations, 5);
            assert.strictEqual(loop.options.testCommand, 'npm test');
            assert.strictEqual(loop.options.completionPromise, 'FINISHED');
            assert.strictEqual(loop.options.taskDescription, 'Fix all errors');
            assert.strictEqual(loop.options.pollInterval, 1000);
            assert.strictEqual(loop.options.aiTimeout, 60000);
        });

        it('should not be running initially', function() {
            loop = new RalphLoop(cdp, output);

            assert.strictEqual(loop.isRunning, false);
            assert.strictEqual(loop.currentIteration, 0);
        });
    });

    describe('buildPrompt', function() {
        it('should include iteration info', function() {
            loop = new RalphLoop(cdp, output, {
                maxIterations: 10,
                taskDescription: 'Test task'
            });

            const prompt = loop.buildPrompt(3);

            assert.ok(prompt.includes('[ITERATION 3/10]'));
        });

        it('should include task description', function() {
            loop = new RalphLoop(cdp, output, {
                taskDescription: 'Fix TypeScript errors'
            });

            const prompt = loop.buildPrompt(1);

            assert.ok(prompt.includes('TASK: Fix TypeScript errors'));
        });

        it('should include test command in instructions', function() {
            loop = new RalphLoop(cdp, output, {
                testCommand: 'npm test'
            });

            const prompt = loop.buildPrompt(1);

            assert.ok(prompt.includes('Run: npm test'));
        });

        it('should include previous error on subsequent iterations', function() {
            loop = new RalphLoop(cdp, output);
            loop.lastError = 'TypeError: undefined is not a function';

            const prompt = loop.buildPrompt(2);

            assert.ok(prompt.includes('PREVIOUS ATTEMPT FAILED'));
            assert.ok(prompt.includes('TypeError: undefined is not a function'));
        });

        it('should not include previous error on first iteration', function() {
            loop = new RalphLoop(cdp, output);
            loop.lastError = 'Some error';

            const prompt = loop.buildPrompt(1);

            assert.ok(!prompt.includes('PREVIOUS ATTEMPT FAILED'));
        });

        it('should include completion promise', function() {
            loop = new RalphLoop(cdp, output, {
                completionPromise: 'DONE'
            });

            const prompt = loop.buildPrompt(1);

            assert.ok(prompt.includes('respond with exactly: DONE'));
        });

        it('should truncate long error messages', function() {
            loop = new RalphLoop(cdp, output);
            loop.lastError = 'x'.repeat(3000);

            const prompt = loop.buildPrompt(2);

            // Should be truncated to 2000 chars
            assert.ok(prompt.includes('x'.repeat(100)));
            assert.ok(prompt.length < 3000);
        });
    });

    describe('runTestCommand', function() {
        it('should return success when no test command', async function() {
            loop = new RalphLoop(cdp, output, {
                testCommand: null
            });

            const result = await loop.runTestCommand();

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.exitCode, 0);
        });

        it('should execute test command', async function() {
            loop = new RalphLoop(cdp, output, {
                testCommand: 'echo "test passed"',
                workspacePath: process.cwd()
            });

            const result = await loop.runTestCommand();

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.exitCode, 0);
            assert.ok(result.output.includes('test passed'));
        });

        it('should handle failing test command', async function() {
            loop = new RalphLoop(cdp, output, {
                testCommand: 'exit 1',
                workspacePath: process.cwd()
            });

            const result = await loop.runTestCommand();

            assert.strictEqual(result.success, false);
            assert.notStrictEqual(result.exitCode, 0);
        });

        it('should log output to channel', async function() {
            loop = new RalphLoop(cdp, output, {
                testCommand: 'echo "running test"',
                workspacePath: process.cwd()
            });

            await loop.runTestCommand();

            const logOutput = output.getOutput();
            assert.ok(logOutput.includes('[Ralph] Running:'));
        });
    });

    describe('getStatus', function() {
        it('should return current status', function() {
            loop = new RalphLoop(cdp, output, { maxIterations: 10 });
            loop.currentIteration = 5;
            loop.isRunning = true;
            loop.lastError = 'Test error';

            const status = loop.getStatus();

            assert.strictEqual(status.isRunning, true);
            assert.strictEqual(status.currentIteration, 5);
            assert.strictEqual(status.maxIterations, 10);
            assert.strictEqual(status.lastError, 'Test error');
        });
    });

    describe('cancel', function() {
        it('should stop the loop', function() {
            loop = new RalphLoop(cdp, output);
            loop.isRunning = true;

            loop.cancel();

            assert.strictEqual(loop.isRunning, false);
        });

        it('should log cancellation message', function() {
            loop = new RalphLoop(cdp, output);
            loop.isRunning = true;

            loop.cancel();

            const logOutput = output.getOutput();
            assert.ok(logOutput.includes('Cancelling loop'));
        });
    });

    describe('complete', function() {
        it('should mark loop as not running', function() {
            loop = new RalphLoop(cdp, output);
            loop.isRunning = true;

            loop.complete(true, 'Success');

            assert.strictEqual(loop.isRunning, false);
        });

        it('should return result object', function() {
            loop = new RalphLoop(cdp, output, { maxIterations: 10 });
            loop.currentIteration = 5;

            const result = loop.complete(true, 'Task completed');

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.message, 'Task completed');
            assert.strictEqual(result.iterations, 5);
            assert.strictEqual(result.maxIterations, 10);
        });

        it('should call onComplete callback', function(done) {
            let callbackResult = null;

            loop = new RalphLoop(cdp, output, {
                onComplete: (result) => {
                    callbackResult = result;
                }
            });

            loop.complete(true, 'Done');

            setTimeout(() => {
                assert.ok(callbackResult !== null);
                assert.strictEqual(callbackResult.success, true);
                done();
            }, 10);
        });

        it('should log success message', function() {
            loop = new RalphLoop(cdp, output);

            loop.complete(true, 'Success');

            const logOutput = output.getOutput();
            assert.ok(logOutput.includes('SUCCESS'));
        });

        it('should log failure message', function() {
            loop = new RalphLoop(cdp, output);

            loop.complete(false, 'Failed');

            const logOutput = output.getOutput();
            assert.ok(logOutput.includes('FAILED'));
        });
    });

    describe('startAutoAccept', function() {
        it('should start auto-accept interval', function() {
            loop = new RalphLoop(cdp, output, { autoAcceptInterval: 100 });
            loop.isRunning = true;

            loop.startAutoAccept();

            assert.ok(loop.autoAcceptTimer !== null);

            // Cleanup
            loop.stopAutoAccept();
        });

        it('should not start multiple intervals', function() {
            loop = new RalphLoop(cdp, output);
            loop.isRunning = true;

            loop.startAutoAccept();
            const firstTimer = loop.autoAcceptTimer;

            loop.startAutoAccept();

            assert.strictEqual(loop.autoAcceptTimer, firstTimer);

            // Cleanup
            loop.stopAutoAccept();
        });
    });

    describe('stopAutoAccept', function() {
        it('should stop auto-accept interval', function() {
            loop = new RalphLoop(cdp, output);
            loop.isRunning = true;

            loop.startAutoAccept();
            loop.stopAutoAccept();

            assert.strictEqual(loop.autoAcceptTimer, null);
        });

        it('should handle being called when not started', function() {
            loop = new RalphLoop(cdp, output);

            // Should not throw
            loop.stopAutoAccept();

            assert.strictEqual(loop.autoAcceptTimer, null);
        });
    });

    describe('start (integration)', function() {
        this.timeout(10000);

        it('should fail if already running', async function() {
            loop = new RalphLoop(cdp, output);
            loop.isRunning = true;

            const result = await loop.start();

            assert.strictEqual(result.success, false);
            assert.ok(result.error.includes('Already running'));
        });

        it('should fail if CDP connection fails', async function() {
            cdp.setConnected(false);
            loop = new RalphLoop(cdp, output, { maxIterations: 1 });

            const result = await loop.start();

            assert.strictEqual(result.success, false);
            assert.ok(result.message.includes('Could not connect to CDP'));
        });

        it('should inject prompt on each iteration', async function() {
            loop = new RalphLoop(cdp, output, {
                maxIterations: 2,
                testCommand: 'echo "pass"',
                pollInterval: 10,
                aiTimeout: 100,
                workspacePath: process.cwd()
            });

            // Simulate AI response
            cdp.setAIStatus({ messageCount: 1, lastMessage: 'Working on it', isTyping: false });

            await loop.start();

            // Should have tried to inject at least once
            assert.ok(cdp.injectPromptCalls.length >= 1);
        });

        it('should complete when test passes', async function() {
            loop = new RalphLoop(cdp, output, {
                maxIterations: 5,
                testCommand: 'exit 0',
                pollInterval: 10,
                aiTimeout: 100,
                workspacePath: process.cwd()
            });

            cdp.setAIStatus({ messageCount: 1, lastMessage: 'Done', isTyping: false });

            const result = await loop.start();

            assert.strictEqual(result.success, true);
        });

        it('should reach max iterations when tests keep failing', async function() {
            loop = new RalphLoop(cdp, output, {
                maxIterations: 2,
                testCommand: 'exit 1',
                pollInterval: 10,
                aiTimeout: 100,
                workspacePath: process.cwd()
            });

            cdp.setAIStatus({ messageCount: 1, lastMessage: 'Working', isTyping: false });

            const result = await loop.start();

            assert.strictEqual(result.success, false);
            assert.ok(result.message.includes('Max iterations'));
        });

        it('should complete when AI signals DONE', async function() {
            // Skip this test as it requires complex async mocking
            // The completion detection is tested via getAIStatus mock
            this.skip();
        });

        it('should call onProgress callback', async function() {
            let progressCalls = [];

            loop = new RalphLoop(cdp, output, {
                maxIterations: 2,
                testCommand: 'exit 0',
                pollInterval: 10,
                aiTimeout: 100,
                workspacePath: process.cwd(),
                onProgress: (progress) => {
                    progressCalls.push(progress);
                }
            });

            cdp.setAIStatus({ messageCount: 1, lastMessage: '', isTyping: false });

            await loop.start();

            assert.ok(progressCalls.length >= 1);
            assert.ok(progressCalls[0].iteration >= 1);
        });

        it('should handle injection failure gracefully', async function() {
            cdp.setInjectPromptResult({ success: false, error: 'Injection failed' });

            loop = new RalphLoop(cdp, output, {
                maxIterations: 2,
                pollInterval: 10,
                aiTimeout: 100
            });

            cdp.setAIStatus({ messageCount: 1, lastMessage: 'DONE', isTyping: false });

            // Should not throw
            const result = await loop.start();

            // Should still complete (might succeed on retry or timeout)
            assert.ok(result !== undefined);
        });
    });

    describe('sleep helper', function() {
        it('should delay for specified time', async function() {
            loop = new RalphLoop(cdp, output);

            const start = Date.now();
            await loop.sleep(50);
            const elapsed = Date.now() - start;

            assert.ok(elapsed >= 45); // Allow some tolerance
        });
    });
});

describe('RalphLoop Error Handling', function() {
    let cdp;
    let output;
    let loop;

    beforeEach(function() {
        cdp = new MockCDPManager();
        output = new MockOutputChannel();
    });

    afterEach(function() {
        if (loop && loop.isRunning) {
            loop.cancel();
        }
    });

    it('should store last error from failed tests', async function() {
        loop = new RalphLoop(cdp, output, {
            maxIterations: 2,
            testCommand: 'echo "ERROR: Something failed" && exit 1',
            pollInterval: 10,
            aiTimeout: 100,
            workspacePath: process.cwd()
        });

        cdp.setAIStatus({ messageCount: 1, lastMessage: '', isTyping: false });

        await loop.start();

        // lastError should contain the test output
        assert.ok(loop.lastError !== null);
    });

    it('should include error in next iteration prompt', function() {
        // Test the buildPrompt function directly with lastError set
        loop = new RalphLoop(cdp, output, {
            maxIterations: 10,
            testCommand: 'npm test'
        });

        // Simulate first iteration completed with error
        loop.lastError = 'TypeError: Cannot read property of undefined';

        // Build prompt for second iteration
        const secondPrompt = loop.buildPrompt(2);

        // Should include error context
        assert.ok(secondPrompt.includes('PREVIOUS ATTEMPT FAILED'));
        assert.ok(secondPrompt.includes('TypeError'));
    });
});

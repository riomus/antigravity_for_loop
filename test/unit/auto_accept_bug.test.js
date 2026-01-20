
const assert = require('assert');
const sinon = require('sinon');
const { RalphLoop } = require('../../lib/ralph-loop');

describe('RalphLoop Auto-Accept Logic', function () {
    let loop;
    let cdpManagerStub;
    let outputChannelStub;
    let clock;

    beforeEach(function () {
        cdpManagerStub = {
            clickAcceptButtons: sinon.stub().resolves(),
            tryConnect: sinon.stub().resolves(true),
            injectPrompt: sinon.stub().resolves({ success: true })
        };
        outputChannelStub = {
            appendLine: sinon.stub()
        };
        clock = sinon.useFakeTimers();

        loop = new RalphLoop(cdpManagerStub, outputChannelStub, {
            autoAcceptInterval: 100
        });
    });

    afterEach(function () {
        clock.restore();
        if (loop.isRunning) {
            loop.cancel();
        }
    });

    it('should NOT call clickAcceptButtons when paused', async function () {
        // Start auto-accept manually (simulating start)
        loop.isRunning = true;
        loop.startAutoAccept();

        // Advance time, should see calls
        await clock.tickAsync(150);
        assert(cdpManagerStub.clickAcceptButtons.calledTwice || cdpManagerStub.clickAcceptButtons.calledOnce, 'Should call auto-accept when running');

        const callCountBeforePause = cdpManagerStub.clickAcceptButtons.callCount;

        // Pause the loop
        loop.pause();
        assert.strictEqual(loop.isPaused, true);
        assert.strictEqual(loop.isRunning, true);

        // Advance time again
        await clock.tickAsync(500);

        // Ideally, call count should NOT increase if fixed. 
        // Currently (before fix), it WILL increase.
        const callCountAfterPause = cdpManagerStub.clickAcceptButtons.callCount;

        // Check that valid calls did not increase after pause
        assert.strictEqual(callCountAfterPause, callCountBeforePause, 'Should not call auto-accept while paused');
    });
});

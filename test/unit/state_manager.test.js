const assert = require('assert');
const path = require('path');
const fs = require('fs');
const sinon = require('sinon');
const { setMockConfig } = require('./helpers/vscode-mock');

// Mock helpers
const workspaceRoot = '/test/workspace';
const defaultStatePath = path.join(workspaceRoot, '.antigravity', 'for-loop-state.json');


describe('StateManager', () => {
    let StateManager;
    let stateManager;
    let outputChannelMock;

    before(() => {
        // Load the class under test
        StateManager = require('../../lib/state-manager');
    });

    beforeEach(() => {
        // Reset mock config to default (no custom state file path)
        setMockConfig({});

        // Mock output channel
        outputChannelMock = {
            appendLine: sinon.spy()
        };

        stateManager = new StateManager(outputChannelMock);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('getStateFilePath', () => {
        it('should return default path when no config is set', () => {
            // Mock fs.existsSync to true for dir
            sinon.stub(fs, 'existsSync').returns(true);

            const result = stateManager.getStateFilePath();
            assert.strictEqual(result, defaultStatePath);
        });

        it('should return default path and create directory if missing', () => {
            const fsExistsStub = sinon.stub(fs, 'existsSync');
            fsExistsStub.returns(false); // Directory doesn't exist

            const fsMkdirStub = sinon.stub(fs, 'mkdirSync');

            const result = stateManager.getStateFilePath();

            assert.strictEqual(result, defaultStatePath);
            assert.ok(fsMkdirStub.calledWith(path.dirname(defaultStatePath), { recursive: true }));
        });

        it('should return configured relative path', () => {
            // Update mock config
            setMockConfig({ stateFilePath: 'custom/path.json' });
            sinon.stub(fs, 'existsSync').returns(true);

            const result = stateManager.getStateFilePath();
            assert.strictEqual(result, path.join(workspaceRoot, 'custom/path.json'));
        });

        it('should return configured absolute path', () => {
            const absolutePath = '/absolute/path/to/state.json';

            // Update mock config
            setMockConfig({ stateFilePath: absolutePath });
            sinon.stub(fs, 'existsSync').returns(true);

            const result = stateManager.getStateFilePath();
            assert.strictEqual(result, absolutePath);
        });
    });

    describe('saveState', () => {
        it('should write state to file', () => {
            sinon.stub(fs, 'existsSync').returns(true);
            const fsWriteStub = sinon.stub(fs, 'writeFileSync');
            const state = { foo: 'bar' };

            stateManager.saveState(state);

            assert.ok(fsWriteStub.calledOnce);
            assert.strictEqual(fsWriteStub.firstCall.args[0], defaultStatePath);
            assert.strictEqual(fsWriteStub.firstCall.args[1], JSON.stringify(state, null, 2));
        });

        it('should log error when write fails', () => {
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'writeFileSync').throws(new Error('Write failed'));

            const result = stateManager.saveState({});

            assert.strictEqual(result, null);
            assert.ok(outputChannelMock.appendLine.calledWithMatch(/Failed to save state/));
        });
    });

    describe('readState', () => {
        it('should read state from file', () => {
            sinon.stub(fs, 'existsSync').returns(true);
            const state = { foo: 'bar' };
            sinon.stub(fs, 'readFileSync').returns(JSON.stringify(state));

            const result = stateManager.readState();

            assert.deepStrictEqual(result, state);
        });

        it('should return null if file does not exist', () => {
            sinon.stub(fs, 'existsSync').returns(false);

            const result = stateManager.readState();

            assert.strictEqual(result, null);
        });

        it('should log error and return null on parse error', () => {
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').returns('invalid json');

            const result = stateManager.readState();

            assert.strictEqual(result, null);
            assert.ok(outputChannelMock.appendLine.calledWithMatch(/Failed to read state/));
        });
    });


});

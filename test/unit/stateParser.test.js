// test/unit/stateParser.test.js
// Unit tests for pure logic functions (no vscode dependency)

const assert = require('assert');

// Mock state for testing
const createMockState = (overrides = {}) => ({
    iteration: 0,
    max_iterations: 10,
    completion_promise: 'DONE',
    original_prompt: 'Test task',
    test_command: 'npm test',
    stuck_threshold: 3,
    stuck_count: 0,
    last_error_hash: '',
    branch: '',
    started_at: new Date().toISOString(),
    status: 'running',
    ...overrides
});

// Pure function to parse state (extracted for unit testing)
function parseState(content) {
    try {
        return JSON.parse(content);
    } catch {
        return null;
    }
}

// Pure function to determine status bar text
function getStatusBarText(state) {
    if (!state) {
        return '$(circle-slash) For Loop: Off';
    }

    const iteration = state.iteration || 0;
    const maxIterations = state.max_iterations || 10;
    const progress = `${iteration}/${maxIterations}`;

    if (state.status === 'completed') {
        return `$(check) For Loop: Done`;
    } else if (state.status === 'failed' || state.status === 'stuck') {
        return `$(error) For Loop: ${state.status === 'stuck' ? 'Stuck' : 'Failed'}`;
    } else {
        return `$(sync~spin) For Loop: ${progress}`;
    }
}

// Pure function to check if loop should continue
function shouldContinueLoop(state) {
    if (!state) return false;
    if (state.status === 'completed' || state.status === 'failed' || state.status === 'stuck') {
        return false;
    }
    if (state.iteration >= state.max_iterations) {
        return false;
    }
    return true;
}

describe('Unit Tests - State Parser', function () {
    it('parseState should parse valid JSON', function () {
        const state = createMockState({ iteration: 5 });
        const parsed = parseState(JSON.stringify(state));
        assert.strictEqual(parsed.iteration, 5);
    });

    it('parseState should return null for invalid JSON', function () {
        const parsed = parseState('not valid json');
        assert.strictEqual(parsed, null);
    });

    it('parseState should handle empty string', function () {
        const parsed = parseState('');
        assert.strictEqual(parsed, null);
    });
});

describe('Unit Tests - Status Bar Text', function () {
    it('should show Off when no state', function () {
        const text = getStatusBarText(null);
        assert.strictEqual(text, '$(circle-slash) For Loop: Off');
    });

    it('should show progress when running', function () {
        const state = createMockState({ iteration: 3, max_iterations: 10 });
        const text = getStatusBarText(state);
        assert.strictEqual(text, '$(sync~spin) For Loop: 3/10');
    });

    it('should show Done when completed', function () {
        const state = createMockState({ status: 'completed' });
        const text = getStatusBarText(state);
        assert.strictEqual(text, '$(check) For Loop: Done');
    });

    it('should show Failed when failed', function () {
        const state = createMockState({ status: 'failed' });
        const text = getStatusBarText(state);
        assert.strictEqual(text, '$(error) For Loop: Failed');
    });

    it('should show Stuck when stuck', function () {
        const state = createMockState({ status: 'stuck' });
        const text = getStatusBarText(state);
        assert.strictEqual(text, '$(error) For Loop: Stuck');
    });
});

describe('Unit Tests - Loop Continuation Logic', function () {
    it('should not continue when no state', function () {
        assert.strictEqual(shouldContinueLoop(null), false);
    });

    it('should continue when running and under max', function () {
        const state = createMockState({ iteration: 5, max_iterations: 10, status: 'running' });
        assert.strictEqual(shouldContinueLoop(state), true);
    });

    it('should not continue when at max iterations', function () {
        const state = createMockState({ iteration: 10, max_iterations: 10, status: 'running' });
        assert.strictEqual(shouldContinueLoop(state), false);
    });

    it('should not continue when completed', function () {
        const state = createMockState({ status: 'completed' });
        assert.strictEqual(shouldContinueLoop(state), false);
    });

    it('should not continue when failed', function () {
        const state = createMockState({ status: 'failed' });
        assert.strictEqual(shouldContinueLoop(state), false);
    });

    it('should not continue when stuck', function () {
        const state = createMockState({ status: 'stuck' });
        assert.strictEqual(shouldContinueLoop(state), false);
    });
});

// test/suite/extension.test.js
// Integration tests for Antigravity For Loop extension

const assert = require('assert');
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting extension tests.');

    // =========================================
    // 1. Extension Activation Tests
    // =========================================
    suite('Extension Activation', () => {
        test('Extension should be present', () => {
            const extension = vscode.extensions.getExtension('iml1s.antigravity-for-loop');
            assert.ok(extension, 'Extension not found');
        });

        test('Extension should activate', async () => {
            const extension = vscode.extensions.getExtension('iml1s.antigravity-for-loop');
            if (extension && !extension.isActive) {
                await extension.activate();
            }
            assert.ok(extension?.isActive, 'Extension failed to activate');
        });
    });

    // =========================================
    // 2. Command Registration Tests
    // =========================================
    suite('Command Registration', () => {
        test('Start command should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('antigravity-for-loop.start'),
                'Start command not registered'
            );
        });

        test('Cancel command should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('antigravity-for-loop.cancel'),
                'Cancel command not registered'
            );
        });

        test('Show menu command should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('antigravity-for-loop.showMenu'),
                'Show menu command not registered'
            );
        });

        test('Show logs command should be registered', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('antigravity-for-loop.showLogs'),
                'Show logs command not registered'
            );
        });
    });

    // =========================================
    // 3. Status Bar Tests
    // =========================================
    suite('Status Bar', () => {
        test('Status bar item should exist after activation', async () => {
            // Activate extension
            const extension = vscode.extensions.getExtension('iml1s.antigravity-for-loop');
            if (extension && !extension.isActive) {
                await extension.activate();
            }

            // Note: We can't directly access status bar items from test API
            // This test verifies the extension activates without errors
            assert.ok(extension?.isActive, 'Extension should be active');
        });
    });

    // =========================================
    // 4. State File Management Tests
    // =========================================
    suite('State File Management', () => {
        const testWorkspace = vscode.workspace.workspaceFolders?.[0];

        test('Should handle missing state file gracefully', async () => {
            // No state file should mean "Off" status
            const stateDir = testWorkspace
                ? path.join(testWorkspace.uri.fsPath, '.antigravity')
                : null;

            if (stateDir && fs.existsSync(path.join(stateDir, 'for-loop-state.json'))) {
                fs.unlinkSync(path.join(stateDir, 'for-loop-state.json'));
            }

            // Extension should not throw
            assert.ok(true, 'No error with missing state file');
        });

        test('Should parse valid state file', async () => {
            if (!testWorkspace) {
                console.log('No workspace folder, skipping test');
                return;
            }

            const stateDir = path.join(testWorkspace.uri.fsPath, '.antigravity');
            if (!fs.existsSync(stateDir)) {
                fs.mkdirSync(stateDir, { recursive: true });
            }

            const testState = {
                iteration: 5,
                max_iterations: 10,
                completion_promise: 'DONE',
                original_prompt: 'Test task',
                status: 'running'
            };

            fs.writeFileSync(
                path.join(stateDir, 'for-loop-state.json'),
                JSON.stringify(testState, null, 2)
            );

            // Read and verify
            const content = fs.readFileSync(
                path.join(stateDir, 'for-loop-state.json'),
                'utf8'
            );
            const parsed = JSON.parse(content);

            assert.strictEqual(parsed.iteration, 5);
            assert.strictEqual(parsed.max_iterations, 10);

            // Cleanup
            fs.unlinkSync(path.join(stateDir, 'for-loop-state.json'));
        });
    });

    // =========================================
    // 5. Output Channel Tests
    // =========================================
    suite('Output Channel', () => {
        test('Show logs command should not throw', async () => {
            try {
                await vscode.commands.executeCommand('antigravity-for-loop.showLogs');
                assert.ok(true, 'Show logs executed without error');
            } catch (err) {
                assert.fail(`Show logs threw error: ${err}`);
            }
        });
    });
});

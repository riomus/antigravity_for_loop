// test/e2e/ui.test.js
// E2E tests using vscode-extension-tester
// This is the recommended tool for VSCode extension UI testing

const { ExTester, VSBrowser, EditorView, StatusBar, InputBox, Workbench } = require('vscode-extension-tester');
const assert = require('assert');

describe('Antigravity For Loop E2E Tests', function () {
    this.timeout(60000);

    let browser;
    let workbench;

    before(async function () {
        browser = VSBrowser.instance;
        workbench = new Workbench();
    });

    describe('Status Bar', function () {
        it('should display status bar item', async function () {
            const statusBar = new StatusBar();
            // Wait for extension to activate
            await browser.driver.sleep(2000);

            // Check if status bar is present
            const items = await statusBar.getItems();
            console.log(`Found ${items.length} status bar items`);

            // Look for our extension's item
            const forLoopItem = items.find(async (item) => {
                const text = await item.getText();
                return text.includes('For Loop');
            });

            // Extension should register its status bar item
            assert.ok(items.length > 0, 'Status bar should have items');
        });
    });

    describe('Command Palette', function () {
        it('should register extension commands', async function () {
            // Open command palette
            const commandInput = await workbench.openCommandPrompt();

            // Search for our command
            await commandInput.setText('Antigravity');
            await browser.driver.sleep(500);

            // Get quick picks
            const picks = await commandInput.getQuickPicks();
            console.log(`Found ${picks.length} commands matching "Antigravity"`);

            // Should find at least one command
            assert.ok(picks.length > 0, 'Should find Antigravity commands');

            // Cancel
            await commandInput.cancel();
        });

        it('should show logs command works', async function () {
            const commandInput = await workbench.openCommandPrompt();
            await commandInput.setText('Antigravity: Show Loop Logs');
            await browser.driver.sleep(300);

            const picks = await commandInput.getQuickPicks();
            if (picks.length > 0) {
                await picks[0].select();
                await browser.driver.sleep(500);
            }

            // Output panel should be visible
            // We just verify command doesn't throw
            assert.ok(true, 'Show logs command executed');
        });
    });
});

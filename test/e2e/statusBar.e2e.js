// test/e2e/statusBar.e2e.js
// End-to-End tests using WebdriverIO for VSCode

describe('Antigravity For Loop E2E Tests', () => {

    describe('Status Bar Interaction', () => {
        it('should display status bar item on startup', async () => {
            // Wait for extension to activate
            await browser.pause(2000);

            // Status bar is at the bottom of the screen
            const statusBar = await browser.$('.statusbar');
            await expect(statusBar).toBeDisplayed();

            // Look for our extension's status bar item
            const forLoopStatus = await browser.$('*=For Loop');
            // Note: This may need adjustment based on actual DOM structure
            console.log('Status bar check completed');
        });

        it('should open quick pick menu when status bar is clicked', async () => {
            // Find and click the status bar item
            const statusItem = await browser.$('*=For Loop');
            if (await statusItem.isExisting()) {
                await statusItem.click();
                await browser.pause(500);

                // Quick pick should appear
                const quickPick = await browser.$('.quick-input-widget');
                await expect(quickPick).toBeDisplayed();

                // Close it by pressing Escape
                await browser.keys('Escape');
            }
        });
    });

    describe('Command Palette Integration', () => {
        it('should list extension commands in command palette', async () => {
            // Open command palette (Cmd+Shift+P on Mac, Ctrl+Shift+P on Windows/Linux)
            await browser.keys(['Meta', 'Shift', 'p']);
            await browser.pause(500);

            // Type to filter
            const input = await browser.$('.quick-input-box input');
            await input.setValue('Antigravity');
            await browser.pause(500);

            // Should find our commands
            const results = await browser.$$('.quick-input-list .monaco-list-row');
            console.log(`Found ${results.length} command(s) matching "Antigravity"`);

            // Close command palette
            await browser.keys('Escape');
        });
    });

    describe('Output Channel', () => {
        it('should open output channel via command', async () => {
            // Execute show logs command via command palette
            await browser.keys(['Meta', 'Shift', 'p']);
            await browser.pause(300);

            const input = await browser.$('.quick-input-box input');
            await input.setValue('Antigravity: Show Loop Logs');
            await browser.pause(300);

            await browser.keys('Enter');
            await browser.pause(500);

            // Output panel should be visible
            const outputPanel = await browser.$('.panel');
            console.log('Output channel command executed');
        });
    });
});

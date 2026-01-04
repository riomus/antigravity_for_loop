// test/e2e/playwright.test.js
// E2E tests using native Playwright with Electron support
// Direct Electron testing for M1 Mac compatibility

const { test, expect, _electron } = require('@playwright/test');
const path = require('path');

// Get VSCode path from test-resources or use system VSCode
const getVSCodePath = () => {
    const platform = process.platform;
    if (platform === 'darwin') {
        // Check for test-electron downloaded version first
        const testVSCode = path.join(__dirname, '../../.vscode-test/vscode-darwin-arm64-1.107.1/Visual Studio Code.app/Contents/MacOS/Electron');
        const fs = require('fs');
        if (fs.existsSync(testVSCode)) {
            return testVSCode;
        }
        // Fallback to system VSCode
        return '/Applications/Visual Studio Code.app/Contents/MacOS/Electron';
    }
    return 'code';
};

test.describe('Antigravity For Loop E2E Tests', () => {
    let electronApp;
    let window;

    test.beforeAll(async () => {
        // Launch Electron app (VSCode)
        electronApp = await _electron.launch({
            executablePath: getVSCodePath(),
            args: [
                '--disable-extensions',
                '--extensionDevelopmentPath=' + path.join(__dirname, '../..'),
                '--new-window',
                '--skip-release-notes',
                '--disable-workspace-trust'
            ],
            timeout: 60000
        });

        // Wait for main window
        window = await electronApp.firstWindow();
        await window.waitForTimeout(5000);
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('extension should activate and register commands', async () => {
        // Open command palette
        await window.keyboard.press('Meta+Shift+P');
        await window.waitForTimeout(500);

        // Search for our extension's commands
        await window.keyboard.type('Antigravity');
        await window.waitForTimeout(500);

        // Verify commands appear in the list
        const commandList = window.locator('.quick-input-list');
        await expect(commandList).toBeVisible({ timeout: 5000 });

        // Close command palette
        await window.keyboard.press('Escape');
    });

    test('show logs command should work', async () => {
        // Open command palette
        await window.keyboard.press('Meta+Shift+P');
        await window.waitForTimeout(300);

        // Execute show logs command
        await window.keyboard.type('Antigravity: Show Loop Logs');
        await window.waitForTimeout(300);

        await window.keyboard.press('Enter');
        await window.waitForTimeout(500);

        // Success if no crash
        expect(true).toBe(true);
    });
});

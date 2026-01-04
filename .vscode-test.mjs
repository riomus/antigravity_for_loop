// @ts-check
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
    files: 'test/suite/**/*.test.js',
    version: 'stable',
    workspaceFolder: './',
    mocha: {
        ui: 'tdd',
        timeout: 60000
    }
});

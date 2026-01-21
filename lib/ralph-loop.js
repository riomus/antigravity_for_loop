/**
 * Ralph Loop for Antigravity
 *
 * Inspired by Claude Code's Ralph Wiggum technique:
 * A continuous loop that keeps feeding prompts to the AI until
 * the task is complete (test passes) or max iterations reached.
 *
 * Key difference from Claude Code:
 * - Claude Code: CLI-based, uses Stop hook + exit code 2
 * - Antigravity: GUI-based, uses CDP to inject prompts into chat panel
 */

const { exec } = require('child_process');
const path = require('path');

class RalphLoop {
    constructor(cdpManager, outputChannel, options = {}) {
        this.cdp = cdpManager;
        this.output = outputChannel;
        this.options = {
            maxIterations: options.maxIterations || 10,
            testCommand: options.testCommand || null,
            completionPromise: options.completionPromise || 'DONE',
            taskDescription: options.taskDescription || '',
            workspacePath: options.workspacePath || process.cwd(),
            pollInterval: options.pollInterval || 2000,      // How often to check AI status
            aiTimeout: options.aiTimeout || 3000000,          // Max time to wait for AI (5 min)
            autoAcceptInterval: options.autoAcceptInterval || 500,
            customInstructions: options.customInstructions || null,
            promptTemplate: options.promptTemplate || null,
            checkPrompt: options.checkPrompt || null,
            checkCompletionPromise: options.checkCompletionPromise || null,
            checkPrompt: options.checkPrompt || null,
            successKeyword: options.successKeyword || 'PASS',
            quotaCheckEnabled: options.quotaCheckEnabled !== false, // Default true
            quotaCheckInterval: options.quotaCheckInterval || 60000, // Default 60s
            quotaDefaultWait: options.quotaDefaultWait || 30 * 60000, // Default 30m
            preStartPrompt: options.preStartPrompt || null,
            preIterationPrompt: options.preIterationPrompt || null,
            preIterationPrompt: options.preIterationPrompt || null,
            postIterationPrompt: options.postIterationPrompt || null,
            preStopPrompt: options.preStopPrompt || null
        };

        this.isRunning = false;
        this.isPaused = false;
        this.currentIteration = 0;
        this.lastError = null;
        this.autoAcceptTimer = null;
        this.logs = []; // Store recent logs
        this.onProgress = options.onProgress || (() => { });
        this.onComplete = options.onComplete || (() => { });
    }

    /**
     * Log a message to output and state
     */
    log(message) {
        // Timestamp
        const timestamp = new Date().toLocaleTimeString();
        const fullMessage = `[${timestamp}] ${message}`;

        // Output channel
        this.output.appendLine(message); // Keep original format for channel

        // Store for UI
        this.logs.push(fullMessage);
        if (this.logs.length > 50) this.logs.shift(); // Keep last 50
    }

    /**
     * Build the prompt for each iteration
     */
    buildPrompt(iteration) {
        let template = this.options.promptTemplate || RalphLoop.DEFAULT_PROMPT_TEMPLATE;

        // Variables for substitution
        const variables = {
            iteration: iteration,
            maxIterations: this.options.maxIterations,
            taskDescription: this.options.taskDescription || '',
            testCommand: this.options.testCommand ? `3. Run: ${this.options.testCommand}\n4. If tests fail, analyze errors and fix` : '3. Verify your changes',
            rawTestCommand: this.options.testCommand || '',
            completionPromise: this.options.completionPromise || 'DONE',
            customInstructions: this.options.customInstructions ? `\nIMPORTANT ADDITIONAL RULES:\n${this.options.customInstructions}` : '',
            lastError: ''
        };

        // Construct last error block if exists
        if (this.lastError && iteration > 1) {
            variables.lastError = `PREVIOUS ATTEMPT FAILED:\n\`\`\`\n${this.lastError.substring(0, 2000)}\n\`\`\`\n\nFix the issues above and try again.\n`;
        }

        // Replace all {{tokens}}
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            template = template.replace(regex, variables[key]);
        });

        return template;
    }

    static get DEFAULT_PROMPT_TEMPLATE() {
        return `[ITERATION {{iteration}}/{{maxIterations}}]

TASK: {{taskDescription}}

{{lastError}}
INSTRUCTIONS:
1. Analyze the current state
2. Make necessary code changes
{{testCommand}}

{{customInstructions}}

When the task is fully complete and all tests pass, respond with exactly: {{completionPromise}}`;
    }

    /**
     * Run the test command and return result
     */
    async runTestCommand() {
        if (!this.options.testCommand) {
            return { success: true, exitCode: 0, output: '' };
        }

        return new Promise((resolve) => {
            this.log(`[Ralph] Running: ${this.options.testCommand}`);

            exec(this.options.testCommand, {
                cwd: this.options.workspacePath,
                timeout: 120000, // 2 minute timeout
                maxBuffer: 1024 * 1024 * 10 // 10MB
            }, (error, stdout, stderr) => {
                const exitCode = error ? error.code || 1 : 0;
                const output = stdout + '\n' + stderr;

                if (exitCode === 0) {
                    this.log('[Ralph] Test PASSED!');
                    resolve({ success: true, exitCode: 0, output });
                } else {
                    this.log(`[Ralph] Test FAILED (exit code: ${exitCode})`);
                    resolve({ success: false, exitCode, output, error: stderr || stdout });
                }
            });
        });
    }

    /**
     * Wait for AI to finish responding
     * Returns the AI's response text
     */
    async waitForAICompletion() {
        const startTime = Date.now();
        let lastMessageCount = 0;
        let stableCount = 0;
        const stabilityThreshold = 3; // Need 3 consecutive stable checks

        this.log('[Ralph] Waiting for AI response...');

        while (Date.now() - startTime < this.options.aiTimeout) {
            await this.sleep(this.options.pollInterval);

            // Check if AI is still responding by looking at message count
            const status = await this.getAIStatus();
            this.log(`[Ralph] AI status: ${JSON.stringify(status)}`);

            if (status.messageCount === lastMessageCount) {
                stableCount++;
                if (stableCount >= stabilityThreshold && !status.isTyping) {
                    // AI seems to have finished
                    this.log('[Ralph] AI response complete');
                    return status.lastMessage;
                }
            } else {
                stableCount = 0;
                lastMessageCount = status.messageCount;
            }

            // Check for completion promise in output
            if (status.lastMessage && status.lastMessage.includes(this.options.completionPromise)) {
                this.log(`[Ralph] Found completion promise: ${this.options.completionPromise}`);
                return status.lastMessage;
            }
        }

        this.log('[Ralph] AI response timeout');
        return null;
    }

    /**
     * Get AI status from the chat panel
     */
    async getAIStatus() {
        try {
            const result = await this.cdp.sendCommand('Runtime.evaluate', {
                expression: `
                    (function() {
                        const iframe = document.getElementById('antigravity.agentPanel') || document;
                        if (!iframe) return { error: 'no iframe' };
                        const doc = iframe.contentDocument || document;
                        if (!doc) return { error: 'no doc' };

                        // Count messages in chat
                        const messagesContainer = doc.querySelector("#cascade>.overflow-hidden")
                        const messages = messagesContainer.querySelectorAll('.flex.flex-col >.prose:last-child');

                        // Get last message text
                        let lastMessage = '';
                        if (messages.length > 0) {
                            const last = messages[messages.length -1];
                            lastMessage = last.textContent || '';
                        }

                        // Check if AI is currently typing/thinking
                        const isTyping = !!doc.querySelector('[class*="typing"], [class*="loading"], [class*="thinking"], [data-tooltip-id="input-send-button-cancel-tooltip"]');

                        return {
                            messageCount: messages.length,
                            lastMessage: lastMessage.substring(0, 500),
                            isTyping
                        };
                    })()
                `,
                returnByValue: true
            });

            return result?.result?.value || { messageCount: 0, lastMessage: '', isTyping: false };
        } catch (e) {
            return { messageCount: 0, lastMessage: '', isTyping: false, error: e.message };
        }
    }

    /**
     * Check if model quota limit is exceeded
     * Returns { exceeded: true, resumeDate: Date, message: string } or { exceeded: false }
     */
    async checkQuotaExceeded() {
        if (!this.options.quotaCheckEnabled) return { exceeded: false };

        try {
            const result = await this.cdp.sendCommand('Runtime.evaluate', {
                expression: `
                    (function() {
                        const iframe = document.getElementById('antigravity.agentPanel') || document;
                        const doc = iframe.contentDocument || iframe.contentWindow?.document || document;
                        const text = doc.body ? doc.body.innerText : '';
                        
                        // Look for "Model quota limit exceeded"
                        if (text.includes('Model quota limit exceeded')) {
                            // Pattern: "You can resume using this model at 1/16/2026, 5:11:09 PM"
                            const match = text.match(/You can resume using this model at ([0-9\/]+, [0-9:]+\s*[AP]M)/i);
                            return { 
                                exceeded: true, 
                                resumeDateStr: match ? match[1] : null,
                                message: 'Model quota limit exceeded'
                            };
                        }
                        return { exceeded: false };
                    })()
                `,
                returnByValue: true
            });

            const value = result?.result?.value;
            if (value && value.exceeded) {
                let resumeDate = null;
                if (value.resumeDateStr) {
                    resumeDate = new Date(value.resumeDateStr);
                }
                return { exceeded: true, resumeDate, message: value.message };
            }
        } catch (e) {
            // Ignore errors during check
        }
        return { exceeded: false };
    }

    /**
     * Start auto-accept loop
     */
    startAutoAccept() {
        if (this.autoAcceptTimer) return;

        this.autoAcceptTimer = setInterval(async () => {
            if (!this.isRunning || this.isPaused) return;
            //this.log('[Ralph] Auto-accepting...');
            try {
                await this.cdp.clickAcceptButtons();
            } catch (e) {
                // Silent fail
            }
        }, this.options.autoAcceptInterval);

        this.log('[Ralph] Auto-accept started');
    }

    /**
     * Stop auto-accept loop
     */
    stopAutoAccept() {
        if (this.autoAcceptTimer) {
            clearInterval(this.autoAcceptTimer);
            this.autoAcceptTimer = null;
        }
        this.log('[Ralph] Auto-accept stopped');
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Pause the loop
     */
    pause() {
        if (this.isRunning && !this.isPaused) {
            this.isPaused = true;
            this.log('[Ralph] Loop PAUSED');
            return true;
        }
        return false;
    }

    /**
     * Resume the loop
     */
    resume() {
        if (this.isRunning && this.isPaused) {
            this.isPaused = false;
            this.log('[Ralph] Loop RESUMED');
            return true;
        }
        return false;
    }

    /**
     * Wait while paused
     */
    async waitForResume() {
        while (this.isRunning && this.isPaused) {
            await this.sleep(500);
        }
    }

    /**
     * Manage quota limit: check, wait, and resume
     */
    async manageQuota() {
        if (!this.options.quotaCheckEnabled) return;

        // Check for quota limit
        let quota = await this.checkQuotaExceeded();
        if (quota.exceeded) {
            this.log(`[Ralph] ${quota.message}`);
            let waitTime = this.options.quotaCheckInterval;

            while (this.isRunning) {
                // Calculate remaining time
                let remainingMsg = '';
                let targetTime = null;

                if (quota.resumeDate) {
                    targetTime = quota.resumeDate;
                    remainingMsg = ` (Resuming at ${quota.resumeDate.toLocaleTimeString()})`;
                } else {
                    // Fallback wait time
                    targetTime = new Date(Date.now() + this.options.quotaDefaultWait);
                    remainingMsg = ` (No resume date found. Waiting ${Math.round(this.options.quotaDefaultWait / 60000)}m)`;
                }

                const now = new Date();
                const diff = targetTime - now;

                if (diff <= 0) {
                    this.log('[Ralph] Quota wait time over. Resuming session...');

                    // Re-check strictly
                    const recheck = await this.checkQuotaExceeded();
                    if (recheck.exceeded) {
                        this.log('[Ralph] Quota still exceeded. Waiting again...');
                        // Update target time for next loop if needed, or just let loop recalculate
                        if (recheck.resumeDate) {
                            quota.resumeDate = recheck.resumeDate;
                        } else {
                            // Reset default wait? logic will pick up new default wait
                            quota.resumeDate = null;
                        }
                        continue;
                    } else {
                        // Quota clear. Inject continue
                        this.log("[Ralph] Resumed. Sending 'continue'...");
                        this.onProgress({
                            iteration: this.currentIteration,
                            maxIterations: this.options.maxIterations,
                            status: 'running',
                            lastError: null,
                            message: 'Resuming session...',
                            logs: this.logs
                        });

                        await this.cdp.injectPrompt('continue');
                        // Wait for response to 'continue' before proceeding to next iteration
                        await this.waitForAICompletion();
                        break;
                    }
                }

                let waitTime = Math.min(diff, this.options.quotaCheckInterval);
                const minutes = Math.ceil(diff / 60000); // Minutes remaining

                if (quota.resumeDate) {
                    remainingMsg = ` (Resuming in ~${minutes} min at ${quota.resumeDate.toLocaleTimeString()})`;
                } else {
                    remainingMsg = ` (Waiting fallback ~${minutes} min)`;
                }

                this.onProgress({
                    iteration: this.currentIteration,
                    maxIterations: this.options.maxIterations,
                    status: 'waiting',
                    lastError: 'Model quota exceeded',
                    message: `Waiting for quota...${remainingMsg}`,
                    logs: this.logs
                });

                this.log(`[Ralph] Waiting for quota... next check in ${Math.round(waitTime / 1000)}s`);
                await this.sleep(waitTime);

                // Re-check just in case text disappears
                const newQuota = await this.checkQuotaExceeded();
                if (!newQuota.exceeded) {
                    this.log('[Ralph] Quota warning disappeared. Resuming...');
                    // Determine if we need to send continue? 
                    // If text disappears, it means we can probably type.
                    // Inject continue anyway to be safe and prompt model to work
                    this.log("[Ralph] Resumed. Sending 'continue'...");
                    await this.cdp.injectPrompt('continue');
                    await this.waitForAICompletion();
                    break;
                }
                // If exceeded but resume date changed?
                if (newQuota.resumeDate && (!quota.resumeDate || newQuota.resumeDate.getTime() !== quota.resumeDate.getTime())) {
                    this.log(`[Ralph] Quota update: Resuming at ${newQuota.resumeDate.toLocaleTimeString()}`);
                    quota.resumeDate = newQuota.resumeDate; // Update date and recalculate
                }
            }
        }
    }

    /**
     * Main loop - Ralph Wiggum style!
     */
    async start() {
        if (this.isRunning) {
            this.log('[Ralph] Loop already running');
            return { success: false, error: 'Already running' };
        }

        this.isRunning = true;
        this.isPaused = false;
        this.currentIteration = 0;
        this.lastError = null;

        this.output.appendLine('╔════════════════════════════════════════════════════════════╗');
        this.output.appendLine('║           RALPH LOOP FOR ANTIGRAVITY                       ║');
        this.output.appendLine('╚════════════════════════════════════════════════════════════╝');
        this.output.appendLine(`Task: ${this.options.taskDescription}`);
        this.output.appendLine(`Test: ${this.options.testCommand || '(none - using completion promise)'}`);
        this.output.appendLine(`Max Iterations: ${this.options.maxIterations}`);
        this.output.appendLine(`Completion Promise: ${this.options.completionPromise}`);
        if (this.options.checkPrompt) {
            this.output.appendLine(`Check Prompt: "${this.options.checkPrompt}"`);
            this.output.appendLine(`Success Keyword: "${this.options.successKeyword}"`);
        }
        this.output.appendLine('');

        // Start auto-accept
        this.startAutoAccept();

        try {
            // Connect to CDP
            const connected = await this.cdp.tryConnect();
            if (!connected) {
                throw new Error('Could not connect to CDP. Is Antigravity running with --remote-debugging-port=9000?');
            }

            // Pre-Start Prompt
            if (this.options.preStartPrompt) {
                this.log(`[Ralph] Running Pre-Start Prompt: "${this.options.preStartPrompt}"`);

                let finalPreStartPrompt = this.options.preStartPrompt;
                const descriptors = {
                    taskDescription: this.options.taskDescription || '',
                    maxIterations: this.options.maxIterations,
                };
                Object.keys(descriptors).forEach(key => {
                    const regex = new RegExp(`{{${key}}}`, 'g');
                    finalPreStartPrompt = finalPreStartPrompt.replace(regex, descriptors[key]);
                });

                this.onProgress({
                    iteration: 0,
                    maxIterations: this.options.maxIterations,
                    status: 'running',
                    lastError: null,
                    message: `Running pre-start prompt: ${finalPreStartPrompt.substring(0, 50)}...`,
                    logs: this.logs
                });

                const injectResult = await this.cdp.injectPrompt(finalPreStartPrompt);

                if (injectResult.success) {
                    await this.waitForAICompletion();
                } else {
                    this.log(`[Ralph] Pre-start inject failed: ${injectResult.error}`);
                }
            }

            // Main loop
            for (this.currentIteration = 1; this.currentIteration <= this.options.maxIterations; this.currentIteration++) {
                // Check if paused
                if (this.isPaused) {
                    this.onProgress({
                        iteration: this.currentIteration,
                        maxIterations: this.options.maxIterations,
                        status: 'paused',
                        lastError: this.lastError,
                        message: 'Loop paused...'
                    });
                    await this.waitForResume();
                }

                if (!this.isRunning) {
                    this.log('[Ralph] Loop cancelled');
                    break;
                }

                this.log(`\n━━━ ITERATION ${this.currentIteration}/${this.options.maxIterations} ━━━`);
                this.onProgress({
                    iteration: this.currentIteration,
                    maxIterations: this.options.maxIterations,
                    status: 'running',
                    lastError: this.lastError,
                    message: this.lastError ? 'Retrying after failure...' : 'Starting iteration...',
                    logs: this.logs
                });

                // Pre-Iteration Prompt
                if (this.options.preIterationPrompt) {
                    this.log(`[Ralph] Running Pre-Iteration Prompt: "${this.options.preIterationPrompt}"`);

                    let finalPrePrompt = this.options.preIterationPrompt;
                    const variables = {
                        iteration: this.currentIteration,
                        maxIterations: this.options.maxIterations,
                        taskDescription: this.options.taskDescription || '',
                    };
                    Object.keys(variables).forEach(key => {
                        const regex = new RegExp(`{{${key}}}`, 'g');
                        finalPrePrompt = finalPrePrompt.replace(regex, variables[key]);
                    });

                    this.log(`[Ralph] Injecting pre-iteration prompt: ${finalPrePrompt}`);
                    const injectResult = await this.cdp.injectPrompt(finalPrePrompt);

                    if (injectResult.success) {
                        await this.waitForAICompletion();
                    } else {
                        this.log(`[Ralph] Pre-iteration inject failed: ${injectResult.error}`);
                    }
                }

                // Step 1: Build and inject prompt
                const prompt = this.buildPrompt(this.currentIteration);
                this.log('[Ralph] Injecting prompt...');

                const injectResult = await this.cdp.injectPrompt(prompt);
                if (!injectResult.success) {
                    this.log(`[Ralph] Inject failed: ${injectResult.error}`);
                    this.onProgress({
                        iteration: this.currentIteration,
                        maxIterations: this.options.maxIterations,
                        status: 'error',
                        lastError: injectResult.error,
                        message: 'Injection failed, retrying...',
                        logs: this.logs
                    });
                    await this.sleep(2000);

                    await this.manageQuota();
                    continue;
                }

                // Step 2: Wait for AI to respond
                const aiResponse = await this.waitForAICompletion();
                this.log(`[Ralph] AI response: ${aiResponse}`);

                let isTaskComplete = false;
                let completionMessage = '';

                // Step 3: Check for completion promise in AI response
                if (aiResponse && aiResponse.includes(this.options.completionPromise)) {
                    // Verify with prompt check if configured
                    if (this.options.checkPrompt) {
                        this.log('[Ralph] Running Check Prompt...');

                        // Inject check prompt
                        const checkInject = await this.cdp.injectPrompt(this.options.checkPrompt);
                        if (!checkInject.success) {
                            this.log(`[Ralph] Check inject failed: ${checkInject.error}`);
                            this.lastError = `Check prompt injection failed: ${checkInject.error}`;
                            continue;
                        }

                        // Wait for check result
                        const checkResponse = await this.waitForAICompletion();
                        this.log(`[Ralph] Check response: ${checkResponse}`);
                        this.log('[Ralph] Running verification prompt...');
                        const verifyResult = await this.cdp.injectPrompt(this.options.checkPrompt);

                        if (!verifyResult.success) {
                            this.log(`[Ralph] Verification inject failed: ${verifyResult.error}`);
                            // If we can't verify, should we fail or continue? 
                            // Let's assume we treat it as an error and continue (retry loop)
                            this.lastError = "Verification injection failed";
                            continue;
                        }

                        const verifyResponse = await this.waitForAICompletion();
                        this.log(`[Ralph] Verification response: ${verifyResponse}`);

                        const expectedPromise = this.options.checkCompletionPromise || 'VERIFIED';
                        if (verifyResponse && verifyResponse.includes(expectedPromise)) {
                            this.log(`[Ralph] Verification successful (${expectedPromise})`);
                            // Proceed to test command or finish
                        } else {
                            this.log(`[Ralph] Verification FAILED (Did not find "${expectedPromise}")`);
                            this.lastError = `Self-verification failed. AI did not confirm with "${expectedPromise}".`;
                            continue;
                        }
                    }

                    // Verify with test command if configured
                    if (this.options.testCommand) {
                        const testResult = await this.runTestCommand();
                        if (testResult.success) {
                            return this.complete(true, 'Task completed successfully!');
                        } else {
                            this.log('[Ralph] AI claimed done but tests still fail');
                            this.lastError = testResult.error;
                            continue;
                        }
                    } else {
                        return this.complete(true, 'Task completed (AI signaled DONE)');
                    }
                }

                // Step 4: Run test command
                if (!isTaskComplete && this.options.testCommand) {
                    const testResult = await this.runTestCommand();
                    if (testResult.success) {
                        isTaskComplete = true;
                        completionMessage = 'All tests pass!';
                    } else {
                        this.lastError = testResult.error;
                    }
                }

                // Post-Iteration Prompt
                if (this.options.postIterationPrompt) {
                    this.log(`[Ralph] Running Post-Iteration Prompt: "${this.options.postIterationPrompt}"`);

                    let finalPostPrompt = this.options.postIterationPrompt;
                    const variables = {
                        iteration: this.currentIteration,
                        maxIterations: this.options.maxIterations,
                        taskDescription: this.options.taskDescription || '',
                    };
                    Object.keys(variables).forEach(key => {
                        const regex = new RegExp(`{{${key}}}`, 'g');
                        finalPostPrompt = finalPostPrompt.replace(regex, variables[key]);
                    });

                    const injectResult = await this.cdp.injectPrompt(finalPostPrompt);
                    if (injectResult.success) {
                        await this.waitForAICompletion();
                    } else {
                        this.log(`[Ralph] Post-iteration inject failed: ${injectResult.error}`);
                    }
                }

                if (isTaskComplete) {
                    return this.complete(true, completionMessage);
                }

                // Small delay before next iteration
                await this.sleep(1000);

                if (this.currentIteration < this.options.maxIterations) {
                    await this.manageQuota();
                }
            }

            // Max iterations reached
            return this.complete(false, `Max iterations (${this.options.maxIterations}) reached`);

        } catch (error) {
            this.log(`[Ralph] Error: ${error.message}`);
            return this.complete(false, error.message);
        } finally {
            this.stopAutoAccept();
            this.isRunning = false;
        }
    }

    /**
     * Complete the loop
     */
    async complete(success, message) {
        // Pre-Stop Prompt
        if (this.options.preStopPrompt) {
            this.log(`[Ralph] Running Pre-Stop Prompt: "${this.options.preStopPrompt}"`);

            let finalStopPrompt = this.options.preStopPrompt;
            const variables = {
                status: success ? 'SUCCESS' : 'FAILURE',
                message: message || '',
                iterations: this.currentIteration,
                maxIterations: this.options.maxIterations,
                taskDescription: this.options.taskDescription || '',
            };
            Object.keys(variables).forEach(key => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                finalStopPrompt = finalStopPrompt.replace(regex, variables[key]);
            });

            try {
                const injectResult = await this.cdp.injectPrompt(finalStopPrompt);
                if (injectResult.success) {
                    await this.waitForAICompletion();
                } else {
                    this.log(`[Ralph] Pre-stop inject failed: ${injectResult.error}`);
                }
            } catch (e) {
                this.log(`[Ralph] Error running pre-stop prompt: ${e.message}`);
            }
        }

        this.isRunning = false;
        this.stopAutoAccept();

        this.output.appendLine('');
        this.output.appendLine('╔════════════════════════════════════════════════════════════╗');
        if (success) {
            this.output.appendLine('║  ✅ LOOP COMPLETE - SUCCESS                                ║');
        } else {
            this.output.appendLine('║  ❌ LOOP COMPLETE - FAILED                                 ║');
        }
        this.output.appendLine('╚════════════════════════════════════════════════════════════╝');
        this.log(`Iterations: ${this.currentIteration}/${this.options.maxIterations}`);
        this.log(`Result: ${message}`);

        const result = {
            success,
            message,
            iterations: this.currentIteration,
            maxIterations: this.options.maxIterations,
            logs: this.logs
        };

        this.onComplete(result);
        return result;
    }

    /**
     * Cancel the loop
     */
    cancel() {
        this.log('[Ralph] Cancelling loop...');
        this.isRunning = false;
        this.stopAutoAccept();
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            currentIteration: this.currentIteration,
            maxIterations: this.options.maxIterations,
            lastError: this.lastError
        };
    }
}

module.exports = { RalphLoop };

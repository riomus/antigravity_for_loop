/**
 * CDP Manager for Antigravity For Loop
 * Connects to Antigravity IDE's webview via Chrome DevTools Protocol
 * to inject prompts directly into the AI chat interface.
 *
 * Based on: antigravity-plus/src/core/auto-approve/cdp-manager.ts
 */

const http = require('http');
const WebSocket = require('ws');

class CDPManager {
    constructor(logger) {
        this.logger = logger || console;
        this.isConnectorActive = false;
        this.connectedSocket = null;
        this.portRange = [9001, 9003];
        this.msgId = 1;
        this.scriptInjected = false;
    }

    /**
     * Try to connect to CDP and inject the prompt helper script
     * @returns {Promise<boolean>} Whether connection succeeded
     */
    async tryConnect() {
        if (this.isConnectorActive && this.connectedSocket?.readyState === WebSocket.OPEN) {
            this.logger.log('[CDP] Already connected');
            return true;
        }

        const port = await this.findAvailableCDPPort();
        if (port) {
            this.logger.log(`[CDP] Found port: ${port}`);
            try {
                const target = await this.findPageTarget(port);
                if (target && target.webSocketDebuggerUrl) {
                    this.logger.log('[CDP] Found target ' + target.webSocketDebuggerUrl);
                    await this.connectToWebSocket(target.webSocketDebuggerUrl);
                    this.logger.log('[CDP] Connected to WebSocket');
                    if (!this.scriptInjected) {
                        this.logger.log('[CDP] Injecting helper script');
                        await this.injectHelperScript();
                        this.logger.log('[CDP] Helper script injected');
                        this.scriptInjected = true;
                    } else {
                        this.logger.log('[CDP] Script already injected');
                    }
                    return true;
                } else {
                    this.logger.log('[CDP] No target found');
                }
            } catch (e) {
                this.logger.log(`[CDP] Connection failed: ${e.message}`);
            }
        }
        return false;
    }

    /**
     * Scan port range for available CDP endpoint
     */
    async findAvailableCDPPort() {
        for (let port = this.portRange[0]; port <= this.portRange[1]; port++) {
            if (await this.checkPort(port)) {
                return port;
            }
        }
        return null;
    }

    /**
     * Check if a port has a CDP endpoint
     */
    checkPort(port) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 1000);
            const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
                clearTimeout(timeout);
                resolve(res.statusCode === 200);
            });
            req.on('error', () => {
                clearTimeout(timeout);
                resolve(false);
            });
            req.setTimeout(1000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    /**
     * Find a page/webview target on the CDP endpoint
     */
    findPageTarget(port) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => resolve(undefined), 2000);
            const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    clearTimeout(timeout);
                    try {
                        const targets = JSON.parse(data);
                        // Look for page or webview targets
                        for (const target of targets) {
                            this.logger.log('[CDP] Found target ' + target);
                        }
                        const target = targets.find(t =>
                            t.webSocketDebuggerUrl &&
                            (t.type === 'page' || t.type === 'webview') && !t.title.includes('Launchpad')
                        );
                        resolve(target);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', (e) => {
                clearTimeout(timeout);
                reject(e);
            });
            req.setTimeout(2000, () => {
                req.destroy();
                resolve(undefined);
            });
        });
    }

    /**
     * Connect to the WebSocket CDP endpoint
     */
    connectToWebSocket(url) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.logger.log('[CDP] WebSocket connection timeout');
                reject(new Error('WebSocket connection timeout'));
            }, 5000);

            this.connectedSocket = new WebSocket(url);

            this.connectedSocket.on('open', () => {
                clearTimeout(timeout);
                this.isConnectorActive = true;
                this.logger.log('[CDP] WebSocket connected');
                resolve();
            });

            this.connectedSocket.on('error', (e) => {
                clearTimeout(timeout);
                this.logger.log(`[CDP] WebSocket error: ${e.message}`);
                this.isConnectorActive = false;
                reject(e);
            });

            this.connectedSocket.on('close', () => {
                this.isConnectorActive = false;
                this.scriptInjected = false;
                this.logger.log('[CDP] WebSocket closed');
            });
        });
    }

    /**
     * Inject the helper script that provides prompt injection capability
     */
    async injectHelperScript() {
        const script = `
        (function() {
            if (window.__antigravityForLoop) {
                console.log('[For Loop] Helper already injected');
                return;
            }

            window.__antigravityForLoop = {
                lastInjectionResult: null,

                // Get all documents including iframes
                getDocuments: function(root = document) {
                    let docs = [root];
                    try {
                        const iframes = root.querySelectorAll('iframe, frame');
                        for (const iframe of iframes) {
                            try {
                                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                                if (iframeDoc) {
                                    docs.push(...this.getDocuments(iframeDoc));
                                }
                            } catch (e) {}
                        }
                    } catch (e) {}
                    return docs;
                },

                // Query all documents
                queryAll: function(selector) {
                    const results = [];
                    this.getDocuments().forEach(doc => {
                        try {
                            results.push(...Array.from(doc.querySelectorAll(selector)));
                        } catch (e) {}
                    });
                    return results;
                },

                // Find the chat input element using various strategies
                findChatInput: function() {
                    // Strategy 0: Antigravity iframe - MUST check first!
                    // The chat panel is inside an iframe with id="antigravity.agentPanel"
                    const antigravityIframe = document.getElementById('antigravity.agentPanel');
                    if (antigravityIframe && antigravityIframe.tagName === 'IFRAME') {
                        try {
                            const iframeDoc = antigravityIframe.contentDocument || antigravityIframe.contentWindow?.document;
                            if (iframeDoc) {
                                // Antigravity uses Lexical editor - look for [data-lexical-editor="true"] first
                                const lexicalEditor = iframeDoc.querySelector('[data-lexical-editor="true"]');
                                if (lexicalEditor && this.isElementVisible(lexicalEditor)) {
                                    console.log('[For Loop] Found Lexical editor in antigravity.agentPanel iframe');
                                    // Store the document reference for later use
                                    lexicalEditor._iframeDoc = iframeDoc;
                                    return lexicalEditor;
                                }
                                // Fallback to contenteditable with role=textbox
                                const editable = iframeDoc.querySelector('[contenteditable="true"][role="textbox"]');
                                if (editable && this.isElementVisible(editable)) {
                                    console.log('[For Loop] Found contenteditable textbox in antigravity.agentPanel iframe');
                                    editable._iframeDoc = iframeDoc;
                                    return editable;
                                }
                                // Also try textarea as fallback (but NOT ime-text-area)
                                const textareas = iframeDoc.querySelectorAll('textarea:not(.ime-text-area)');
                                for (const textarea of textareas) {
                                    if (this.isElementVisible(textarea)) {
                                        console.log('[For Loop] Found textarea in antigravity.agentPanel iframe');
                                        textarea._iframeDoc = iframeDoc;
                                        return textarea;
                                    }
                                }
                            }
                        } catch (e) {
                            console.log('[For Loop] Cannot access antigravity iframe:', e.message);
                        }
                    }

                    // Strategy 1: Known Antigravity selectors (based on competitor analysis)
                    const antigravitySelectors = [
                        '.agent-panel textarea',
                        '.agent-panel [contenteditable="true"]',
                        '.chat-input textarea',
                        '.chat-input [contenteditable="true"]',
                        '.message-input textarea',
                        '.message-input [contenteditable="true"]',
                    ];

                    for (const selector of antigravitySelectors) {
                        const elements = this.queryAll(selector);
                        const visible = elements.find(el => this.isElementVisible(el));
                        if (visible) {
                            console.log('[For Loop] Found input via Antigravity selector:', selector);
                            return visible;
                        }
                    }

                    // Strategy 2: Generic textarea in auxiliary/panel area
                    const genericSelectors = [
                        '#workbench\\\\.parts\\\\.auxiliarybar textarea',
                        '#workbench\\\\.parts\\\\.auxiliarybar [contenteditable="true"]',
                        '.monaco-workbench textarea',
                        'textarea[placeholder*="message"]',
                        'textarea[placeholder*="prompt"]',
                        'textarea[placeholder*="ask"]',
                        'textarea[placeholder*="type"]',
                        '[contenteditable="true"][role="textbox"]',
                        '[data-testid*="input"]',
                        '[data-testid*="chat"]',
                    ];

                    for (const selector of genericSelectors) {
                        const elements = this.queryAll(selector);
                        const visible = elements.find(el => this.isElementVisible(el));
                        if (visible) {
                            console.log('[For Loop] Found input via generic selector:', selector);
                            return visible;
                        }
                    }

                    // Strategy 3: Find any visible textarea/contenteditable and filter
                    const allInputs = [
                        ...this.queryAll('textarea'),
                        ...this.queryAll('[contenteditable="true"]')
                    ];

                    for (const el of allInputs) {
                        if (!this.isElementVisible(el)) continue;

                        // Skip if it's clearly not a chat input
                        const rect = el.getBoundingClientRect();
                        if (rect.width < 100 || rect.height < 20) continue;

                        // Prefer elements in the right side of the screen (auxiliary bar)
                        if (rect.left > window.innerWidth * 0.5) {
                            console.log('[For Loop] Found input via position heuristic');
                            return el;
                        }
                    }

                    // Strategy 4: Last resort - any visible large textarea
                    for (const el of allInputs) {
                        if (this.isElementVisible(el)) {
                            const rect = el.getBoundingClientRect();
                            if (rect.width >= 100 && rect.height >= 20) {
                                console.log('[For Loop] Found input via fallback');
                                return el;
                            }
                        }
                    }

                    console.log('[For Loop] No chat input found');
                    return null;
                },

                // Check if element is visible
                isElementVisible: function(el) {
                    if (!el || !el.isConnected) return false;
                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();
                    return style.display !== 'none' &&
                           style.visibility !== 'hidden' &&
                           parseFloat(style.opacity) > 0.1 &&
                           rect.width > 0 &&
                           rect.height > 0;
                },

                // Find submit button
                findSubmitButton: function() {
                    // Strategy 0: Check Antigravity iframe first
                    const antigravityIframe = document.getElementById('antigravity.agentPanel');
                    if (antigravityIframe && antigravityIframe.tagName === 'IFRAME') {
                        try {
                            const iframeDoc = antigravityIframe.contentDocument || antigravityIframe.contentWindow?.document;
                            if (iframeDoc) {
                                // First, look for button with text "Submit" (Antigravity specific)
                                const allButtons = iframeDoc.querySelectorAll('button');
                                for (const btn of allButtons) {
                                    const text = (btn.textContent || '').toLowerCase().trim();
                                    if (text === 'submit' && this.isElementVisible(btn) && !btn.disabled) {
                                        console.log('[For Loop] Found Submit button in iframe by text');
                                        return btn;
                                    }
                                }

                                // Look for submit/send buttons by selectors
                                const iframeSelectors = [
                                    'button[type="submit"]:not([disabled])',
                                    'button[aria-label*="send" i]:not([disabled])',
                                    'button[aria-label*="submit" i]:not([disabled])',
                                    'button[title*="send" i]:not([disabled])',
                                ];
                                for (const selector of iframeSelectors) {
                                    try {
                                        const btn = iframeDoc.querySelector(selector);
                                        if (btn && this.isElementVisible(btn)) {
                                            console.log('[For Loop] Found submit button in iframe:', selector);
                                            return btn;
                                        }
                                    } catch (e) {}
                                }
                            }
                        } catch (e) {
                            console.log('[For Loop] Cannot access iframe for submit button:', e.message);
                        }
                    }

                    const selectors = [
                        '.agent-panel button[type="submit"]',
                        'button[aria-label*="send" i]',
                        'button[aria-label*="submit" i]',
                        'button[title*="send" i]',
                        'button:has(svg[data-icon="paper-plane"])',
                        'button:has(svg[data-icon="send"])',
                    ];

                    for (const selector of selectors) {
                        try {
                            const elements = this.queryAll(selector);
                            const visible = elements.find(el => this.isElementVisible(el) && !el.disabled);
                            if (visible) {
                                console.log('[For Loop] Found submit button:', selector);
                                return visible;
                            }
                        } catch (e) {}
                    }

                    // Fallback: find button near the input
                    const input = this.findChatInput();
                    if (input) {
                        const parent = input.closest('form') || input.parentElement?.parentElement;
                        if (parent) {
                            const buttons = parent.querySelectorAll('button');
                            for (const btn of buttons) {
                                if (this.isElementVisible(btn) && !btn.disabled) {
                                    console.log('[For Loop] Found submit button near input');
                                    return btn;
                                }
                            }
                        }
                    }

                    return null;
                },

                // Inject prompt into the chat input
                injectPrompt: function(text) {
                    const input = this.findChatInput();
                    if (!input) {
                        this.lastInjectionResult = { success: false, error: 'No chat input found' };
                        return false;
                    }

                    try {
                        input.focus();
                        const isLexical = input.hasAttribute('data-lexical-editor');
                        const doc = input.ownerDocument || document;

                        let success = false;

                        // Strategy 1: execCommand (Standard for contenteditable/Lexical)
                        if (isLexical || input.getAttribute('contenteditable') === 'true') {
                            try {
                                doc.execCommand('selectAll', false, null);
                                success = doc.execCommand('insertText', false, text);
                                if (success) console.log('[For Loop] Injected via execCommand');
                            } catch (e) {
                                console.warn('[For Loop] execCommand failed', e);
                            }
                        }

                        // Strategy 2: Textarea/Input value
                        if (!success && (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT')) {
                            try {
                                // Try native setter to bypass React 15/16 overrides if present
                                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
                                if (nativeInputValueSetter && input.tagName === 'TEXTAREA') {
                                    nativeInputValueSetter.call(input, text);
                                } else {
                                    input.value = text;
                                }
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                success = true;
                                console.log('[For Loop] Injected via value property');
                            } catch (e) {
                                console.log('[For Loop] Value injection failed', e);
                            }
                        }

                        // Strategy 3: Direct Text Content (Fallback for Lexical/ContentEditable)
                        if (!success && (isLexical || input.getAttribute('contenteditable') === 'true')) {
                            try {
                                input.textContent = text;
                                // Dispatch events to trigger framework updates
                                input.dispatchEvent(new InputEvent('input', {
                                    bubbles: true,
                                    inputType: 'insertText',
                                    data: text
                                }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                success = true;
                                console.log('[For Loop] Injected via textContent fallback');
                            } catch (e) {
                                console.log('[For Loop] textContent fallback failed', e);
                            }
                        }

                        this.lastInjectionResult = { success, inputType: input.tagName, isLexical };
                        return success;
                    } catch (e) {
                        console.error('[For Loop] Injection error:', e);
                        this.lastInjectionResult = { success: false, error: e.message };
                        return false;
                    }
                },

                // Submit the prompt (press Enter or click send button)
                submitPrompt: function() {
                    const input = this.findChatInput();
                    if (!input) {
                        return { success: false, error: 'No chat input found' };
                    }

                    // Method 1: Try pressing Enter
                    try {
                        input.focus();
                        input.dispatchEvent(new KeyboardEvent('keydown', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true
                        }));
                        console.log('[For Loop] Sent Enter key');
                    } catch (e) {
                        console.log('[For Loop] Enter key failed:', e);
                    }

                    // Method 2: Try clicking submit button
                    const submitBtn = this.findSubmitButton();
                    if (submitBtn) {
                        try {
                            submitBtn.click();
                            console.log('[For Loop] Clicked submit button');
                            return { success: true, method: 'button' };
                        } catch (e) {
                            console.log('[For Loop] Button click failed:', e);
                        }
                    }

                    return { success: true, method: 'enter' };
                },

                // Combined: inject and submit
                injectAndSubmit: function(text) {
                    const injected = this.injectPrompt(text);
                    if (!injected) {
                        return this.lastInjectionResult;
                    }

                    // Small delay before submitting
                    setTimeout(() => {
                        this.submitPrompt();
                    }, 300);

                    return { success: true };
                },

                // Debug: list all potential inputs
                debugListInputs: function() {
                    const textareas = this.queryAll('textarea');
                    const editables = this.queryAll('[contenteditable="true"]');

                    console.log('[For Loop] Debug - Found textareas:', textareas.length);
                    textareas.forEach((el, i) => {
                        const rect = el.getBoundingClientRect();
                        console.log('  ' + i + ':', {
                            visible: this.isElementVisible(el),
                            rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
                            placeholder: el.placeholder,
                            id: el.id,
                            class: el.className.substring(0, 50)
                        });
                    });

                    console.log('[For Loop] Debug - Found contenteditable:', editables.length);
                    editables.forEach((el, i) => {
                        const rect = el.getBoundingClientRect();
                        console.log('  ' + i + ':', {
                            visible: this.isElementVisible(el),
                            rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
                            role: el.getAttribute('role'),
                            id: el.id
                        });
                    });

                    return { textareas: textareas.length, editables: editables.length };
                },

                // =====================================================
                // AUTO-ACCEPT FUNCTIONALITY (based on auto-accept-agent)
                // =====================================================

                // Antigravity-specific button selectors (from auto-accept-agent analysis)
                acceptSelectors: [
                    '.bg-ide-button-background',           // Primary Antigravity accept button
                    '[class*="anysphere"]',               // Anysphere branded elements
                    'button[data-action="accept"]',
                    'button[data-action="run"]',
                    'button[data-action="confirm"]',
                ],

                // Check if an element is an accept/run button worth clicking
                isAcceptButton: function(el) {
                    console.log('[For Loop] Checking button', el);
                    //if (!el || !this.isElementVisible(el)) return false;
                    //if (el.disabled) return false;

                    const text = (el.textContent || '').toLowerCase().trim();
                    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                    const className = (el.className || '').toLowerCase();
                    // Positive matches - buttons we WANT to click
                    const acceptPatterns = ['accept', 'run', 'confirm', 'approve', 'yes', 'ok', 'continue', 'proceed', 'accept all'];
                    const hasAcceptText = acceptPatterns.some(p => text.includes(p) && text.length-p.length<3 || ariaLabel.includes(p) && ariaLabel.length-p.length<3);

                    // Has the Antigravity button class
                    const hasAntigravityClass = className.includes('bg-ide-button-background') ||
                                               className.includes('anysphere');

                    // Negative matches - buttons we should NOT click
                    const denyPatterns = ['cancel', 'reject', 'no', 'deny', 'stop', 'close', 'dismiss', 'select', 'upgrade'];
                    const hasDenyText = denyPatterns.some(p => text.includes(p) || ariaLabel.includes(p));
                    console.log('isAcceptButton', el, text, ariaLabel, className, hasAcceptText, hasDenyText);
                    if (hasDenyText) return false;
                    return hasAcceptText ;
                },

                // Click all accept buttons found
                clickAcceptButtons: function() {
                    const found = [];
                    let clicked = 0;

                    // Strategy 0: Check Antigravity iframe first
                    const antigravityIframe = document.getElementById('antigravity.agentPanel') || document;
                    if (antigravityIframe && antigravityIframe.tagName === 'IFRAME') {
                        try {
                            const frameDoc = antigravityIframe.contentDocument || antigravityIframe.contentWindow?.document || antigravityIframe;
                            const iframeDoc = frameDoc.querySelector('#cascade');
                            if (iframeDoc) {
                                // Check selectors in iframe
                                this.acceptSelectors.forEach(selector => {
                                    try {
                                        iframeDoc.querySelectorAll(selector).forEach(el => {
                                            if (!found.includes(el)) found.push(el);
                                        });
                                    } catch (e) {}
                                });
                                // Check all buttons in iframe
                                iframeDoc.querySelectorAll('button').forEach(el => {
                                    if (!found.includes(el) && this.isAcceptButton(el)) {
                                        found.push(el);
                                    }
                                });
                            }
                        } catch (e) {
                            console.log('[For Loop] Cannot access iframe for accept buttons:', e.message);
                        }
                    }

                    // Gather all potential buttons from main document and other iframes
                    this.acceptSelectors.forEach(selector => {
                        try {
                            this.queryAll(selector).forEach(el => {
                                if (!found.includes(el)) found.push(el);
                            });
                        } catch (e) {}
                    });

                    // Also check all buttons
                    this.queryAll('button').forEach(el => {
                        if (!found.includes(el) && this.isAcceptButton(el)) {
                            found.push(el);
                        }
                    });

                    // Click each valid button
                    for (const el of found) {
                        console.log('[For Loop] Found button', el);
                        if (this.isAcceptButton(el)) {
                            try {
                                el.click();
                                clicked++;
                                console.log('[For Loop] Clicked accept button:', el.textContent?.trim() || el.className);
                            } catch (e) {
                                console.log('[For Loop] Failed to click:', e);
                            }
                        }
                    }

                    return { clicked, found: found.length };
                },

                // Debug: list all buttons
                debugListButtons: function() {
                    const buttons = this.queryAll('button');
                    const acceptButtons = [];

                    console.log('[For Loop] Debug - Found buttons:', buttons.length);
                    buttons.forEach((el, i) => {
                        const isAccept = this.isAcceptButton(el);
                        const info = {
                            index: i,
                            visible: this.isElementVisible(el),
                            disabled: el.disabled,
                            text: (el.textContent || '').trim().substring(0, 30),
                            class: (el.className || '').substring(0, 50),
                            ariaLabel: el.getAttribute('aria-label'),
                            isAccept: isAccept
                        };
                        console.log('  Button ' + i + ':', info);
                        if (isAccept) acceptButtons.push(info);
                    });

                    // Also check Antigravity-specific selectors
                    const antigravityButtons = this.queryAll('.bg-ide-button-background');
                    console.log('[For Loop] Debug - Antigravity buttons (.bg-ide-button-background):', antigravityButtons.length);

                    return {
                        total: buttons.length,
                        acceptButtons: acceptButtons,
                        antigravityButtons: antigravityButtons.length
                    };
                }
            };

            console.log('[For Loop] Helper script injected successfully');
        })();
        `;

        await this.sendCommand('Runtime.evaluate', {
            expression: script,
            includeCommandLineAPI: true
        });

        this.logger.log('[CDP] Helper script injected');
    }

    /**
     * Send a CDP command
     */
    sendCommand(method, params) {
        return new Promise((resolve, reject) => {
            if (!this.connectedSocket || this.connectedSocket.readyState !== WebSocket.OPEN) {
                return reject(new Error('WebSocket not open'));
            }

            const id = this.msgId++;
            const message = JSON.stringify({ id, method, params });

            const listener = (data) => {
                const response = JSON.parse(data.toString());
                if (response.id === id) {
                    this.connectedSocket.removeListener('message', listener);
                    if (response.error) {
                        reject(response.error);
                    } else {
                        resolve(response.result);
                    }
                }
            };

            this.connectedSocket.on('message', listener);
            this.connectedSocket.send(message);

            // Timeout after 5 seconds
            setTimeout(() => {
                if (this.connectedSocket) {
                    this.connectedSocket.removeListener('message', listener);
                }
                reject(new Error('CDP command timeout'));
            }, 5000);
        });
    }

    /**
     * Inject a prompt into the Antigravity chat
     * @param {string} text The prompt text to inject
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async injectPrompt(text) {
        if (!this.isConnectorActive) {
            const connected = await this.tryConnect();
            if (!connected) {
                return { success: false, error: 'Could not connect to CDP' };
            }
        }

        try {
            const escapedText = text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
            const result = await this.sendCommand('Runtime.evaluate', {
                expression: `window.__antigravityForLoop.injectAndSubmit(\`${escapedText}\`)`,
                returnByValue: true
            });

            if (result?.result?.value) {
                return result.result.value;
            }
            return { success: false, error: 'No result from injection' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Debug: list all inputs in the webview
     */
    async debugListInputs() {
        if (!this.isConnectorActive) {
            const connected = await this.tryConnect();
            if (!connected) {
                return { error: 'Could not connect to CDP' };
            }
        }

        try {
            const result = await this.sendCommand('Runtime.evaluate', {
                expression: 'window.__antigravityForLoop.debugListInputs()',
                returnByValue: true
            });
            return result?.result?.value || {};
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Click all accept/run buttons in the Antigravity webview
     * This is the main auto-accept functionality
     * @returns {Promise<{clicked: number, found: number, error?: string}>}
     */
    async clickAcceptButtons() {
        if (!this.isConnectorActive) {
            const connected = await this.tryConnect();
            if (!connected) {
                return { clicked: 0, found: 0, error: 'Could not connect to CDP' };
            }
        }

        try {
            //this.logger.log('[CDP] Clicking accept buttons');
            const result = await this.sendCommand('Runtime.evaluate', {
                expression: 'window.__antigravityForLoop.clickAcceptButtons()',
                returnByValue: true
            });
            return result?.result?.value || { clicked: 0, found: 0 };
        } catch (e) {
            return { clicked: 0, found: 0, error: e.message };
        }
    }

    /**
     * Debug: list all buttons and identify which are accept buttons
     */
    async debugListButtons() {
        if (!this.isConnectorActive) {
            const connected = await this.tryConnect();
            if (!connected) {
                return { error: 'Could not connect to CDP' };
            }
        }

        try {
            const result = await this.sendCommand('Runtime.evaluate', {
                expression: 'window.__antigravityForLoop.debugListButtons()',
                returnByValue: true
            });
            return result?.result?.value || {};
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * Check if CDP is available (can connect to a port)
     */
    async isAvailable() {
        const port = await this.findAvailableCDPPort();
        return port !== null;
    }

    /**
     * Dispose the manager and close connections
     */
    dispose() {
        if (this.connectedSocket) {
            this.connectedSocket.terminate();
            this.connectedSocket = null;
        }
        this.isConnectorActive = false;
        this.scriptInjected = false;
    }
}

module.exports = { CDPManager };

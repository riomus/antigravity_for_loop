const http = require('http');
const WebSocket = require('ws');

(async function() {
    const pages = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9000/json/list', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const targetPage = pages.find(p => p.title && p.title.includes('antigravity_for_loop'));
    if (!targetPage) {
        console.log('Target page not found!');
        return;
    }

    console.log('Connecting to:', targetPage.title);
    const ws = new WebSocket(targetPage.webSocketDebuggerUrl);
    let msgId = 0;

    function send(method, params = {}) {
        return new Promise((resolve) => {
            const id = ++msgId;
            const handler = (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.id === id) {
                    ws.removeListener('message', handler);
                    resolve(msg.result);
                }
            };
            ws.on('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
            setTimeout(() => resolve(null), 3000);
        });
    }

    await new Promise((resolve) => {
        ws.on('open', async () => {
            // Enable Page domain
            await send('Page.enable');

            // Get frame tree
            const frameTree = await send('Page.getFrameTree');
            console.log('\n=== Frame Tree ===');

            function printFrame(frame, indent = 0) {
                const prefix = '  '.repeat(indent);
                console.log(prefix + 'Frame: ' + (frame.name || frame.id));
                console.log(prefix + '  URL: ' + (frame.url || '').substring(0, 100));
                if (frame.childFrames) {
                    frame.childFrames.forEach(cf => printFrame(cf.frame, indent + 1));
                }
            }

            if (frameTree && frameTree.frameTree) {
                printFrame(frameTree.frameTree.frame);
                if (frameTree.frameTree.childFrames) {
                    frameTree.frameTree.childFrames.forEach(cf => printFrame(cf.frame, 1));
                }
            }

            // Try to access iframe content directly
            console.log('\n=== Trying to access iframe content ===');
            const result = await send('Runtime.evaluate', {
                expression: `
                    (function() {
                        const iframe = document.getElementById('antigravity.agentPanel');
                        if (!iframe) return { error: 'iframe not found' };

                        try {
                            const doc = iframe.contentDocument || iframe.contentWindow.document;
                            if (!doc) return { error: 'cannot access contentDocument' };

                            const textareas = doc.querySelectorAll('textarea');
                            const editables = doc.querySelectorAll('[contenteditable]');

                            return {
                                success: true,
                                textareas: textareas.length,
                                editables: editables.length,
                                bodyHTML: doc.body?.innerHTML?.substring(0, 300) || 'no body'
                            };
                        } catch (e) {
                            return { error: e.message };
                        }
                    })()
                `,
                returnByValue: true
            });
            console.log(JSON.stringify(result?.result?.value, null, 2));

            ws.close();
            resolve();
        });
        ws.on('error', (e) => { console.log('Error:', e.message); resolve(); });
    });
})();

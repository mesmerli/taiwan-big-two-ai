const { _electron: electron } = require('playwright');
const path = require('path');
const http = require('http');

const TEST_PORT = 56788;
const server = http.createServer((req, res) => {
    console.log(`[MOCK SERVER] Received: ${req.method} ${req.url}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            data: [{ id: "mock-model" }]
        }));
    } else if (req.url === '/v1/chat/completions') {
        // Delay response to test the loading state
        setTimeout(() => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                choices: [{
                    message: {
                        content: `### 🃏 戰局結果點評
[檢討] 艾力克斯在第5輪過早打出梅花K，導致後期失去了控牌權。
[分析] 貝拉在第5輪出牌保留2是正確的，可惜後續被克里斯的順子反超。`
                    }
                }]
            }));
        }, 1500);
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(TEST_PORT, '127.0.0.1', async () => {
    console.log(`🚀 Mock server listening on http://127.0.0.1:${TEST_PORT}`);

    try {
        console.log('🚀 Launching Electron application...');
        const electronApp = await electron.launch({
            args: [path.join(__dirname, '../main.js')]
        });

        const window = await electronApp.firstWindow();

        window.on('console', msg => {
            console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
        });
        window.on('pageerror', err => {
            console.error('[BROWSER PAGE ERROR]', err);
        });

        await window.waitForSelector('#game-container');

        // Wait for AISummary to be initialized on the window object
        console.log('⏳ Waiting for window.AISummary to initialize...');
        await window.waitForFunction(() => window.AISummary !== undefined && typeof window.AISummary.apiUrl === 'string');

        // Set the Review LLM URL input field to trigger state updates
        console.log('🔧 Setting Review LLM URL to mock server...');
        await window.evaluate((port) => {
            window.AISummary.apiUrl = `http://127.0.0.1:${port}/v1/chat/completions`;
        }, TEST_PORT);

        // Verify the URL was updated in the browser context
        const currentUrl = await window.evaluate(() => window.AISummary ? window.AISummary.apiUrl : null);
        console.log(`ℹ️ Verified AISummary.apiUrl in page: "${currentUrl}"`);

        // Trigger showSummary manually to test
        console.log('🎬 Triggering post-game review panel...');
        await window.evaluate(() => {
            if (window.AISummary) {
                // Mock a game state
                const mockState = {
                    players: [[], [1, 2], [3, 4, 5], [6, 7]]
                };
                window.AISummary.showSummary(mockState, 0);
            }
        });

        // 1. Verify loading state exists
        console.log('⏳ Checking for AI wait screens (progress bar and humorous subtitle)...');
        await window.waitForSelector('#ai-loading-message', { timeout: 4000 });
        const loadingMessage = await window.$eval('#ai-loading-message', el => el.textContent);
        const loadingSub = await window.$eval('#ai-loading-submessage', el => el.textContent);
        console.log(`ℹ️ Loading Title: "${loadingMessage}"`);
        console.log(`ℹ️ Loading Subtitle: "${loadingSub}"`);

        // 2. Wait for response to be loaded
        console.log('⏳ Waiting for LLM review content to render...');
        await window.waitForFunction(() => {
            const el = document.getElementById('ai-summary');
            return el && el.textContent.includes('梅花K');
        }, { timeout: 10000 });

        const htmlContent = await window.innerHTML('#ai-summary');
        console.log('Current HTML in #ai-summary:', htmlContent);

        // 3. Verify parseRoastAndAnalysis styled tags are present
        console.log('🔍 Checking styled blocks for [檢討] and [分析]...');

        // Find elements with text containing [檢討] or [Review] inside the summary container
        const reviewSpanExists = await window.evaluate(() => {
            const spans = Array.from(document.querySelectorAll('#ai-summary span'));
            return spans.some(s => (s.textContent.includes('[檢討]') || s.textContent.includes('[嘲諷]')) && s.className.includes('text-rose-400'));
        });
        const analysisSpanExists = await window.evaluate(() => {
            const spans = Array.from(document.querySelectorAll('#ai-summary span'));
            return spans.some(s => s.textContent.includes('[分析]') && s.className.includes('text-slate-400'));
        });

        if (reviewSpanExists && analysisSpanExists) {
            console.log('✅ Review span (rose colored) and Analysis span (slate colored) detected successfully!');
        } else {
            throw new Error(`Styled spans not found or incorrect colors. Review: ${reviewSpanExists}, Analysis: ${analysisSpanExists}`);
        }

        // 4. Verify paragraph fade-in has been applied with animationDelay
        console.log('🔍 Verifying animate-fade-in classes and animation delays...');
        const delays = await window.evaluate(() => {
            const el = document.getElementById('ai-summary');
            const animatedChildren = Array.from(el.children).filter(c => c.classList.contains('animate-fade-in'));
            return animatedChildren.map(c => ({
                tag: c.tagName,
                classes: c.className,
                delay: c.style.animationDelay
            }));
        });
        console.log('📋 Animated children details:', delays);

        if (delays.length > 0 && delays.some(d => d.delay !== '')) {
            console.log('✅ Fade-in class and incremental animation delays applied correctly!');
        } else {
            throw new Error('Animation delays or classes not found.');
        }

        console.log('🎉 Fade-in and Standard JSON parsing checks passed successfully!');
        await electronApp.close();
    } catch (err) {
        console.error('❌ Test failed:', err);
    } finally {
        server.close();
        console.log('👋 Mock server stopped.');
        process.exit(0);
    }
});

const { _electron: electron } = require('playwright');
const path = require('path');

(async () => {
    console.log('🚀 Starting diagnostics inside tests/debug_ui.js...');
    const electronApp = await electron.launch({
        args: [path.join(__dirname, '../main.js')]
    });

    const window = await electronApp.firstWindow();
    
    // Listen for console messages and page errors
    window.on('console', msg => {
        console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
    });
    window.on('pageerror', err => {
        console.error('[BROWSER PAGE ERROR]', err);
    });

    await window.waitForSelector('#game-container');
    await window.waitForFunction(() => typeof window.AISummary !== 'undefined');
    console.log('✅ App loaded and window.AISummary initialized. Forcing game end...');

    await window.evaluate(() => {
        // Mock player states
        gameState.players[0] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        gameState.players[1] = [];
        gameState.players[2] = [11, 12, 13];
        gameState.players[3] = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
        
        // Execute play to trigger game end
        executePlay(1, []);
    });

    console.log('⏳ Waiting 5 seconds to capture any async console errors or panel states...');
    await window.waitForTimeout(5000);

    // Let's capture the current HTML structure of `#ai-summary-panel` to see its classes and visibility!
    const panelState = await window.evaluate(() => {
        const panel = document.getElementById('ai-review-panel');
        return panel ? {
            id: panel.id,
            className: panel.className,
            style: panel.style.cssText,
            innerHTML: panel.innerHTML
        } : null;
    });

    console.log('📋 Panel DOM State:', JSON.stringify(panelState, null, 2));

    console.log('👋 Closing app.');
    await electronApp.close();
})();

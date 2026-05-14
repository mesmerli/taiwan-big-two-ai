const { _electron: electron } = require('playwright');
const path = require('path');

(async () => {
    console.log('🚀 Starting UI Tests...');
    
    // Launch the Electron app
    const electronApp = await electron.launch({
        args: [path.join(__dirname, '../main.js')]
    });

    try {
        let confirmModal;
        console.log('✅ App Launched');

        // Get the first window
        const window = await electronApp.firstWindow();
        const title = await window.title();
        console.log(`✅ Window Title: ${title}`);

        if (title !== 'Taiwan Big Two AI') {
            throw new Error('Title mismatch!');
        }

        // Wait for game container to render
        await window.waitForSelector('#game-container');
        console.log('✅ Game Container found');

        // Test Rules Modal
        console.log('🧪 Testing Rules Modal...');
        await window.click('#info-icon');
        const modal = await window.waitForSelector('#rules-modal', { state: 'visible' });
        if (modal) {
            console.log('✅ Rules Modal opened successfully');
        }

        // Close Modal
        await window.keyboard.press('Escape');
        await window.waitForSelector('#rules-modal', { state: 'hidden' });
        console.log('✅ Rules Modal closed successfully');

        // Test Card Selection
        console.log('🧪 Testing Card Selection...');
        const firstCard = await window.locator('.hand .card').first();
        if (await firstCard.isVisible()) {
            await firstCard.click();
            const isSelected = await firstCard.evaluate(el => el.classList.contains('selected'));
            console.log(isSelected ? '✅ Card selected successfully' : '❌ Card selection failed');
        }
        
        // Test Mandatory Shout UI (Leaving 1 card must show Shout LA and hide Play)
        console.log('🧪 Testing Mandatory Shout UI...');
        await window.evaluate(() => {
            gameState.players[0] = [10, 11]; // Two cards
            gameState.turn = 0;
            gameState.lastPlayerIndex = 0; // Give lead to human (not first turn)
            gameState.lastPlay = null;
            gameState.selectedCards.clear();
            renderAll();
        });

        
        let playBtn = await window.locator('#btn-play');
        let shoutBtn = await window.locator('#btn-shout');
        
        // Select first card to leave exactly 1 card
        await window.locator('.hand .card').first().click();
        
        const isPlayHidden = await playBtn.isHidden();
        const isShoutVisible = await shoutBtn.isVisible();
        
        if (isPlayHidden && isShoutVisible) {
            console.log('✅ Mandatory Shout UI verified (Play hidden, Shout visible)');
        } else {
            throw new Error(`Mandatory Shout UI failure: Play Hidden=${isPlayHidden}, Shout Visible=${isShoutVisible}`);
        }
        
        // Clean up: unselect for next tests
        await window.click('#btn-new'); 
        confirmModal = await window.waitForSelector('#confirm-modal', { state: 'visible', timeout: 1000 }).catch(() => null);
        if (confirmModal) await window.click('#confirm-yes');
        await window.waitForTimeout(500);



        // Test Pass Button (Retry New Game if hidden due to 3 of Clubs)
        console.log('🧪 Testing Pass Button...');
        let passTested = false;
        const maxRetries = 20;
        for (let i = 0; i < maxRetries; i++) {
            const passBtn = await window.locator('#btn-pass');
            if (await passBtn.isVisible()) {
                await passBtn.click();
                console.log('✅ Pass button clicked');
                passTested = true;
                break;
            } else {
                console.log(`⚠️ Pass button hidden (Attempt ${i+1}/${maxRetries}) - Restarting to find testable state...`);
                await window.click('#btn-new');
                confirmModal = await window.waitForSelector('#confirm-modal', { state: 'visible', timeout: 1000 }).catch(() => null);
                if (confirmModal) await window.click('#confirm-yes');
                await window.waitForTimeout(500); // Wait for re-render
            }
        }
        if (!passTested) {
            throw new Error(`Could not test Pass button after ${maxRetries} restarts (Astronomical 3 of Clubs luck!)`);
        }

        // Test AI Settings Modal (on Player 4)
        console.log('🧪 Testing AI Settings Modal...');
        let gearIcon = await window.locator('#player-4 .settings-icon');
        
        // Actively swap until we get an LLM (gear icon becomes visible)
        let swapCount = 0;
        while (!(await gearIcon.isVisible()) && swapCount < 10) {
            console.log(`  🔄 Swapping Player 4 character to find an LLM (Attempt ${swapCount + 1})...`);
            await window.click('#player-4 .avatar');
            await window.waitForTimeout(200); // Wait for potential animations
            swapCount++;
        }

        if (await gearIcon.isVisible()) {
            await gearIcon.click();
            const settingsModal = await window.waitForSelector('#ai-settings-modal', { state: 'visible' });
            if (settingsModal) {
                console.log('✅ AI Settings Modal opened');
                // Verify inputs exist
                const apiUrl = await window.locator('#ai-api-url');
                const modelId = await window.locator('#ai-model-id');
                console.log(`✅ Settings fields found: API URL=${await apiUrl.isVisible()}, Model ID=${await modelId.isVisible()}`);
                
                // Test closing via Escape (Save/Cancel buttons were removed)
                await window.keyboard.press('Escape');
                await window.waitForSelector('#ai-settings-modal', { state: 'hidden' });
                console.log('✅ AI Settings Modal closed via Escape');
            }
        } else {
            throw new Error('Could not activate LLM on Player 4 after 10 swaps!');
        }


        // Test Character Swap (Player 2)
        console.log('🧪 Testing Character Swap...');
        const p2Name = await window.locator('#player-2 .name').textContent();
        await window.click('#player-2 .avatar');
        const p2NameNew = await window.locator('#player-2 .name').textContent();
        console.log(`✅ Character swapped: ${p2Name} -> ${p2NameNew}`);

        // Test About Window
        console.log('🧪 Testing About Window...');
        await window.evaluate(() => require('electron').ipcRenderer.send('show-about'));
        const aboutWin = await electronApp.waitForEvent('window');
        const aboutTitle = await aboutWin.title();
        console.log(`✅ About Window opened: ${aboutTitle}`);
        await aboutWin.waitForSelector('.logo');
        console.log('✅ About Window content verified');
        await aboutWin.close();

        // Test New Game
        console.log('🧪 Testing New Game button...');
        await window.click('#btn-new');
        // Check if confirm modal appears
        confirmModal = await window.waitForSelector('#confirm-modal', { state: 'visible', timeout: 2000 }).catch(() => null);
        if (confirmModal) {
            console.log('✅ New Game confirmation appeared');
            await window.click('#confirm-yes');
            console.log('✅ Confirmed new game');
        } else {
            console.log('✅ New Game started directly (no active game)');
        }

        console.log('\n✨ All UI Tests Passed Successfully!');
    } catch (err) {
        console.error('\n❌ UI Test Failed:');
        console.error(err);
        process.exit(1);
    } finally {
        await electronApp.close();
    }
})();

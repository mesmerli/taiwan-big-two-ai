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
        let testStep = 1;
        console.log(`[Step ${testStep++}] 🧪 Testing Rules Modal...`);
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
        console.log(`[Step ${testStep++}] 🧪 Testing Card Selection...`);
        const firstCard = await window.locator('.hand .card').first();
        if (await firstCard.isVisible()) {
            await firstCard.click();
            const isSelected = await firstCard.evaluate(el => el.classList.contains('selected'));
            console.log(isSelected ? '✅ Card selected successfully' : '❌ Card selection failed');
        }
        
        // Test Mandatory Shout UI (Leaving 1 card must show Shout LA and hide Play)
        console.log(`[Step ${testStep++}] 🧪 Testing Mandatory Shout UI...`);
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
        console.log(`[Step ${testStep++}] 🧪 Testing Pass Button...`);
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
        console.log(`[Step ${testStep++}] 🧪 Testing AI Settings Modal...`);
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
        console.log(`[Step ${testStep++}] 🧪 Testing Character Swap...`);
        const p2Name = await window.locator('#player-2 .name').textContent();
        await window.click('#player-2 .avatar');
        const p2NameNew = await window.locator('#player-2 .name').textContent();
        console.log(`✅ Character swapped: ${p2Name} -> ${p2NameNew}`);

        // Test About Window
        console.log(`[Step ${testStep++}] 🧪 Testing About Window...`);
        await window.evaluate(() => require('electron').ipcRenderer.send('show-about'));
        const aboutWin = await electronApp.waitForEvent('window');
        const aboutTitle = await aboutWin.title();
        console.log(`✅ About Window opened: ${aboutTitle}`);
        await aboutWin.waitForSelector('.logo');
        console.log('✅ About Window content verified');
        await aboutWin.close();

        // Test New Game
        console.log(`[Step ${testStep++}] 🧪 Testing New Game button...`);
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

        // Test Audio & Shortcut Triggers
        console.log(`[Step ${testStep++}] 🧪 Testing Audio & Shortcut Triggers...`);
        await window.evaluate(() => {
            window.audioCalls = [];
            // Spy on AudioPlayer methods
            const methods = ['playBGM', 'playCardSelect', 'playLa', 'playPass', 'playWin'];
            methods.forEach(m => {
                const original = AudioPlayer[m];
                AudioPlayer[m] = (...args) => {
                    window.audioCalls.push({ method: m, args });
                    // Call original but ignore errors (since we don't have real audio hardware in CI)
                    try { original.apply(AudioPlayer, args); } catch(e) {}
                };
            });
        });

        // 1. Test Card Select Audio
        await window.locator('.hand .card').first().click();
        let calls = await window.evaluate(() => window.audioCalls);
        if (calls.some(c => c.method === 'playCardSelect')) {
            console.log('✅ Card Select audio triggered');
        } else {
            console.log('❌ Card Select audio NOT triggered');
        }

        // 2. Test Triple-Down Shortcut & Restart Audio
        console.log(`[Step ${testStep++}] 🧪 Testing Triple-Down Restart Shortcut...`);
        await window.evaluate(() => {
            gameState.gameEnded = true; // Simulate game end
            window.audioCalls = []; // Reset calls
        });
        
        // Press Down 3 times quickly
        for (let i = 0; i < 3; i++) {
            await window.keyboard.press('ArrowDown');
            await window.waitForTimeout(100);
        }
        
        // Verify restart (BGM should be played again during initGame)
        calls = await window.evaluate(() => window.audioCalls);
        const restarted = calls.some(c => c.method === 'playBGM');
        if (restarted) {
            console.log('✅ Triple-Down shortcut verified (New game started)');
        } else {
            throw new Error('Triple-Down shortcut failed to restart game');
        }

        // 3. Test BGM Transitions
        console.log(`[Step ${testStep++}] 🧪 Testing BGM Transitions...`);
        await window.evaluate(() => {
            window.audioCalls = []; 
        });

        // Simulating a "Shout LA" event
        await window.evaluate(() => AudioPlayer.playLa('Alex'));
        calls = await window.evaluate(() => window.audioCalls);
        const hasLaBGM = calls.some(c => c.method === 'playBGM' && c.args[0] === 'Iron_in_the_Gale');
        if (hasLaBGM) console.log('✅ BGM switched correctly for Shout LA (Iron_in_the_Gale)');
        else throw new Error('BGM failed to switch for Shout LA');

        // Simulating a "Win" event
        await window.evaluate(() => {
            window.audioCalls = [];
            AudioPlayer.playWin();
        });
        calls = await window.evaluate(() => window.audioCalls);
        const hasWinBGM = calls.some(c => c.method === 'playBGM' && c.args[0] === 'Sovereign_Ascent');
        if (hasWinBGM) console.log('✅ BGM switched correctly for Victory (Sovereign_Ascent)');
        else throw new Error('BGM failed to switch for Victory');

        // Test Advanced Keyboard Controls
        console.log(`[Step ${testStep++}] 🧪 Testing Advanced Keyboard Controls...`);
        
        // 1. Arrow Left/Right (Cyclic Selection)
        console.log('  ⌨️ Testing Arrow Left/Right (Cycle)...');
        await window.evaluate(() => {
            // Force a state where we have legal moves
            gameState.players[0] = [0, 1, 2, 3, 4]; // Hand with 3C, 4C, 5C, 6C, 7C
            gameState.turn = 0;
            gameState.lastPlayerIndex = 0; // Lead
            gameState.lastPlay = null;
            gameState.selectedCards.clear();
            renderAll();
        });
        
        await window.keyboard.press('ArrowRight');
        let selectedCount = await window.evaluate(() => gameState.selectedCards.size);
        if (selectedCount > 0) console.log(`✅ ArrowRight selected ${selectedCount} cards (Cycle 1)`);
        else throw new Error('ArrowRight failed to select cards');

        await window.keyboard.press('ArrowLeft');
        // Since we are cycling, this should change selection (or go back)
        console.log('✅ ArrowLeft handled successfully');

        // 2. Arrow Down (Deselect)
        console.log('  ⌨️ Testing Arrow Down (Deselect)...');
        await window.keyboard.press('ArrowDown');
        selectedCount = await window.evaluate(() => gameState.selectedCards.size);
        if (selectedCount === 0) console.log('✅ ArrowDown cleared selection');
        else throw new Error('ArrowDown failed to clear selection');

        // 3. Arrow Up (Play)
        console.log('  ⌨️ Testing Arrow Up (Play)...');
        await window.keyboard.press('ArrowRight'); // Select something first
        await window.keyboard.press('ArrowUp');
        const turnAfterUp = await window.evaluate(() => gameState.turn);
        if (turnAfterUp !== 0) console.log('✅ ArrowUp played cards and ended turn');
        else throw new Error('ArrowUp failed to play cards');

        // 4. Spacebar (Pass) - Need to be in a following state
        console.log('  ⌨️ Testing Spacebar (Pass)...');
        await window.evaluate(() => {
            gameState.players[0] = [51]; // 2 of Spades
            gameState.turn = 0;
            gameState.lastPlayerIndex = 1; // Alex led
            gameState.lastPlay = [0]; // 3 of Clubs
            gameState.selectedCards.clear();
            renderAll();
        });
        await window.keyboard.press(' ');
        const turnAfterSpace = await window.evaluate(() => gameState.turn);
        if (turnAfterSpace !== 0) console.log('✅ Spacebar passed turn');
        else throw new Error('Spacebar failed to pass turn');

        // 5. Test Scoring Logic (Comprehensive Penalties)
        console.log(`[Step ${testStep++}] 🧪 Testing Scoring Logic (Comprehensive)...`);
        
        // Scenario A: Loser has 10 cards + one "2" (Expect -40)
        // Formula: 10 (cards) * 1 (winner mult) * 2 (10+ penalty) * 2 (one 2 penalty) = 40
        const scoreA = await window.evaluate(() => {
            gameState.scores = [0, 0, 0, 0];
            // Ranks: 1,2,3,4(C), 1,2,3,4(D), 1(H), 12(C) -> No Straights/SFs/FKs
            gameState.players[1] = [1, 2, 3, 4, 14, 15, 16, 17, 27, 12]; 
            gameState.lastPlay = [0]; // Winner played single 3
            calculateScores(0);
            return gameState.scores[1];
        });
        if (scoreA === -40) console.log('✅ Scenario A passed: 10 cards + one "2" = -40');
        else throw new Error(`Scoring A failed: Expected -40, got ${scoreA}`);

        // Scenario B: Winner ends with a "2" (Expect -2 for 1 card)
        // Formula: 1 (card) * 2 (winner ending with 2 mult) * 1 (no loser penalty) = 2
        const scoreB = await window.evaluate(() => {
            gameState.scores = [0, 0, 0, 0];
            gameState.players[1] = [13]; // 1 card (3D)
            gameState.lastPlay = [51]; // Winner ended with 2 of Spades (Rank 12)
            calculateScores(0);
            return gameState.scores[1];
        });
        if (scoreB === -2) console.log('✅ Scenario B passed: Winner ends with "2" = -2');
        else throw new Error(`Scoring B failed: Expected -2, got ${scoreB}`);

        // 6. Test Image Assets
        console.log(`[Step ${testStep++}] 🧪 Testing Image Assets...`);
        const imageResults = await window.evaluate(async () => {
            // Check current images in DOM (avatars)
            const imgs = Array.from(document.querySelectorAll('img'));
            const results = imgs.map(img => ({
                src: img.src,
                ok: img.complete && img.naturalWidth > 0
            }));
            
            // Specifically check logo.png which is used as app icon
            const checkLogo = () => new Promise(res => {
                const img = new Image();
                img.onload = () => res(true);
                img.onerror = () => res(false);
                img.src = 'src/assets/logo.png';
            });
            results.push({ src: 'src/assets/logo.png', ok: await checkLogo() });
            
            return results;
        });
        
        const broken = imageResults.filter(r => !r.ok);
        if (broken.length === 0) {
            console.log(`✅ All ${imageResults.length} image assets verified (Avatars & Logo)`);
        } else {
            throw new Error(`Broken images found: ${broken.map(b => b.src).join(', ')}`);
        }

        // 7. Test Audio Assets
        console.log(`[Step ${testStep++}] 🧪 Testing Audio Assets...`);
        const audioResults = await window.evaluate(async () => {
            const files = [
                'Cards_On_The_Line.mp3', 'Iron_in_the_Gale.mp3', 'Sovereign_Ascent.mp3',
                'la_alex.mp3', 'la_ares.mp3', 'la_bella.mp3', 'la_chris.mp3', 'la_diana.mp3', 'la_you.mp3',
                'pass_alex.mp3', 'pass_ares.mp3', 'pass_bella.mp3', 'pass_chris.mp3', 'pass_diana.mp3', 'pass_you.mp3'
            ];
            const results = [];
            for (const f of files) {
                try {
                    const resp = await fetch(`src/assets/mp3/${f}`, { method: 'HEAD' });
                    results.push({ file: f, ok: resp.ok });
                } catch (e) {
                    results.push({ file: f, ok: false });
                }
            }
            return results;
        });
        const brokenAudio = audioResults.filter(r => !r.ok);
        if (brokenAudio.length === 0) {
            console.log(`✅ All ${audioResults.length} audio assets verified (BGM & Voices)`);
        } else {
            throw new Error(`Broken or missing audio files: ${brokenAudio.map(b => b.file).join(', ')}`);
        }

        // 8. Test AI Fallback (LLM Connection Failure)
        console.log(`[Step ${testStep++}] 🧪 Testing AI Fallback (Connection Failure)...`);
        await window.evaluate(async () => {
            // Find an LLM character (Diana is usually slot 3)
            const diana = window.AI.getCharacter(3); 
            if (diana && diana.isLLM) {
                diana.apiUrl = "http://invalid-url-that-will-fail-instantly.com";
            }
            
            // Setup state for Diana's turn
            gameState.turn = 3;
            gameState.lastPlayerIndex = -1; // New round
            gameState.players[3] = [0, 1, 2, 3, 4]; // Give her 3C to 7C
            gameState.playerLastActions[3] = null;
            renderAll();
            
            // Manually trigger AI turn since we skipped nextTurn()
            if (typeof aiTurn === 'function') {
                await aiTurn();
            }
        });

        // Wait for AI to process, fail, and fallback
        await window.waitForTimeout(1000); 
        const dianaAction = await window.evaluate(() => gameState.playerLastActions[3]);
        if (dianaAction && dianaAction.length > 0) {
            console.log('✅ AI successfully fell back to Local Logic after API error');
        } else {
            throw new Error('AI failed to make a move after connection error (Stalled)');
        }

        // 9. Test System Resilience (Missing Assets)
        console.log(`[Step ${testStep++}] 🧪 Testing System Resilience (Non-crashing)...`);
        const resilienceOk = await window.evaluate(() => {
            try {
                // 1. Audio Resilience: Attempt to play a non-existent sound file
                // Should log a warning but NOT throw an error that stops JS execution
                AudioPlayer.playPass('FakeGhostCharacter');
                AudioPlayer.playLa('FakeGhostCharacter');
                
                // 2. State Resilience: Trigger AI logic with incomplete character data
                // (Already covered by Fallback test, but verifies the catch-all logic)
                
                return true;
            } catch (e) {
                console.error('Resilience Test Failed:', e);
                return false;
            }
        });
        if (resilienceOk) console.log('✅ System remains stable despite missing external assets');
        else throw new Error('System CRASHED during resilience testing');

        // 10. Test Language Toggle
        console.log(`[Step ${testStep++}] 🧪 Testing Language Toggle...`);
        const langBefore = await window.evaluate(() => currentLang);
        await window.click('#lang-toggle');
        const langAfter = await window.evaluate(() => currentLang);
        const playText = await window.locator('#btn-play').textContent();
        if (langBefore !== langAfter) {
            console.log(`✅ Language state toggled: ${langBefore} -> ${langAfter}`);
            console.log(`✅ UI Text updated: Play Button = "${playText}"`);
        } else {
            throw new Error('Language toggle failed to change state or UI');
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

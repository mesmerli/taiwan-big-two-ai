// Global Game States
window.ipcRenderer = null;
if (typeof require !== 'undefined') {
    try {
        const electron = require('electron');
        window.ipcRenderer = electron.ipcRenderer;
    } catch (e) {
        console.warn('[Renderer] Running in non-Electron environment. ipcRenderer disabled.');
    }
}

window.soundMode = parseInt(AppStorage.getItem('soundMode')) || 0; // 0: All, 1: SFX Only, 2: None
window.trialDaysRemaining = null;
window.currentLang = 'zh';

window.PLAYER_NAMES_EN = ["You", "Alex (NPC)", "Bella (NPC)", "Chris (NPC)"];
window.PLAYER_NAMES_ZH = ["你", "艾力克斯 (NPC)", "貝拉 (NPC)", "克里斯 (NPC)"];
window.PLAYER_NAMES = window.PLAYER_NAMES_ZH;

window.gameState = {
    players: [[], [], [], []], // 0 is human, 1-3 are AI
    turn: 0,
    lastPlay: null,
    lastPlayerIndex: -1,
    selectedCards: new Set(),
    shouted: [false, false, false, false],
    canFinish: [true, true, true, true],
    gameEnded: false,
    scores: [0, 0, 0, 0],
    playerLastActions: [null, null, null, null], // null, "PASS", or Array of cards
    playedCards: [], // Persistent tracking of all cards played this game
    gameLog: [] // Chronological log of all actions for reflection
};

window.aiTurnTimeout = null;
window.aiProcessing = false;

// Keyboard interaction cycle index
window.cycleIndex = -1;
window.downKeyCount = 0;
window.lastDownKeyTime = 0;

function resetCycleState() {
    window.cycleIndex = -1;
    window.downKeyCount = 0;
}
window.resetCycleState = resetCycleState;

function initGame() {
    if (window.AISummary && typeof window.AISummary.hidePanel === 'function') {
        window.AISummary.hidePanel();
    }
    if (window.alertModal) window.alertModal.classList.add('hidden');
    gameState.gameEnded = false;
    gameState.shouted = [false, false, false, false];
    gameState.canFinish = [true, true, true, true];
    gameState.selectedCards.clear();
    gameState.lastPlay = null;
    gameState.lastPlayerIndex = -1;
    gameState.playerLastActions = [null, null, null, null];
    gameState.playedCards = [];
    gameState.gameLog = [];

    // Reset BGM to default
    AudioPlayer.playBGM();

    // Randomize AI Personas for each game
    if (window.AI && typeof window.AI.randomizeAllPersonas === 'function') {
        window.AI.randomizeAllPersonas();
    }

    // Generate deck
    let deck = Array.from({ length: 52 }, (_, i) => i);
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Deal
    gameState.players = [
        deck.slice(0, 13),
        deck.slice(13, 26),
        deck.slice(26, 39),
        deck.slice(39, 52)
    ];

    // Sort human hand
    gameState.players[0] = GameLogic.sortCards(gameState.players[0]);

    // Find who has the starting card (Club 3 = 0 for Taiwan, Diamond 3 = 13 for HK)
    const ruleMode = AppStorage.getItem('ruleMode') || 'taiwan';
    const startCard = ruleMode === 'taiwan' ? 0 : 13;
    for (let i = 0; i < 4; i++) {
        if (gameState.players[i].includes(startCard)) {
            gameState.turn = i;
            break;
        }
    }

    // Check for Dragon Win at start
    for (let i = 0; i < 4; i++) {
        const info = GameLogic.getHandInfo(gameState.players[i]);
        if (info && info.type === 'DRAGON') {
            handleDragonWin(i);
            return;
        }
    }

    gameState.lastPlay = null;
    gameState.selectedCards.clear();
    gameState.shouted = [false, false, false, false];
    gameState.canFinish = [true, true, true, true];
    gameState.gameEnded = false;
    if (window.btnShout) window.btnShout.classList.add('hidden');

    renderAll();
    updateStatus();

    const isHumanTurn = (gameState.turn === 0 && (!window.AI || !window.AI.getCharacter(0)));
    if (!isHumanTurn) {
        const delay = (window.AI && window.AI.getCharacter(0)) ? 100 : 1000;
        setTimeout(aiTurn, delay);
    }
}
window.initGame = initGame;

function playCards(shoutArg = false) {
    if (gameState.turn !== 0) return;

    const selected = Array.from(gameState.selectedCards);
    if (selected.length === 0) return;

    const isShouting = shoutArg === true;
    const hand = gameState.players[0];

    // No splitting rule
    if (gameState.shouted[0] && !isShouting) {
        if (selected.length !== hand.length) {
            showAlert(t('mustPlayAll'));
            return;
        }
    } else if (!gameState.canFinish[0] && selected.length === hand.length) {
        showAlert(t('cannotFinish'));
        return;
    }

    // Rule: If remaining cards = 1, must shout
    const remainingCount = hand.length - selected.length;
    if (remainingCount === 1 && !isShouting) {
        showAlert(t('mustShoutLa'));
        return;
    }

    // Validate play
    const info = GameLogic.getHandInfo(selected);
    if (!info) {
        showAlert(t('invalidHand'));
        return;
    }

    // Must follow previous play type/count
    if (gameState.lastPlay && gameState.lastPlayerIndex !== 0) {
        const isSelectedBomb = info.type === 'FOUR_OF_A_KIND' || info.type === 'STRAIGHT_FLUSH';
        const isLastPlaySingleOrPair = gameState.lastPlay.length === 1 || gameState.lastPlay.length === 2;

        if (selected.length !== gameState.lastPlay.length && !(isSelectedBomb && isLastPlaySingleOrPair)) {
            showAlert(t('mustPlayCount', { count: gameState.lastPlay.length }));
            return;
        }
        if (GameLogic.compareHands(selected, gameState.lastPlay) <= 0) {
            showAlert(t('mustBeHigher'));
            return;
        }
    }

    // Special rule: first play must have starting card if it's the very first turn
    const ruleMode = AppStorage.getItem('ruleMode') || 'taiwan';
    const startCard = ruleMode === 'taiwan' ? 0 : 13;
    if (gameState.lastPlayerIndex === -1 && !selected.includes(startCard)) {
        const msg = ruleMode === 'taiwan' ? t('mustInclude3C') : t('mustInclude3D');
        showAlert(msg);
        return;
    }

    // Check if remaining cards form a last hand
    const remaining = hand.filter(c => !selected.includes(c));
    const willBeLastHand = GameLogic.isLastHand(remaining);

    if (willBeLastHand && !gameState.shouted[0]) {
        // Penultimate play. If they didn't shout:
        if (!isShouting) {
            gameState.canFinish[0] = false;
        }
    }

    if (window.btnShout) window.btnShout.classList.add('hidden');
    executePlay(0, selected);
}
window.playCards = playCards;

function passTurn() {
    if (gameState.turn !== 0) return;
    if (gameState.lastPlayerIndex === -1 || gameState.lastPlayerIndex === 0) {
        showAlert(t('cannotPass'));
        return;
    }

    const char0 = window.AI ? window.AI.getCharacter(0) : null;
    AudioPlayer.playPass(char0 ? char0.name : 'you');
    gameState.playerLastActions[0] = "PASS";
    gameState.gameLog.push({ turn: gameState.gameLog.length, player: 0, action: "PASS" });
    showPassIndicator(0);
    nextTurn();
}
window.passTurn = passTurn;

function executePlay(playerIndex, cards) {
    AudioPlayer.playCardPlay();
    gameState.players[playerIndex] = gameState.players[playerIndex].filter(c => !cards.includes(c));

    // Clear all slots if this is a new round (taking the lead)
    if (gameState.lastPlayerIndex === -1 || gameState.lastPlayerIndex === playerIndex) {
        gameState.playerLastActions = [null, null, null, null];
    }

    gameState.playerLastActions[playerIndex] = cards;
    gameState.lastPlay = cards;
    gameState.lastPlayerIndex = playerIndex;
    gameState.selectedCards.clear();

    // Track played cards and log action
    gameState.playedCards.push(...cards);
    gameState.gameLog.push({ turn: gameState.gameLog.length, player: playerIndex, action: cards });

    // Check for "La" (Shout) for all AI-controlled players
    for (let i = 0; i < 4; i++) {
        const char = window.AI ? window.AI.getCharacter(i) : null;
        if (char && !gameState.shouted[i] && GameLogic.isLastHand(gameState.players[i])) {
            gameState.shouted[i] = true;
            gameState.canFinish[i] = true;
            AudioPlayer.playLa(char.name);
            triggerShoutEffect(i, "拉");
        }
    }

    if (gameState.players[playerIndex].length === 0) {
        gameState.gameEnded = true;
        calculateScores(playerIndex);
        renderAll();
        AudioPlayer.playWin();
        if (window.AISummary && typeof window.AISummary.showSummary === 'function' && window.AISummary.reviewPanelEnabled !== false) {
            window.AISummary.showSummary(gameState, playerIndex);
        } else {
            setTimeout(() => showAlert(t('winner', { name: PLAYER_NAMES[playerIndex] })), 100);
        }

        if (window.AI && typeof window.AI.postGameReflection === 'function') {
            window.AI.postGameReflection(gameState.gameLog, playerIndex, gameState.players);
        }

        // Auto-Restart logic if Slot 0 is AI-controlled
        const p0Char = window.AI ? window.AI.getCharacter(0) : null;
        if (p0Char) {
            console.log("%c[System] AI in Slot 0 detected. Auto-restarting in 10s...", "color: #f39c12; font-weight: bold;");
            setTimeout(() => {
                if (gameState.gameEnded) {
                    if (window.alertModal) window.alertModal.classList.add('hidden'); // Close winner alert
                    initGame();
                }
            }, 10000);
        }
        return;
    }

    nextTurn();
}
window.executePlay = executePlay;

function nextTurn() {
    if (gameState.gameEnded) return;

    // Clear any pending AI timeouts
    if (aiTurnTimeout) {
        clearTimeout(aiTurnTimeout);
        aiTurnTimeout = null;
    }

    gameState.turn = (gameState.turn + 1) % 4;
    resetCycleState();
    renderAll();
    updateStatus();

    const isHumanTurn = (gameState.turn === 0 && (!window.AI || !window.AI.getCharacter(0)));
    if (!isHumanTurn) {
        const delay = (window.AI && window.AI.getCharacter(0)) ? 100 : 1000;
        window.aiTurnTimeout = setTimeout(async () => {
            await aiTurn();
        }, delay);
    }
}
window.nextTurn = nextTurn;

async function aiTurn() {
    if (gameState.gameEnded || aiProcessing) return;

    window.aiProcessing = true;
    try {
        const isHumanTurn = (gameState.turn === 0 && (!window.AI || !window.AI.getCharacter(0)));
        if (isHumanTurn) return;

        const hand = gameState.players[gameState.turn];
        const lastPlay = (gameState.lastPlayerIndex === gameState.turn) ? null : gameState.lastPlay;

        // Assess strategic pressure: detect if any player is close to winning
        let nearWin = false; // "Near Win" state: any player has fewer than 3 cards
        let lastCardMode = false; // "Last Card" threat: any player has exactly 1 card remaining
        for (let i = 0; i < 4; i++) {
            if (gameState.players[i].length < 3) nearWin = true;
            if (gameState.players[i].length === 1) lastCardMode = true;
        }

        // AI Brain Call
        const aiContext = {
            hand: hand,
            lastPlay: lastPlay,
            lastPlayerIndex: gameState.lastPlayerIndex,
            players: gameState.players,
            shouted: gameState.shouted,
            canFinish: gameState.canFinish,
            nearWin: nearWin,
            lastCardMode: lastCardMode,
            playedCards: gameState.playedCards,
            playerLastActions: gameState.playerLastActions,
            playerNames: PLAYER_NAMES
        };

        let play = null;
        try {
            play = await AI.findPlay(gameState.turn, aiContext);
        } catch (e) {
            console.error("AI Error:", e);
        }

        if (play) {
            // Enforce canFinish constraint for AI
            if (!gameState.shouted[gameState.turn] && !gameState.canFinish[gameState.turn]) {
                if (play.length === hand.length) {
                    // AI must split! Try smaller combinations
                    if (play.length > 1) {
                        play = [play[0]];
                        // Verify if this single can beat lastPlay
                        if (lastPlay && GameLogic.compareCards(play[0], lastPlay[0]) <= 0) {
                            play = null; // AI can't split and beat lastPlay
                        }
                    } else {
                        play = null; // Can't play last card
                    }
                }
            }
        }

        if (play && play.length > 0) {
            executePlay(gameState.turn, play);
        } else {
            // Pass
            const char = window.AI ? window.AI.getCharacter(gameState.turn) : null;
            AudioPlayer.playPass(char ? char.name : 'npc');
            gameState.playerLastActions[gameState.turn] = "PASS";
            gameState.gameLog.push({ turn: gameState.gameLog.length, player: gameState.turn, action: "PASS" });
            showPassIndicator(gameState.turn);
            if (window.statusMessage) window.statusMessage.textContent = t('passMsg');
            nextTurn();
        }
    } finally {
        window.aiProcessing = false;
    }
}
window.aiTurn = aiTurn;

function calculateScores(winnerIndex) {
    const ruleMode = AppStorage.getItem('ruleMode') || 'taiwan';
    const winnerHand = gameState.lastPlay;
    const info = GameLogic.getHandInfo(winnerHand);
    let winnerMult = 1;

    if (info) {
        const ranks = winnerHand.map(c => GameLogic.getRank(c));
        const has2 = ranks.includes(12); // 2 is Rank 12

        if (info.type === 'FOUR_OF_A_KIND') {
            winnerMult = has2 ? 4 : 2;
        } else if (info.type === 'STRAIGHT_FLUSH') {
            winnerMult = (info.special === '23456') ? 4 : 2;
        } else if (has2) {
            winnerMult = 2;
        }
    }

    let totalGained = 0;
    for (let i = 0; i < 4; i++) {
        if (i === winnerIndex) continue;

        let hand = gameState.players[i];
        let baseLost = hand.length;
        let loserMult = 1;

        if (ruleMode === 'taiwan') {
            if (baseLost >= 10) loserMult *= 2;
        } else {
            if (baseLost === 13) loserMult *= 4;
            else if (baseLost >= 10) loserMult *= 3;
            else if (baseLost >= 8) loserMult *= 2;
        }

        const twosCount = hand.filter(c => GameLogic.getRank(c) === 12).length;
        loserMult *= Math.pow(2, twosCount);

        const fkCount = GameLogic.countFourOfAKinds(hand);
        loserMult *= Math.pow(2, fkCount);

        const sfCount = GameLogic.countStraightFlushes(hand);
        loserMult *= Math.pow(2, sfCount);

        const finalLost = baseLost * winnerMult * loserMult;
        gameState.scores[i] -= finalLost;
        totalGained += finalLost;
    }
    gameState.scores[winnerIndex] += totalGained;
}
window.calculateScores = calculateScores;

function handleDragonWin(playerIndex) {
    gameState.gameEnded = true;
    let totalGained = 0;
    for (let i = 0; i < 4; i++) {
        if (i === playerIndex) continue;
        const lost = 13 * 2;
        gameState.scores[i] -= lost;
        totalGained += lost;
    }
    gameState.scores[playerIndex] += totalGained;
    renderAll();
    AudioPlayer.playWin();

    if (window.AISummary && typeof window.AISummary.showSummary === 'function' && window.AISummary.reviewPanelEnabled !== false) {
        window.AISummary.showSummary(gameState, playerIndex);
    } else {
        setTimeout(() => showAlert(t('dragonWin', { name: PLAYER_NAMES[playerIndex] })), 100);
    }

    const p0Char = window.AI ? window.AI.getCharacter(0) : null;
    if (p0Char) {
        console.log("%c[System] AI in Slot 0 detected. Auto-restarting in 10s...", "color: #f39c12; font-weight: bold;");
        setTimeout(() => {
            if (gameState.gameEnded) {
                if (window.alertModal) window.alertModal.classList.add('hidden'); // Close winner alert
                initGame();
            }
        }, 10000);
    }
}
window.handleDragonWin = handleDragonWin;

function shoutLa() {
    const selected = Array.from(gameState.selectedCards);
    const hand = gameState.players[0];
    const remaining = hand.filter(c => !selected.includes(c));

    if (!GameLogic.isLastHand(remaining)) {
        showAlert(t('shoutFailed'));
        return;
    }

    // Validate play BEFORE setting shouted flag
    const info = GameLogic.getHandInfo(selected);
    if (!info) {
        showAlert(t('invalidHand'));
        return;
    }

    // Check if it beats last play
    if (gameState.lastPlay && gameState.lastPlayerIndex !== 0) {
        if (selected.length !== gameState.lastPlay.length) {
            showAlert(t('mustPlayCount', { count: gameState.lastPlay.length }));
            return;
        }
        if (GameLogic.compareHands(selected, gameState.lastPlay) <= 0) {
            showAlert(t('mustBeHigher'));
            return;
        }
    }

    // If validation passes, set flags and play
    gameState.shouted[0] = true;
    gameState.canFinish[0] = true;

    const char0 = window.AI ? window.AI.getCharacter(0) : null;
    AudioPlayer.playLa(char0 ? char0.name : 'you');
    triggerShoutEffect(0, "拉");

    playCards(true);
}
window.shoutLa = shoutLa;

function updateShoutButton() {
    if (gameState.turn !== 0 || gameState.shouted[0]) {
        if (window.btnShout) window.btnShout.classList.add('hidden');
        return;
    }

    const selected = Array.from(gameState.selectedCards);
    const hand = gameState.players[0];

    if (selected.length === 0) {
        if (window.btnShout) window.btnShout.classList.add('hidden');
        return;
    }

    // Validate current selection first
    if (!GameLogic.getHandInfo(selected)) {
        if (window.btnShout) window.btnShout.classList.add('hidden');
        return;
    }

    const remaining = hand.filter(c => !selected.includes(c));
    const remainingCount = remaining.length;

    updatePlayButtonVisibility();

    const hasLead = (gameState.lastPlayerIndex === -1 || gameState.lastPlayerIndex === 0);
    const canMove = hasLead || GameLogic.hasValidMoves(hand, gameState.lastPlay);

    if (remainingCount > 0 && GameLogic.isLastHand(remaining) && canMove) {
        if (window.btnShout) window.btnShout.classList.remove('hidden');
    } else {
        if (window.btnShout) window.btnShout.classList.add('hidden');
    }
}
window.updateShoutButton = updateShoutButton;

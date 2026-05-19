let ipcRenderer = null;
if (typeof require !== 'undefined') {
    try {
        const electron = require('electron');
        ipcRenderer = electron.ipcRenderer;
    } catch (e) {
        console.warn('[Renderer] Running in non-Electron environment. ipcRenderer disabled.');
    }
}

// Dynamically handle mobile-layout based on environment and window width
function updateResponsiveLayout() {
    const isAndroid = (typeof AppEnv !== 'undefined' && AppEnv.isAndroid);
    const isNarrow = window.innerWidth < 900; // Trigger mobile layout below 900px
    if (isAndroid || isNarrow) {
        document.body.classList.add('mobile-layout');
        document.documentElement.classList.add('mobile-layout');
    } else {
        document.body.classList.remove('mobile-layout');
        document.documentElement.classList.remove('mobile-layout');
    }
}
updateResponsiveLayout();
window.addEventListener('resize', updateResponsiveLayout);

/**
 * Renderer Process Logic
 */

const humanCardsContainer = document.getElementById('human-cards');
const lastPlayContainer = document.getElementById('last-play');
const statusMessage = document.getElementById('status-message');
const btnPlay = document.getElementById('btn-play');
const btnPass = document.getElementById('btn-pass');
const btnNew = document.getElementById('btn-new');
const btnShout = document.getElementById('btn-shout');
const infoIcon = document.getElementById('info-icon');
const rulesModal = document.getElementById('rules-modal');
const alertModal = document.getElementById('alert-modal');
const alertMessage = document.getElementById('alert-message');

const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmYes = document.getElementById('confirm-yes');
const confirmNo = document.getElementById('confirm-no');
const closeBtn = document.querySelector('.close-btn');
const langToggle = document.getElementById('lang-toggle');
const muteToggle = document.getElementById('mute-toggle');
const trialStatus = document.getElementById('trial-status');
let trialDaysRemaining = null;
let soundMode = parseInt(AppStorage.getItem('soundMode')) || 0; // 0: All, 1: SFX Only, 2: None

const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];
const RANK_LABELS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

const PLAYER_NAMES_EN = ["You", "Alex (NPC)", "Bella (NPC)", "Chris (NPC)"];
const PLAYER_NAMES_ZH = ["你", "艾力克斯 (NPC)", "貝拉 (NPC)", "克里斯 (NPC)"];
let PLAYER_NAMES = PLAYER_NAMES_ZH;



let currentLang = 'zh';

// Keyboard interaction state
let cycleIndex = -1;
let downKeyCount = 0;
let lastDownKeyTime = 0;

function resetCycleState() {
    cycleIndex = -1;
    downKeyCount = 0;
}

function updateLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (I18N[currentLang][key]) {
            el.textContent = I18N[currentLang][key];
        }
    });

    // Populate License & Sponsor tab dynamically to support clickable links safely
    const buildTarget = ipcRenderer ? ipcRenderer.sendSync('get-build-target') : 'GITHUB';
    const licenseSponsorTextElement = document.getElementById('license-sponsor-text-element');
    if (licenseSponsorTextElement) {
        if (buildTarget === 'STORE') {
            licenseSponsorTextElement.innerHTML = I18N[currentLang].rulesSourceStore || I18N['en'].rulesSourceStore;
        } else {
            licenseSponsorTextElement.innerHTML = I18N[currentLang].rulesSourceSponsor || I18N['en'].rulesSourceSponsor;
        }
        
        // Setup link click event handlers (supports Electron, Capacitor, and general web browsers)
        const rulesGhLink = document.getElementById('rules-github-link');
        const rulesSpLink = document.getElementById('rules-sponsor-link');
        const openLink = (url) => {
            if (typeof require !== 'undefined' && ipcRenderer) {
                try {
                    const { shell } = require('electron');
                    shell.openExternal(url);
                } catch (e) {
                    window.open(url, '_blank');
                }
            } else {
                window.open(url, '_blank');
            }
        };

        if (rulesGhLink) {
            rulesGhLink.onclick = (e) => {
                e.preventDefault();
                openLink('https://github.com/mesmerli/taiwan-big-two-ai');
            };
        }
        if (rulesSpLink) {
            rulesSpLink.onclick = (e) => {
                e.preventDefault();
                openLink('https://github.com/sponsors/mesmerli');
            };
        }
    }

    const licenseStoreStatus = document.getElementById('license-store-status');
    if (licenseStoreStatus) {
        if (buildTarget === 'STORE') {
            const licenseStatus = ipcRenderer ? ipcRenderer.sendSync('get-license-status-sync') : null;
            if (!licenseStatus) {
                licenseStoreStatus.textContent = t('storeCheckingLicense');
                licenseStoreStatus.style.color = '#94a3b8';
            } else if (licenseStatus.isTrial) {
                const now = new Date();
                const expirationDate = new Date(licenseStatus.expirationDate);
                const daysLeft = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
                licenseStoreStatus.textContent = t('trialDaysLeft', { days: daysLeft });
                licenseStoreStatus.style.color = '#f39c12';
            } else {
                licenseStoreStatus.textContent = t('storeFullVersion');
                licenseStoreStatus.style.color = '#10b981';
            }
        } else if (ipcRenderer) {
            licenseStoreStatus.textContent = t('githubVersionWarning');
            licenseStoreStatus.style.color = '#ef4444';
        } else {
            licenseStoreStatus.textContent = '';
        }
    }

    // Update Rules Footer (Version & Author)
    let pkg = { version: "1.5.0", author: "mesmerli", buildVersion: "1.5.0.0" };
    if (typeof require !== 'undefined') {
        try {
            pkg = require('./package.json');
        } catch (e) {
            console.warn('[Renderer] package.json require failed, using fallbacks.');
        }
    }
    const rulesVersion = document.getElementById('rules-version');
    const rulesAuthor = document.getElementById('rules-author');
    if (rulesVersion) rulesVersion.textContent = `v${pkg.buildVersion || pkg.version}`;
    if (rulesAuthor) rulesAuthor.textContent = `${I18N[currentLang].author || 'Author'}: ${pkg.author || 'mesmerli'}`;

    // Dynamic Character Name Sync
    const names = currentLang === 'zh' ? PLAYER_NAMES_ZH : PLAYER_NAMES_EN;
    PLAYER_NAMES = [...names]; // Start with defaults

    if (window.AI && typeof window.AI.getNames === 'function') {
        const aiData = window.AI.getNames();
        // Update all names and avatars (indices 0 to 3)
        for (let i = 0; i <= 3; i++) {
            const playerEl = document.getElementById(i === 0 ? 'human-area' : `player-${i + 1}`);
            if (!playerEl) continue;

            if (aiData[i]) {
                const data = aiData[i];
                let suffix = '';
                if (data.isLLM) {
                    suffix = currentLang === 'zh' ? ' (AI)' : ' (AI)';
                } else {
                    suffix = currentLang === 'zh' ? ' (電腦)' : ' (NPC)';
                }

                PLAYER_NAMES[i] = data.name + suffix;

                const avatarEl = playerEl.querySelector('.avatar');
                if (avatarEl) {
                    if (data.avatar && data.avatar.includes('src/assets/avatars/')) {
                        avatarEl.innerHTML = `<img src="${data.avatar}" alt="${data.name}">`;
                    } else {
                        avatarEl.textContent = data.avatar;
                    }
                    if (data.isLLM) avatarEl.classList.add('llm-glow');
                    else avatarEl.classList.remove('llm-glow');
                }

                // Show/Hide Gear Icon
                const gearIcon = playerEl.querySelector('.settings-icon');
                if (gearIcon) {
                    if (data.isLLM) gearIcon.classList.remove('hidden');
                    else gearIcon.classList.add('hidden');
                }
            } else {
                // It's a human (either slot 0 or an AI slot swapped to human)
                PLAYER_NAMES[i] = currentLang === 'zh' ? '你' : 'You';
                const avatarEl = playerEl.querySelector('.avatar');
                if (avatarEl) {
                    avatarEl.innerHTML = `<img src="src/assets/avatars/avatar_you.png" alt="You">`;
                    avatarEl.classList.remove('llm-glow');
                }
                const gearIcon = playerEl.querySelector('.settings-icon');
                if (gearIcon) gearIcon.classList.add('hidden');
            }
        }
    }


    document.title = t('title');
    if (ipcRenderer) {
        ipcRenderer.send('update-lang', currentLang);
    }
    updateMuteUI();
    updateTrialStatusUI();
    renderAll();
}

function updateTrialStatusUI() {
    if (!trialStatus || trialDaysRemaining === null) return;
    trialStatus.textContent = t('trialDaysLeft', { days: trialDaysRemaining });
    trialStatus.title = t('trialClickToBuy');
    trialStatus.classList.remove('hidden');
}

if (trialStatus) {
    trialStatus.addEventListener('click', () => {
        if (ipcRenderer) ipcRenderer.send('open-store');
    });
}

if (ipcRenderer) {
    ipcRenderer.on('license-status', (event, status) => {
        if (status.isTrial) {
            trialDaysRemaining = status.daysLeft;
            updateTrialStatusUI();
        } else if (status.isFullVersion) {
            trialDaysRemaining = null;
            if (trialStatus) trialStatus.classList.add('hidden');
        }
    });
}

function t(key, params = {}) {
    let str = I18N[currentLang][key] || key;
    for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, v);
    }
    return str;
}

let gameState = {
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

let aiTurnTimeout = null;
let aiProcessing = false;

function initGame() {
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

    // Find who has 3 of Clubs (Card 0)
    for (let i = 0; i < 4; i++) {
        if (gameState.players[i].includes(0)) {
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
    btnShout.classList.add('hidden');

    renderAll();
    updateStatus();

    const isHumanTurn = (gameState.turn === 0 && (!window.AI || !window.AI.getCharacter(0)));
    if (!isHumanTurn) {
        const delay = (window.AI && window.AI.getCharacter(0)) ? 100 : 1000;
        setTimeout(aiTurn, delay);
    }
}

function renderAll() {
    renderHumanHand();
    renderAIPlayers();
    renderPlayerActions();
    updateStatus();
    updatePlayButtonVisibility();
}

// Tab Switching Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        const tabId = btn.getAttribute('data-tab');
        const modal = btn.closest('.modal-content');
        
        // Update buttons
        modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update content
        modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        modal.querySelector(`#tab-${tabId}`).classList.add('active');
    };
});

function renderHumanHand() {
    humanCardsContainer.innerHTML = '';
    gameState.players[0].forEach(cardId => {
        const cardEl = createCardElement(cardId);
        if (gameState.selectedCards.has(cardId)) {
            cardEl.classList.add('selected');
        }
        cardEl.onclick = () => {
            AudioPlayer.playCardSelect();
            if (gameState.selectedCards.has(cardId)) {
                gameState.selectedCards.delete(cardId);
            } else {
                gameState.selectedCards.add(cardId);
            }
            renderHumanHand();
            updatePlayButtonVisibility();
            updateShoutButton();
        };
        humanCardsContainer.appendChild(cardEl);
    });
}

function createCardElement(cardId) {
    const rank = GameLogic.getRank(cardId);
    const suit = GameLogic.getSuit(cardId);
    const cardEl = document.createElement('div');
    cardEl.className = `card ${suit === 1 || suit === 2 ? 'red' : 'black'}`;
    cardEl.innerHTML = `
        <span class="rank">${RANK_LABELS[rank]}</span>
        <span class="suit">${SUIT_SYMBOLS[suit]}</span>
    `;
    return cardEl;
}

function renderAIPlayers() {
    for (let i = 1; i < 4; i++) {
        const el = document.getElementById(`player-${i + 1}`);
        const countEl = el.querySelector('.cards-count');
        const nameEl = el.querySelector('.name');
        const scoreEl = el.querySelector('.score') || createScoreElement(el);

        scoreEl.textContent = `Score: ${gameState.scores[i]}`;

        // Show cards if game ended, otherwise show count
        if (gameState.gameEnded) {
            countEl.innerHTML = '';
            const sortedHand = GameLogic.sortCards(gameState.players[i]);
            sortedHand.forEach(cardId => {
                const cardEl = createCardElement(cardId);
                cardEl.classList.add('revealed-card');
                countEl.appendChild(cardEl);
            });
            countEl.style.display = 'flex';
        } else {
            countEl.textContent = `${gameState.players[i].length} cards`;
            countEl.style.display = 'block';
        }

        nameEl.textContent = PLAYER_NAMES[i];

        if (gameState.shouted[i]) {
            nameEl.classList.add('shouted-name');
        } else {
            nameEl.classList.remove('shouted-name');
        }

        const hasLead = (gameState.lastPlayerIndex === -1 && i === gameState.turn) || (gameState.lastPlayerIndex === i);
        if (hasLead) {
            el.classList.add('has-lead');
        } else {
            el.classList.remove('has-lead');
        }

        if (gameState.turn === i) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    }

    const humanEl = document.getElementById('human-area');
    const humanNameEl = humanEl.querySelector('.name');
    const humanScoreEl = humanEl.querySelector('.score') || createScoreElement(humanEl);

    if (humanNameEl) {
        humanNameEl.textContent = PLAYER_NAMES[0];
        humanScoreEl.textContent = `Score: ${gameState.scores[0]}`;
        if (gameState.shouted[0]) {
            humanNameEl.classList.add('shouted-name');
        } else {
            humanNameEl.classList.remove('shouted-name');
        }
    }

    const hasLeadHuman = (gameState.lastPlayerIndex === -1 && gameState.turn === 0) || (gameState.lastPlayerIndex === 0);
    if (hasLeadHuman) {
        humanEl.classList.add('has-lead');
    } else {
        humanEl.classList.remove('has-lead');
    }

    if (gameState.turn === 0) {
        humanEl.classList.add('active');
    } else {
        humanEl.classList.remove('active');
    }
}

function renderPlayerActions() {
    for (let i = 0; i < 4; i++) {
        const slot = document.getElementById(`played-${i + 1}`);
        if (!slot) continue;
        slot.innerHTML = '';

        const action = gameState.playerLastActions[i];
        if (!action) continue;

        if (action === "PASS") {
            const passEl = document.createElement('div');
            passEl.className = 'slot-pass';
            passEl.textContent = t('passMsg');
            slot.appendChild(passEl);
        } else {
            action.forEach(cardId => {
                const cardEl = createCardElement(cardId);
                cardEl.classList.add('slot-card');
                slot.appendChild(cardEl);
            });
        }
    }
}

function updateStatus() {
    if (gameState.players[0].length === 0 && !gameState.gameEnded) {
        statusMessage.textContent = t('waiting');
        return;
    }

    if (gameState.gameEnded) {
        // Find winner if any
        for (let i = 0; i < 4; i++) {
            if (gameState.players[i].length === 0) {
                statusMessage.textContent = t('winner', { name: PLAYER_NAMES[i] });
                return;
            }
        }
        return;
    }

    const isHumanTurn = (gameState.turn === 0 && (!window.AI || !window.AI.getCharacter(0)));
    if (isHumanTurn) {
        statusMessage.textContent = t('yourTurn');
    } else {
        statusMessage.textContent = t('npcTurn', { name: PLAYER_NAMES[gameState.turn] });
    }
}

function updatePlayButtonVisibility() {
    const hand = gameState.players[0];
    const selected = Array.from(gameState.selectedCards);
    const remainingCount = hand.length - selected.length;

    if (gameState.gameEnded) {
        btnPlay.classList.add('hidden');
        btnPass.classList.add('hidden');
        btnShout.classList.add('hidden');
        return;
    }

    // Hide buttons if not human turn
    const isHumanTurn = (gameState.turn === 0 && (!window.AI || !window.AI.getCharacter(0)));
    if (!isHumanTurn) {
        btnPlay.classList.add('hidden');
        btnPass.classList.add('hidden');
        btnShout.classList.add('hidden');
        return;
    }

    // --- Button Visibility Logic ---
    let canMove = true;
    const hasLead = (gameState.lastPlayerIndex === -1 || gameState.lastPlayerIndex === 0);

    if (!hasLead) {
        if (gameState.shouted[0]) {
            // If shouted, must play ENTIRE hand.
            const info = GameLogic.getHandInfo(hand);
            if (info && hand.length === gameState.lastPlay.length && GameLogic.compareHands(hand, gameState.lastPlay) > 0) {
                canMove = true;
            } else {
                canMove = false;
            }
        } else {
            canMove = GameLogic.hasValidMoves(hand, gameState.lastPlay);
        }
    }


    // Helper to check if current selection is valid and beats table
    const isSelectionValid = () => {
        if (selected.length === 0) return false;
        const info = GameLogic.getHandInfo(selected);
        if (!info) return false;
        if (!hasLead && gameState.lastPlay) {
            if (selected.length !== gameState.lastPlay.length) return false;
            if (GameLogic.compareHands(selected, gameState.lastPlay) <= 0) return false;
        }
        // First turn rule: Must include 3 of Clubs (Card 0)
        if (gameState.lastPlayerIndex === -1 && !selected.includes(0)) return false;
        return true;
    };

    if (gameState.shouted[0]) {
        // Case A: Already shouted "La" - Must play all cards
        // Show Play as a hint if the player CAN win this round
        if (hasLead || canMove) {
            btnPlay.classList.remove('hidden');
        } else {
            btnPlay.classList.add('hidden');
        }
    } else {
        // Case B: Not shouted yet
        if (hasLead || canMove) {
            // Rule: If selection leaves exactly 1 card, must use Shout button
            const remaining = hand.filter(c => !selected.includes(c));
            if (remaining.length === 1 && isSelectionValid()) {
                btnPlay.classList.add('hidden');
            } else {
                btnPlay.classList.remove('hidden');
            }
        } else {
            btnPlay.classList.add('hidden');
        }

    }

    // Hide Pass if player has the lead (new round or start)
    if (hasLead) {
        btnPass.classList.add('hidden');
    } else {
        btnPass.classList.remove('hidden');
    }

    // Hide Shout button if no valid move (only if not lead)
    if (!hasLead && !canMove) {
        btnShout.classList.add('hidden');
    }
}

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
        if (selected.length !== gameState.lastPlay.length) {
            showAlert(t('mustPlayCount', { count: gameState.lastPlay.length }));
            return;
        }
        if (GameLogic.compareHands(selected, gameState.lastPlay) <= 0) {
            showAlert(t('mustBeHigher'));
            return;
        }
    }

    // Special rule: first play must have 3 of Clubs if it's the very first turn
    if (gameState.lastPlayerIndex === -1 && !selected.includes(0)) {
        showAlert(t('mustInclude3C'));
        return;
    }

    // Check if remaining cards form a last hand
    const remaining = hand.filter(c => !selected.includes(c));
    const willBeLastHand = GameLogic.isLastHand(remaining);

    if (willBeLastHand && !gameState.shouted[0]) {
        // We need to ask the user if they want to shout LA now
        // If the button is already visible, it means they might have clicked it
        // Let's change the flow: show the button when they SELECT cards that leave a last hand
    }

    // Execute play
    if (willBeLastHand && !gameState.shouted[0]) {
        // This is the penultimate play. If they didn't shout via shoutLa button:
        // Note: shoutLa() will handle setting shouted = true
        if (!isShouting) {
            gameState.canFinish[0] = false;
        }
    }

    btnShout.classList.add('hidden');
    executePlay(0, selected);
}

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
        setTimeout(() => showAlert(t('winner', { name: PLAYER_NAMES[playerIndex] })), 100);

        if (window.AI && typeof window.AI.postGameReflection === 'function') {
            window.AI.postGameReflection(gameState.gameLog, playerIndex, gameState.players);
        }

        // Auto-Restart logic if Slot 0 is AI-controlled
        const p0Char = window.AI ? window.AI.getCharacter(0) : null;
        if (p0Char) {
            console.log("%c[System] AI in Slot 0 detected. Auto-restarting in 10s...", "color: #f39c12; font-weight: bold;");
            setTimeout(() => {
                if (gameState.gameEnded) {
                    alertModal.classList.add('hidden'); // Close winner alert
                    initGame();
                }
            }, 10000);
        }
        return;
    }

    nextTurn();
}

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
        aiTurnTimeout = setTimeout(async () => {
            await aiTurn();
        }, delay);
    }
}

async function aiTurn() {
    if (gameState.gameEnded || aiProcessing) return;

    aiProcessing = true;
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
                        // Just play the first card as single
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
            statusMessage.textContent = t('passMsg');
            nextTurn();
        }
    } finally {
        aiProcessing = false;
    }
}



function calculateScores(winnerIndex) {
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
            // Ending with 2, pair of 2s, full house with 2s, or 2-3-4-5-6 straight
            winnerMult = 2;
        }
    }

    let totalGained = 0;
    for (let i = 0; i < 4; i++) {
        if (i === winnerIndex) continue;

        let hand = gameState.players[i];
        let baseLost = hand.length;
        let loserMult = 1;

        // a. 10 cards penalty
        if (baseLost >= 10) loserMult *= 2;

        // b. Each '2' penalty
        const twosCount = hand.filter(c => GameLogic.getRank(c) === 12).length;
        loserMult *= Math.pow(2, twosCount);

        // c. Each Four of a Kind penalty
        const fkCount = GameLogic.countFourOfAKinds(hand);
        loserMult *= Math.pow(2, fkCount);

        // d. Each Straight Flush penalty
        const sfCount = GameLogic.countStraightFlushes(hand);
        loserMult *= Math.pow(2, sfCount);

        const finalLost = baseLost * winnerMult * loserMult;
        gameState.scores[i] -= finalLost;
        totalGained += finalLost;
    }
    gameState.scores[winnerIndex] += totalGained;
}

function handleDragonWin(playerIndex) {
    gameState.gameEnded = true;
    // Dragon win rule: others lose base * 2
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
    setTimeout(() => showAlert(t('dragonWin', { name: PLAYER_NAMES[playerIndex] })), 100);

    // Auto-Restart logic if Slot 0 is AI-controlled
    const p0Char = window.AI ? window.AI.getCharacter(0) : null;
    if (p0Char) {
        console.log("%c[System] AI in Slot 0 detected. Auto-restarting in 10s...", "color: #f39c12; font-weight: bold;");
        setTimeout(() => {
            if (gameState.gameEnded) {
                alertModal.classList.add('hidden'); // Close winner alert
                initGame();
            }
        }, 10000);
    }
}

function createScoreElement(parent) {
    const info = parent.querySelector('.info');
    const scoreEl = document.createElement('span');
    scoreEl.className = 'score';
    if (info) info.appendChild(scoreEl);
    else parent.appendChild(scoreEl);
    return scoreEl;
}

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

function updateShoutButton() {
    if (gameState.turn !== 0 || gameState.shouted[0]) {
        btnShout.classList.add('hidden');
        return;
    }

    const selected = Array.from(gameState.selectedCards);
    const hand = gameState.players[0];

    if (selected.length === 0) {
        btnShout.classList.add('hidden');
        return;
    }

    // Validate current selection first
    if (!GameLogic.getHandInfo(selected)) {
        btnShout.classList.add('hidden');
        return;
    }

    const remaining = hand.filter(c => !selected.includes(c));
    const remainingCount = remaining.length;

    // Use shared visibility logic
    updatePlayButtonVisibility();

    if (remainingCount > 0 && GameLogic.isLastHand(remaining)) {
        btnShout.classList.remove('hidden');
    } else {
        btnShout.classList.add('hidden');
    }
}

langToggle.onclick = () => {
    currentLang = currentLang === 'en' ? 'zh' : 'en';
    updateLanguage();
};

btnNew.onclick = () => {
    if (!gameState.gameEnded && gameState.players[0].length > 0) {
        showConfirm(t('confirmNewGame'), () => {
            initGame();
        });
    } else {
        initGame();
    }
};

btnPlay.onclick = playCards;
btnPass.onclick = passTurn;
btnShout.onclick = shoutLa;

function showConfirm(msg, onYes) {
    confirmMessage.textContent = msg;
    confirmModal.classList.remove('hidden');
    confirmYes.onclick = () => {
        confirmModal.classList.add('hidden');
        onYes();
    };
    confirmNo.onclick = () => confirmModal.classList.add('hidden');
}

function showPassIndicator(playerIndex) {
    triggerShoutEffect(playerIndex, t('passMsg'), false);
}

function triggerShoutEffect(playerIndex, message = "拉", shake = true) {
    const container = document.getElementById('game-container');
    const playerEl = playerIndex === 0 ? document.getElementById('human-area') : document.getElementById(`player-${playerIndex + 1}`);
    if (!playerEl) return;

    const bubble = playerEl.querySelector('.speech-bubble');
    if (bubble) {
        bubble.textContent = message;
        bubble.classList.remove('hidden');
        setTimeout(() => bubble.classList.add('hidden'), 2000);
    }

    // Screen Shake
    if (shake && container) {
        container.classList.remove('shake');
        void container.offsetWidth; // Trigger reflow
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 500);
    }
}

function showAlert(msg) {
    alertMessage.textContent = msg;
    alertModal.classList.remove('hidden');
}



infoIcon.onclick = () => rulesModal.classList.remove('hidden');
closeBtn.onclick = () => rulesModal.classList.add('hidden');
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        rulesModal.classList.add('hidden');
        alertModal.classList.add('hidden');
        confirmModal.classList.add('hidden');
        const settingsModal = document.getElementById('ai-settings-modal');
        if (settingsModal) settingsModal.classList.add('hidden');
    }
});

// Close Modal Logic for all Close Buttons (supports instant mobile touch)
document.querySelectorAll('.close-btn').forEach(btn => {
    const handleClose = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const modal = btn.closest('.modal');
        if (modal) modal.classList.add('hidden');
    };
    btn.onclick = handleClose;
    btn.addEventListener('touchstart', handleClose, { passive: false });
});



window.onclick = (event) => {
    const settingsModal = document.getElementById('ai-settings-modal');
    if (event.target === rulesModal || event.target === alertModal || event.target === confirmModal || event.target === settingsModal) {
        rulesModal.classList.add('hidden');
        alertModal.classList.add('hidden');
        confirmModal.classList.add('hidden');
        if (settingsModal) settingsModal.classList.add('hidden');
    }
};

// Initial run
setupAvatarClickListeners();
updateLanguage();
initGame();

function setupAvatarClickListeners() {
    const settingsModal = document.getElementById('ai-settings-modal');
    const apiUrlInput = document.getElementById('ai-api-url');
    const modelIdInput = document.getElementById('ai-model-id');
    const extraPromptInput = document.getElementById('ai-extra-prompt');
    const resetBtn = document.getElementById('ai-settings-reset');
    const clearLearningsBtn = document.getElementById('ai-clear-learnings');
    const learningsContainer = document.getElementById('ai-learnings-container');

    function updateLearningsUI(char) {
        if (!learningsContainer) return;
        learningsContainer.innerHTML = '';
        const learnings = char.learnings || [];
        if (learnings.length > 0) {
            learnings.forEach(item => {
                const div = document.createElement('div');
                div.className = 'learning-item';

                // Extract tip from object or use string
                const tipText = typeof item === 'string' ? item : item.tip;
                const priority = typeof item === 'string' ? 'P1' : (item.priority || 'P1');
                const count = typeof item === 'string' ? 1 : (item.count || 1);

                div.innerHTML = `
                    <div class="learning-header">
                        <span class="badge ${priority.toLowerCase()}">${priority}</span>
                        <span class="count-badge">x${count}</span>
                    </div>
                    <div class="learning-text">${tipText}</div>
                `;
                learningsContainer.appendChild(div);
            });
        } else {
            const div = document.createElement('div');
            div.className = 'learning-empty';
            div.textContent = currentLang === 'zh' ? '尚無學習紀錄' : 'No learnings yet';
            learningsContainer.appendChild(div);
        }
    }

    for (let i = 0; i <= 3; i++) {
        const playerEl = document.getElementById(i === 0 ? 'human-area' : `player-${i + 1}`);
        if (!playerEl) continue;

        const avatarEl = playerEl.querySelector('.avatar');
        const gearIcon = playerEl.querySelector('.settings-icon');

        if (avatarEl) {
            avatarEl.style.cursor = 'pointer';
            avatarEl.title = "Left click: Swap";

            // Left Click: Swap
            avatarEl.onclick = (e) => {
                if (window.AI && typeof window.AI.swapCharacter === 'function') {
                    const newChar = window.AI.swapCharacter(i);
                    if (newChar) {
                        avatarEl.style.transform = 'scale(1.2)';
                        setTimeout(() => { avatarEl.style.transform = ''; }, 200);
                        updateLanguage();
                        AudioPlayer.playCardSelect();

                        // If swapping during this slot's turn, trigger action immediately
                        if (gameState.turn === i) {
                            if (aiTurnTimeout) clearTimeout(aiTurnTimeout);
                            if (newChar.type !== "Human") {
                                updatePlayButtonVisibility();
                                updateStatus();
                                aiTurnTimeout = setTimeout(aiTurn, 500);
                            } else {
                                updateStatus();
                                updatePlayButtonVisibility();
                            }
                        }
                    }
                }
            };

            // Remove right-click from avatar
            avatarEl.oncontextmenu = null;
        }

        if (gearIcon) {
            gearIcon.onclick = async (e) => {
                e.stopPropagation();
                if (!window.AI) return;

                const char = window.AI.getCharacter(i);
                if (char && char.isLLM) {
                    currentEditingIndex = i;
                    const settings = char.getSettings();
                    apiUrlInput.value = settings.apiUrl || '';
                    modelIdInput.value = settings.modelId || '';
                    extraPromptInput.value = settings.extraPrompt || '';
                    settingsModal.classList.remove('hidden');

                    // Fetch models immediately when opening
                    fetchAvailableModels(apiUrlInput.value);

                    // Display learnings
                    updateLearningsUI(char);
                }
            };
        }
    }

    clearLearningsBtn.onclick = () => {
        if (currentEditingIndex !== -1 && window.AI) {
            const char = window.AI.getCharacter(currentEditingIndex);
            if (char && char.isLLM) {
                const msg = currentLang === 'zh' ? '確定要清除所有學習到的經驗嗎？' : 'Clear all learned strategic rules?';
                if (confirm(msg)) {
                    char.learnings = [];
                    if (typeof char.saveMemory === 'function') char.saveMemory();
                    updateLearningsUI(char);
                    AudioPlayer.playPass();
                }
            }
        }
    };

    const exportLearningsBtn = document.getElementById('ai-export-learnings');
    exportLearningsBtn.onclick = async () => {
        if (currentEditingIndex !== -1 && window.AI) {
            const char = window.AI.getCharacter(currentEditingIndex);
            if (char && char.isLLM) {
                const exportData = {
                    character: char.name,
                    timestamp: new Date().toISOString(),
                    learnings: char.learnings,
                    stats: char.stats
                };

                const defaultFilename = `${char.name}_Memory_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
                
                try {
                    const result = await window.SystemService.writeFile(defaultFilename, exportData);
                    if (result.success) {
                        AudioPlayer.playCardSelect();
                        console.log("[Export] Saved to: ", result.path || 'Web Download');
                    }
                } catch (err) {
                    showAlert(currentLang === 'zh' ? '匯出失敗' : 'Export failed');
                    console.error(err);
                }
            }
        }
    };

    const importLearningsBtn = document.getElementById('ai-import-learnings');
    importLearningsBtn.onclick = async () => {
        if (currentEditingIndex !== -1 && window.AI) {
            const char = window.AI.getCharacter(currentEditingIndex);
            if (char && char.isLLM) {
                try {
                    const result = await window.SystemService.readFile({ accept: '.json' });
                    if (result.success && result.data) {
                        const data = result.data;
                        
                        if (Array.isArray(data.learnings)) {
                            char.learnings = data.learnings;
                            if (data.stats) char.stats = data.stats;
                            
                            if (typeof char.saveMemory === 'function') char.saveMemory();
                            
                            updateLearningsUI(char);
                            showAlert(currentLang === 'zh' ? '記憶匯入成功！' : 'Memory imported successfully!');
                            AudioPlayer.playCardSelect();
                        } else {
                            throw new Error("Invalid format");
                        }
                    }
                } catch (err) {
                    showAlert(currentLang === 'zh' ? '匯入失敗：格式不正確' : 'Import failed: Invalid format');
                    console.error(err);
                }
            }
        }
    };

    async function fetchAvailableModels(apiUrl) {
        const modelList = document.getElementById('ai-model-list');
        if (!modelList) return;
        modelList.innerHTML = '';

        if (!apiUrl) return;

        const apiError = document.getElementById('ai-api-error');
        if (apiError) apiError.textContent = '';

        try {
            const urlObj = new URL(apiUrl);
            // Derive /v1/models from current completion URL
            const modelsUrl = `${urlObj.protocol}//${urlObj.host}/v1/models`;

            console.log(`[UI] Fetching models from: ${modelsUrl}`);
            const response = await fetch(modelsUrl);
            if (response.ok) {
                const data = await response.json();
                if (data && data.data) {
                    data.data.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.id;
                        modelList.appendChild(option);
                    });
                    console.log(`[UI] Loaded ${data.data.length} models into dropdown.`);
                }
            }
        } catch (e) {
            console.warn("[UI] Failed to fetch models for dropdown:", e);
            const apiError = document.getElementById('ai-api-error');
            if (apiError) apiError.textContent = `(${t('apiError')})`;
        }


    }

    const autoSave = () => {
        if (currentEditingIndex !== -1 && window.AI) {
            window.AI.setAICharacterSettings(currentEditingIndex, {
                apiUrl: apiUrlInput.value,
                modelId: modelIdInput.value,
                extraPrompt: extraPromptInput.value
            });
        }
    };

    // Refresh model list and auto-save when API URL is changed
    apiUrlInput.onchange = () => {
        fetchAvailableModels(apiUrlInput.value);
        autoSave();
    };

    modelIdInput.onchange = autoSave;
    extraPromptInput.onchange = autoSave;

    resetBtn.onclick = () => {
        const msg = currentLang === 'zh' ? '確定要重設為預設值嗎？' : 'Reset to defaults?';
        if (confirm(msg)) {
            if (currentEditingIndex !== -1 && window.AI) {
                const char = window.AI.getCharacter(currentEditingIndex);
                if (char && char.isLLM) {
                    // Remove specific character settings from storage
                    AppStorage.removeItem(char.settingsKey || `ai_settings_${char.name}`);

                    if (typeof char.loadSettings === 'function') {
                        char.loadSettings(); // Reload default values (Hardcoded defaults in class)
                        apiUrlInput.value = char.apiUrl;
                        modelIdInput.value = char.modelId;
                        extraPromptInput.value = char.extraPrompt;
                        fetchAvailableModels(apiUrlInput.value);
                    }
                }
            }
        }
    };

}

function updateMuteUI() {
    if (!muteToggle) return;

    let icon = '🔊';
    let tooltip = t('soundModeAll');

    if (soundMode === 1) {
        icon = '🔉';
        tooltip = t('soundModeSFX');
    } else if (soundMode === 2) {
        icon = '🔇';
        tooltip = t('soundModeNone');
    }

    muteToggle.textContent = icon;
    muteToggle.title = tooltip;
    AudioPlayer.setSoundMode(soundMode);
}

if (muteToggle) {
    muteToggle.onclick = () => {
        soundMode = (soundMode + 1) % 3;
        AppStorage.setItem('soundMode', soundMode);
        updateMuteUI();
    };
    // Initial sync
    updateMuteUI();
    AudioPlayer.playBGM();
}




window.addEventListener('keydown', (e) => {
    // 1. Close alert modal if visible, but don't return if it's ArrowDown
    if (!alertModal.classList.contains('hidden')) {
        alertModal.classList.add('hidden');
        if (e.key !== 'ArrowDown') return;
    }

    // 2. Triple Down shortcut (must work when gameEnded is true)
    if (e.key === 'ArrowDown' && gameState.gameEnded) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastDownKeyTime > 1000) {
            downKeyCount = 1;
        } else {
            downKeyCount++;
        }
        lastDownKeyTime = now;

        if (downKeyCount >= 3) {
            resetCycleState();
            initGame();
        }
        return;
    }

    // 3. Regular game state checks
    if (gameState.gameEnded) return;
    if (document.querySelector('.modal:not(.hidden)')) return;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        // Only allow cyclic selection if it's the human's turn
        const isHumanTurn = (gameState.turn === 0 && (!window.AI || !window.AI.getCharacter(0)));
        if (!isHumanTurn) return;

        const hand = gameState.players[0];
        const lastPlay = (gameState.lastPlayerIndex === 0) ? null : gameState.lastPlay;
        
        // Generate all legal moves using GameLogic
        const legalMoves = GameLogic.getLegalMoves(hand, lastPlay, gameState.lastPlayerIndex, 0, gameState.shouted);

        if (!legalMoves || legalMoves.length === 0) return;

        if (e.key === 'ArrowRight') {
            cycleIndex = (cycleIndex + 1) % legalMoves.length;
        } else {
            cycleIndex = (cycleIndex - 1 + legalMoves.length) % legalMoves.length;
        }

        const move = legalMoves[cycleIndex];
        gameState.selectedCards.clear();
        move.cards.forEach(c => gameState.selectedCards.add(c));
        
        renderHumanHand();
        updatePlayButtonVisibility();
        updateShoutButton();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const isHumanTurn = (gameState.turn === 0 && (!window.AI || !window.AI.getCharacter(0)));
        if (!isHumanTurn) return;
        
        const selected = Array.from(gameState.selectedCards);
        if (selected.length > 0) {
            const hand = gameState.players[0];
            const remainingCount = hand.length - selected.length;

            // If it's a shout situation, use shoutLa() logic
            if (remainingCount === 1) {
                shoutLa();
            } else {
                playCards();
            }
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (gameState.selectedCards.size > 0) {
            gameState.selectedCards.clear();
            resetCycleState();
            renderHumanHand();
            updatePlayButtonVisibility();
            updateShoutButton();
        }
    } else if (e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space' || e.keyCode === 32) {
        e.preventDefault();
        const isHumanTurn = (gameState.turn === 0 && (!window.AI || !window.AI.getCharacter(0)));
        if (!isHumanTurn) return;

        // Cannot pass if leading
        const lastPlay = (gameState.lastPlayerIndex === 0) ? null : gameState.lastPlay;
        if (!lastPlay || lastPlay.length === 0) return;

        passTurn();
    }
});

// Hide Electron custom window controls in non-Electron environments (Android/Capacitor/Browser)
(function() {
    if (typeof AppEnv !== 'undefined' && !AppEnv.isElectron) {
        const hideControls = () => {
            const controls = document.querySelectorAll('.window-controls');
            controls.forEach(el => {
                el.style.display = 'none';
            });
            console.log(`[Renderer] Non-Electron environment detected. Hidden ${controls.length} .window-controls elements.`);
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', hideControls);
        } else {
            hideControls();
        }
    }
})();






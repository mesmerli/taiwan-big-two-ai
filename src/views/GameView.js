// DOM Elements definitions on window/global scope for shared access
window.humanCardsContainer = document.getElementById('human-cards');
window.lastPlayContainer = document.getElementById('last-play');
window.statusMessage = document.getElementById('status-message');
window.btnPlay = document.getElementById('btn-play');
window.btnPass = document.getElementById('btn-pass');
window.btnNew = document.getElementById('btn-new');
window.btnShout = document.getElementById('btn-shout');
window.infoIcon = document.getElementById('info-icon');
window.rulesModal = document.getElementById('rules-modal');
window.alertModal = document.getElementById('alert-modal');
window.alertMessage = document.getElementById('alert-message');

window.confirmModal = document.getElementById('confirm-modal');
window.confirmMessage = document.getElementById('confirm-message');
window.confirmYes = document.getElementById('confirm-yes');
window.confirmNo = document.getElementById('confirm-no');
window.closeBtn = document.querySelector('.close-btn');
window.langToggle = document.getElementById('lang-toggle');
window.muteToggle = document.getElementById('mute-toggle');
window.trialStatus = document.getElementById('trial-status');

const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];
const RANK_LABELS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

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

function renderAll() {
    renderHumanHand();
    renderAIPlayers();
    renderPlayerActions();
    updateStatus();
    updatePlayButtonVisibility();
}

function renderHumanHand() {
    if (!humanCardsContainer) return;
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
                cardEl.classList.remove('selected');
            } else {
                gameState.selectedCards.add(cardId);
                cardEl.classList.add('selected');
            }
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
        if (!el) continue;
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
    if (humanEl) {
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
}

function renderPlayerActions() {
    for (let i = 0; i < 4; i++) {
        const slot = document.getElementById(`played-${i + 1}`);
        if (!slot) continue;
        slot.innerHTML = '';
        slot.classList.remove('active-play');

        const action = gameState.playerLastActions[i];
        if (!action) continue;

        if (i === gameState.lastPlayerIndex) {
            slot.classList.add('active-play');
        }

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
    if (!statusMessage) return;
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
            const isSelectedBomb = info.type === 'FOUR_OF_A_KIND' || info.type === 'STRAIGHT_FLUSH';
            const isLastPlaySingleOrPair = gameState.lastPlay.length === 1 || gameState.lastPlay.length === 2;

            if (selected.length !== gameState.lastPlay.length && !(isSelectedBomb && isLastPlaySingleOrPair)) {
                return false;
            }
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

function createScoreElement(parent) {
    const info = parent.querySelector('.info');
    const scoreEl = document.createElement('span');
    scoreEl.className = 'score';
    if (info) info.appendChild(scoreEl);
    else parent.appendChild(scoreEl);
    return scoreEl;
}

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
        bubble.classList.remove('shrunk-bubble', 'hover-expanded');
        bubble.textContent = message;
        
        const isShort = message.length <= 4;
        if (isShort) {
            bubble.classList.add('short-bubble');
            delete bubble.dataset.originalText;
        } else {
            bubble.classList.remove('short-bubble');
            bubble.dataset.originalText = message;
        }

        bubble.classList.remove('hidden');
        
        if (bubble._hideTimeout) {
            clearTimeout(bubble._hideTimeout);
        }
        bubble._hideTimeout = setTimeout(() => {
            if (isShort) {
                bubble.classList.add('hidden');
                bubble.classList.remove('short-bubble');
            } else {
                bubble.classList.add('shrunk-bubble');
                bubble.textContent = "💬";
            }
        }, isShort ? 2000 : 4500);
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

// Initialize speech bubble hover interactions
(function setupSpeechBubbleHovers() {
    const initHovers = () => {
        document.querySelectorAll('.speech-bubble').forEach(bubble => {
            bubble.addEventListener('mouseenter', () => {
                if (bubble.classList.contains('shrunk-bubble')) {
                    bubble.classList.remove('shrunk-bubble');
                    bubble.classList.add('hover-expanded');
                    if (bubble.dataset.originalText) {
                        bubble.textContent = bubble.dataset.originalText;
                    }
                }
            });
            bubble.addEventListener('mouseleave', () => {
                if (bubble.classList.contains('hover-expanded')) {
                    bubble.classList.remove('hover-expanded');
                    bubble.classList.add('shrunk-bubble');
                    bubble.textContent = "💬";
                }
            });
        });
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHovers);
    } else {
        initHovers();
    }
})();

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

// Export view functions globally
window.updateResponsiveLayout = updateResponsiveLayout;
window.renderAll = renderAll;
window.renderHumanHand = renderHumanHand;
window.createCardElement = createCardElement;
window.renderAIPlayers = renderAIPlayers;
window.renderPlayerActions = renderPlayerActions;
window.updateStatus = updateStatus;
window.updatePlayButtonVisibility = updatePlayButtonVisibility;
window.createScoreElement = createScoreElement;
window.showConfirm = showConfirm;
window.showPassIndicator = showPassIndicator;
window.triggerShoutEffect = triggerShoutEffect;
window.showAlert = showAlert;

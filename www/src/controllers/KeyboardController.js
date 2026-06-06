window.addEventListener('keydown', (e) => {
    // 1. Close alert modal if visible, but don't return if it's ArrowDown
    if (window.alertModal && !window.alertModal.classList.contains('hidden')) {
        window.alertModal.classList.add('hidden');
        if (e.key !== 'ArrowDown') return;
    }

    // 2. Triple Down shortcut (must work when gameEnded is true)
    if (e.key === 'ArrowDown' && gameState.gameEnded) {
        e.preventDefault();
        const now = Date.now();
        if (now - lastDownKeyTime > 1000) {
            window.downKeyCount = 1;
        } else {
            window.downKeyCount++;
        }
        window.lastDownKeyTime = now;

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
            window.cycleIndex = (cycleIndex + 1) % legalMoves.length;
        } else {
            window.cycleIndex = (cycleIndex - 1 + legalMoves.length) % legalMoves.length;
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
    } else if (e.key === 'Enter') {
        e.preventDefault();
        const isHumanTurn = (gameState.turn === 0 && (!window.AI || !window.AI.getCharacter(0)));
        if (!isHumanTurn) return;

        if (window.btnShout && !window.btnShout.classList.contains('hidden')) {
            shoutLa();
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

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (window.rulesModal) window.rulesModal.classList.add('hidden');
        if (window.alertModal) window.alertModal.classList.add('hidden');
        if (window.confirmModal) window.confirmModal.classList.add('hidden');
        const settingsModal = document.getElementById('ai-settings-modal');
        if (settingsModal) settingsModal.classList.add('hidden');
    }
});

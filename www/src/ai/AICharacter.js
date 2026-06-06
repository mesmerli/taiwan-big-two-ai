/**
 * Base class for AI characters
 */
class AICharacter {
    constructor(gameLogic, name) {
        this.GameLogic = gameLogic;
        this.name = name;
        this.type = "NPC";
        this.isLLM = false;
    }

    getLogic() {
        return this.GameLogic || window.GameLogic || (typeof GameLogic !== 'undefined' ? GameLogic : null);
    }

    /**
     * Common decision logic shared by all characters
     */
    async decide(context) {
        const Logic = this.getLogic();
        if (!Logic) return null;

        const { hand, lastPlay, lastPlayerIndex } = context;
        if (!hand || hand.length === 0) return null;

        const sorted = Logic.sortCards(hand);

        // --- Handle Lead (No active play to beat) ---
        if (!lastPlay || lastPlay.length === 0) {
            // First turn rule: Must include the starting card (Club 3 = 0 for Taiwan, Diamond 3 = 13 for HK)
            const ruleMode = typeof AppStorage !== 'undefined' ? (AppStorage.getItem('ruleMode') || 'taiwan') : 'taiwan';
            const startCard = ruleMode === 'taiwan' ? 0 : 13;
            const hasStartCard = hand.includes(startCard);
            if (hasStartCard && (lastPlayerIndex === -1 || lastPlayerIndex === undefined)) {
                if (ruleMode === 'hongkong') {
                    const triples = Logic.findTriples(hand).filter(t => t.includes(startCard));
                    if (triples.length > 0) return triples[0];
                }
                const five = Logic.findFiveCardHands(hand).filter(h => h.includes(startCard));
                if (five.length > 0) return five[0];
                const pairs = Logic.findPairs(hand).filter(p => p.includes(startCard));
                if (pairs.length > 0) return pairs[0];
                return [startCard];
            }
            return await this.chooseLead(sorted, context);
        }

        // --- Handle Following (Beat previous hand) ---
        return await this.chooseFollow(sorted, context);
    }

    /**
     * Default following logic (can be overridden)
     */
    async chooseFollow(sorted, context) {
        const Logic = this.getLogic();
        const { lastPlay } = context;
        const targetLen = lastPlay.length;

        if (targetLen === 1) {
            // Check if any opponent has only 1 card left (lastcard phase)
            const isLastCard = context.players && context.players.some((p, idx) => idx !== context.playerIndex && p && p.length === 1);
            
            // If it's not the lastcard phase and the played card has rank > 9 (King, Ace, 2), pass
            if (!isLastCard && Logic.getRank(lastPlay[0]) > 9) {
                return null;
            }

            if (isLastCard) {
                // Defensive play: Throw the BIGGEST card that can beat the table play
                for (let i = sorted.length - 1; i >= 0; i--) {
                    const c = sorted[i];
                    if (Logic.compareCards(c, lastPlay[0]) > 0) return [c];
                }
            } else {
                // Check if any opponent has 3 or fewer cards left (near win phase)
                const isOpponentNearWin = context.players && context.players.some((p, idx) => idx !== context.playerIndex && p && p.length <= 3);

                let candidates = [...sorted];
                if (!isOpponentNearWin) {
                    // Strip cards that belong to pairs or 5-card combinations to preserve good hands
                    const pairs = Logic.findPairs(sorted).flat();
                    const fiveCardHands = Logic.findFiveCardHands(sorted).flat();
                    candidates = sorted.filter(c => !pairs.includes(c) && !fiveCardHands.includes(c));
                    if (candidates.length === 0) {
                        candidates = sorted;
                    }
                }

                // Play the smallest card that beats the table
                for (let c of candidates) {
                    if (Logic.compareCards(c, lastPlay[0]) > 0) {
                        // Big-card preservation: Don't waste Ace (11) or 2 (12) on cards 10 or below (<= 7)
                        if (Logic.getRank(c) >= 11 && Logic.getRank(lastPlay[0]) <= 7) {
                            return null;
                        }
                        return [c];
                    }
                }

                // Fallback: If stripping prevented us from following, try the full sorted hand
                if (!isOpponentNearWin && candidates !== sorted) {
                    for (let c of sorted) {
                        if (Logic.compareCards(c, lastPlay[0]) > 0) {
                            if (Logic.getRank(c) >= 11 && Logic.getRank(lastPlay[0]) <= 7) {
                                return null;
                            }
                            return [c];
                        }
                    }
                }
            }
        } else if (targetLen === 2) {
            const pairs = Logic.findPairs(sorted);
            for (let pair of pairs) {
                if (Logic.compareHands(pair, lastPlay) > 0) return pair;
            }
        } else if (targetLen === 5) {
            const hands = Logic.findFiveCardHands(sorted);
            for (let h of hands) {
                if (Logic.compareHands(h, lastPlay) > 0) return h;
            }
        }
        return null;
    }

    // To be implemented by subclasses
    async chooseLead(sorted, context) {
        const { players } = context;
        const anyOpponentHasOne = players && players.some((p, idx) => idx !== context.playerIndex && p && p.length === 1);
        return anyOpponentHasOne ? [sorted[sorted.length - 1]] : [sorted[0]];
    }

    generatePrompt(context) {
        const { hand, lastPlay, players } = context;

        let prompt = `Current State:
- My Hand: [${hand.map(c => this.cardToVerboseString(c)).join(', ')}]
- Table Play to Beat: ${lastPlay && lastPlay.length > 0 ? `[${lastPlay.map(c => this.cardToVerboseString(c)).join(', ')}]` : 'None (You lead)'}
- Opponent Card Counts: ${players.map((p, i) => {
            if (i === context.playerIndex) return '';
            const name = (context.playerNames && context.playerNames[i]) ? context.playerNames[i] : `P${i + 1}`;
            return `${name}:${p.length}`;
        }).filter(s => s).join(', ')}

Instruction: ${lastPlay && lastPlay.length > 0 ? 'You must beat the table play or PASS.' : 'You are the leader of this round. Output your move in JSON.'}`;

        return prompt;
    }

    cardToVerboseString(cardId) {
        const suits = ['Club', 'Diamond', 'Heart', 'Spade'];
        const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
        const Logic = this.getLogic();
        return `${suits[Logic.getSuit(cardId)]} ${ranks[Logic.getRank(cardId)]}`;
    }

    cardToString(cardId) {
        const suits = ['C', 'D', 'H', 'S'];
        const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
        const Logic = this.getLogic();
        return `${ranks[Logic.getRank(cardId)]}${suits[Logic.getSuit(cardId)]}`;
    }

    async localDecide(context) {
        const Logic = this.getLogic();
        const { hand, lastPlay, playerIndex, shouted } = context;
        const sorted = Logic.sortCards(hand);

        // --- SHOUT RESTRICTION ---
        const isShouted = shouted && shouted[playerIndex];
        const isLastHand = Logic.isLastHand(hand);
        const shouldRestrictToFullHand = isShouted && isLastHand && hand.length > 1;

        if (shouldRestrictToFullHand) {
            const isLead = !lastPlay || lastPlay.length === 0;
            if (isLead) return sorted;
            if (Logic.compareHands(sorted, lastPlay) > 0) return sorted;
            return null; // Must PASS
        }
        // -------------------------

        if (!lastPlay || lastPlay.length === 0) {
            const five = Logic.findFiveCardHands(sorted);
            if (five.length > 0) return five[0];
            const { players } = context;
            const anyOpponentHasOne = players && players.some((p, idx) => idx !== playerIndex && p && p.length === 1);
            return anyOpponentHasOne ? [sorted[sorted.length - 1]] : [sorted[0]];
        } else {
            return await this.chooseFollow(sorted, context);
        }
    }
}

// Browser/Electron export
if (typeof module !== 'undefined') {
    module.exports = { AICharacter };
}

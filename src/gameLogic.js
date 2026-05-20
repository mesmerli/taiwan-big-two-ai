/**
 * Big Two Game Logic
 * Ported from original Palm OS C code
 */

const SUITS = {
    CLUB: 0,
    DIAMOND: 1,
    HEART: 2,
    SPADE: 3
};

const RANKS = {
    THREE: 0, FOUR: 1, FIVE: 2, SIX: 3, SEVEN: 4, EIGHT: 5, NINE: 6, TEN: 7,
    JACK: 8, QUEEN: 9, KING: 10, ACE: 11, TWO: 12
};

class GameLogic {
    static getRank(cardId) {
        return cardId % 13;
    }

    static getSuit(cardId) {
        return Math.floor(cardId / 13);
    }

    /**
     * Compare two cards
     * @returns {number} 1 if card1 > card2, -1 if card1 < card2, 0 if equal
     */
    static compareCards(card1, card2) {
        const r1 = this.getRank(card1);
        const r2 = this.getRank(card2);
        if (r1 > r2) return 1;
        if (r1 < r2) return -1;

        const s1 = this.getSuit(card1);
        const s2 = this.getSuit(card2);
        if (s1 > s2) return 1;
        if (s1 < s2) return -1;

        return 0;
    }

    static sortCards(cards) {
        return [...cards].sort((a, b) => this.compareCards(a, b));
    }

    /**
     * Hand Types: 1 (Single), 2 (Pair), 3 (Triple), 5 (5-card hand)
     */
    static getHandInfo(cards) {
        if (!cards || cards.length === 0) return null;
        const sorted = this.sortCards(cards);
        const len = cards.length;

        if (len === 13) {
            // Dragon check
            const ranks = sorted.map(c => this.getRank(c));
            const isDragon = ranks.every((r, i) => r === i);
            if (isDragon) {
                const isFlush = sorted.map(c => this.getSuit(c)).every((s, _, arr) => s === arr[0]);
                return { type: 'DRAGON', value: sorted[12], strength: 10, isFlush };
            }
        }

        if (len === 1) return { type: 'SINGLE', value: sorted[0] };
        if (len === 2) {
            if (this.getRank(sorted[0]) === this.getRank(sorted[1])) {
                return { type: 'PAIR', value: sorted[1] }; // Higher suit card determines value
            }
            return null;
        }
        // Standalone TRIPLE is not allowed in Taiwanese rules
        /*
        if (len === 3) {
            if (this.getRank(sorted[0]) === this.getRank(sorted[1]) && 
                this.getRank(sorted[1]) === this.getRank(sorted[2])) {
                return { type: 'TRIPLE', value: sorted[2] };
            }
            return null;
        }
        */
        if (len === 5) {
            return this.getFiveCardHandInfo(sorted);
        }
        return null;
    }

    static getFiveCardHandInfo(sorted) {
        const ranks = sorted.map(c => this.getRank(c));
        const suits = sorted.map(c => this.getSuit(c));

        const isFlush = suits.every(s => s === suits[0]);

        // Straight check
        let isStraight = true;
        for (let i = 0; i < 4; i++) {
            if (ranks[i + 1] !== ranks[i] + 1) {
                isStraight = false;
                break;
            }
        }
        // Special case: A-2-3-4-5 (Wait, check original code for low straight rules)
        // Original code EvaluateStraight line 722 mentions low straight
        if (!isStraight) {
            // Check for A-2-3-4-5 or other combos
            // In many Big Two variations, A-2-3-4-5 is a valid straight
            // Let's check if the original code handles this.
        }

        // Special Straights: 
        // 2-3-4-5-6 is largest (Ranks: 12, 0, 1, 2, 3) -> Wait, sorting by compareCards puts 12 last.
        // So 0-1-2-3-12 is 3-4-5-6-2 (Wait, the user said 2-3-4-5-6)
        // If 2 is rank 12, then 2-3-4-5-6 is ranks [12, 0, 1, 2, 3]
        // A-2-3-4-5 is ranks [11, 12, 0, 1, 2]

        const rankSet = new Set(ranks);
        const is23456 = [0, 1, 2, 3, 12].every(r => rankSet.has(r));
        const isA2345 = [0, 1, 2, 11, 12].every(r => rankSet.has(r));

        if (is23456) {
            const card2 = sorted.find(c => this.getRank(c) === 12);
            return { type: isFlush ? 'STRAIGHT_FLUSH' : 'STRAIGHT', value: card2, strength: isFlush ? 5 : 1, special: '23456' };
        }
        if (isA2345) {
            return { type: isFlush ? 'STRAIGHT_FLUSH' : 'STRAIGHT', value: sorted[2], strength: isFlush ? 5 : 1, special: 'A2345' };
        }

        if (isStraight && isFlush) return { type: 'STRAIGHT_FLUSH', value: sorted[4], strength: 5 };

        // Four of a kind
        if (ranks[0] === ranks[3]) return { type: 'FOUR_OF_A_KIND', value: sorted[0], strength: 4 };
        if (ranks[1] === ranks[4]) return { type: 'FOUR_OF_A_KIND', value: sorted[1], strength: 4 };

        // Full House
        if (ranks[0] === ranks[2] && ranks[3] === ranks[4]) return { type: 'FULL_HOUSE', value: sorted[0], strength: 3 };
        if (ranks[0] === ranks[1] && ranks[2] === ranks[4]) return { type: 'FULL_HOUSE', value: sorted[2], strength: 3 };

        // if (isFlush) return { type: 'FLUSH', value: sorted[4], strength: 2 }; // Flush not allowed in TW rules
        if (isStraight) return { type: 'STRAIGHT', value: sorted[4], strength: 1 };

        return null;
    }

    /**
     * Compare two hands of the same type
     */
    static compareHands(hand1, hand2) {
        const info1 = this.getHandInfo(hand1);
        const info2 = this.getHandInfo(hand2);

        if (!info1 || !info2) return 0;

        // Dragon is the largest
        if (info1.type === 'DRAGON' || info2.type === 'DRAGON') {
            if (info1.type === 'DRAGON' && info2.type === 'DRAGON') {
                if (info1.isFlush !== info2.isFlush) return info1.isFlush ? 1 : -1;
                return this.compareCards(info1.value, info2.value);
            }
            return info1.type === 'DRAGON' ? 1 : -1;
        }

        if (info1.type !== info2.type) {
            // Different types only allowed if both are 5-card hands
            if (hand1.length === 5 && hand2.length === 5) {
                return info1.strength > info2.strength ? 1 : -1;
            }
            return 0; // Invalid comparison
        }

        // Same type, compare values
        if (info1.type === 'SINGLE' || info1.type === 'PAIR' || info1.type === 'STRAIGHT' || info1.type === 'FLUSH' || info1.type === 'STRAIGHT_FLUSH') {
            if (info1.special === '23456' && info2.special !== '23456') return 1;
            if (info1.special !== '23456' && info2.special === '23456') return -1;
            if (info1.special === 'A2345' && info2.special !== 'A2345') return -1;
            if (info1.special !== 'A2345' && info2.special === 'A2345') return 1;

            return this.compareCards(info1.value, info2.value);
        }

        // Four of a kind or Full House: compare the rank of the quad/triple
        if (info1.type === 'FOUR_OF_A_KIND' || info1.type === 'FULL_HOUSE') {
            return this.compareCards(info1.value, info2.value);
        }


        return 0;
    }

    /**
     * AI Search Helpers
     */
    static findPairs(cards) {
        const pairs = [];
        const sorted = this.sortCards(cards);
        for (let i = 0; i < sorted.length - 1; i++) {
            if (this.getRank(sorted[i]) === this.getRank(sorted[i+1])) {
                let j = i + 1;
                while (j < sorted.length && this.getRank(sorted[j]) === this.getRank(sorted[i])) {
                    j++;
                }
                // Generate all combinations of 2 cards from this rank group
                for (let x = i; x < j - 1; x++) {
                    for (let y = x + 1; y < j; y++) {
                        pairs.push([sorted[x], sorted[y]]);
                    }
                }
                i = j - 1;
            }
        }
        return pairs;
    }

    static findTriples(cards) {
        const triples = [];
        const sorted = this.sortCards(cards);
        for (let i = 0; i < sorted.length - 2; i++) {
            if (this.getRank(sorted[i]) === this.getRank(sorted[i+1]) && 
                this.getRank(sorted[i+1]) === this.getRank(sorted[i+2])) {
                triples.push([sorted[i], sorted[i+1], sorted[i+2]]);
                i += 2;
            }
        }
        return triples;
    }

    static findFiveCardHands(cards) {
        const hands = [];
        const sf = this.findStraightFlushes(cards);
        if (sf.length > 0) hands.push(...sf);
        
        const fk = this.findFourOfAKinds(cards);
        if (fk.length > 0) hands.push(...fk);
        
        const fh = this.findFullHouses(cards);
        if (fh.length > 0) hands.push(...fh);

        const s = this.findStraights(cards);
        if (s.length > 0) hands.push(...s);

        return hands;
    }

    static findFlushes(cards) {
        const flushes = [];
        for (let suit = 0; suit < 4; suit++) {
            const suitCards = cards.filter(c => this.getSuit(c) === suit);
            if (suitCards.length >= 5) {
                const sorted = this.sortCards(suitCards);
                for (let i = 0; i <= sorted.length - 5; i++) {
                    const sub = sorted.slice(i, i + 5);
                    const info = this.getHandInfo(sub);
                    if (info && info.type === 'FLUSH') {
                        flushes.push(sub);
                    }
                }
            }
        }
        return flushes;
    }

    static findStraights(cards) {
        const straights = [];
        const sorted = [...new Set(cards.map(c => this.getRank(c)))].sort((a,b) => a-b);
        if (sorted.length < 5) return [];

        for (let i = 0; i <= sorted.length - 5; i++) {
            if (sorted[i+4] - sorted[i] === 4) {
                const combination = [];
                for (let j = 0; j < 5; j++) {
                    const rank = sorted[i+j];
                    const rankCards = cards.filter(c => this.getRank(c) === rank);
                    const bestCard = rankCards.sort((a,b) => this.compareCards(a,b)).pop();
                    combination.push(bestCard);
                }
                straights.push(combination);
            }
        }
        return straights;
    }

    static findFullHouses(cards) {
        const fhs = [];
        const triples = this.findTriples(cards);
        for (let t of triples) {
            // Only find pairs from cards NOT already in the triple
            const remaining = cards.filter(c => !t.includes(c));
            const pairs = this.findPairs(remaining);
            for (let p of pairs) {
                fhs.push([...t, ...p]);
            }
        }
        return fhs;
    }

    static findFourOfAKinds(cards) {
        const fks = [];
        const sorted = this.sortCards(cards);
        for (let i = 0; i < sorted.length - 3; i++) {
            if (this.getRank(sorted[i]) === this.getRank(sorted[i+3])) {
                const quad = sorted.slice(i, i+4);
                // Pick a kicker from the remaining cards
                const remaining = cards.filter(c => !quad.includes(c));
                if (remaining.length > 0) {
                    const sortedRemaining = this.sortCards(remaining);
                    fks.push([...quad, sortedRemaining[0]]); // Smallest kicker
                }
                i += 3;
            }
        }
        return fks;
    }

    static findStraightFlushes(cards) {
        const sfs = [];
        for (let suit = 0; suit < 4; suit++) {
            const suitCards = cards.filter(c => this.getSuit(c) === suit);
            if (suitCards.length >= 5) {
                sfs.push(...this.findStraights(suitCards));
            }
        }
        return sfs;
    }

    static isLastHand(cards) {
        if (!cards || cards.length === 0) return false;
        const info = this.getHandInfo(cards);
        return info !== null;
    }

    /**
     * Get all legal moves for a given hand and table state
     * @returns {Array<{cards: number[], type: string}>}
     */
    static getLegalMoves(hand, lastPlay, lastPlayerIndex, playerIndex, shouted) {
        const moves = [];
        const isLead = !lastPlay || lastPlay.length === 0;
        const sortedHand = this.sortCards(hand);

        // --- SHOUT RESTRICTION ---
        const isShouted = shouted && shouted[playerIndex];
        const isLastHand = this.isLastHand(hand);
        const shouldRestrictToFullHand = isShouted && isLastHand && hand.length > 1;

        if (shouldRestrictToFullHand) {
            if (isLead) {
                moves.push({ cards: sortedHand, type: 'FINAL' });
            } else if (this.compareHands(sortedHand, lastPlay) > 0) {
                moves.push({ cards: sortedHand, type: 'FINAL' });
            }
            return moves;
        }

        if (isLead) {
            const isFirstRound = lastPlayerIndex === -1 || lastPlayerIndex === undefined;
            const hasThreeOfClubs = hand.includes(0);
            
            // In the first round, only the player with the 3 of Clubs can lead
            if (isFirstRound && !hasThreeOfClubs) {
                return [];
            }

            // Singles
            sortedHand.forEach(c => {
                if (isFirstRound && c !== 0) return; // Must be 3 of Clubs if first round
                moves.push({ cards: [c], type: 'SINGLE' });
            });
            // Pairs
            this.findPairs(sortedHand).forEach(p => {
                if (isFirstRound && !p.includes(0)) return;
                moves.push({ cards: p, type: 'PAIR' });
            });
            // 5-Card Hands
            this.findFiveCardHands(sortedHand).forEach(h => {
                if (isFirstRound && !h.includes(0)) return;
                const info = this.getHandInfo(h);
                if (info) {
                    moves.push({ cards: h, type: info.type });
                }
            });
        } else {
            const targetLen = lastPlay.length;
            if (targetLen === 1) {
                sortedHand.forEach(c => {
                    if (this.compareCards(c, lastPlay[0]) > 0) {
                        moves.push({ cards: [c], type: 'SINGLE' });
                    }
                });
            } else if (targetLen === 2) {
                this.findPairs(sortedHand).forEach(p => {
                    if (this.compareHands(p, lastPlay) > 0) {
                        moves.push({ cards: p, type: 'PAIR' });
                    }
                });
            } else if (targetLen === 5) {
                this.findFiveCardHands(sortedHand).forEach(h => {
                    if (this.compareHands(h, lastPlay) > 0) {
                        const info = this.getHandInfo(h);
                        if (info) {
                            moves.push({ cards: h, type: info.type });
                        }
                    }
                });
            }
        }
        return moves;
    }

    static countFourOfAKinds(cards) {
        if (cards.length < 4) return 0;
        const counts = {};
        cards.forEach(c => {
            const r = this.getRank(c);
            counts[r] = (counts[r] || 0) + 1;
        });
        return Object.values(counts).filter(c => c >= 4).length;
    }

    static countStraightFlushes(cards) {
        if (cards.length < 5) return 0;
        const sfs = this.findStraightFlushes(cards);
        // To avoid counting overlapping straights in the same suit, 
        // we take the unique sets (though findStraightFlushes usually returns distinct rank sets per suit)
        return sfs.length;
    }

    static hasValidMoves(hand, lastPlay) {
        if (!lastPlay) return hand.length > 0;
        const lastInfo = this.getHandInfo(lastPlay);
        if (!lastInfo) return hand.length > 0;

        const len = lastPlay.length;
        if (len === 1) {
            return hand.some(c => this.compareCards(c, lastPlay[0]) > 0);
        }
        if (len === 2) {
            const pairs = this.findPairs(hand);
            return pairs.some(p => this.compareHands(p, lastPlay) > 0);
        }
        if (len === 5) {
            const hands = this.findFiveCardHands(hand);
            return hands.some(h => this.compareHands(h, lastPlay) > 0);
        }
        return false;
    }
}

if (typeof module !== 'undefined') {
    module.exports = GameLogic;
}
if (typeof window !== 'undefined') {
    window.GameLogic = GameLogic;
}

/**
 * Big Two Game Logic
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

class BaseRules {
    getRank(cardId) {
        return cardId % 13;
    }

    getSuit(cardId) {
        return Math.floor(cardId / 13);
    }

    getStartCard() {
        return 0;
    }

    getSuitStrength(cardId) {
        return this.getSuit(cardId);
    }

    compareCards(card1, card2) {
        const r1 = this.getRank(card1);
        const r2 = this.getRank(card2);
        if (r1 > r2) return 1;
        if (r1 < r2) return -1;

        const s1 = this.getSuitStrength(card1);
        const s2 = this.getSuitStrength(card2);
        if (s1 > s2) return 1;
        if (s1 < s2) return -1;

        return 0;
    }

    sortCards(cards) {
        return [...cards].sort((a, b) => this.compareCards(a, b));
    }

    getHandInfo(cards) {
        if (!cards || cards.length === 0) return null;
        const sorted = this.sortCards(cards);
        const len = cards.length;

        if (len === 13) {
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
                return { type: 'PAIR', value: sorted[1] };
            }
            return null;
        }
        if (len === 3) {
            return this.getTripleHandInfo(sorted);
        }
        if (len === 5) {
            return this.getFiveCardHandInfo(sorted);
        }
        return null;
    }

    getTripleHandInfo(sorted) {
        return null;
    }

    getFiveCardHandInfo(sorted) {
        const ranks = sorted.map(c => this.getRank(c));
        const suits = sorted.map(c => this.getSuit(c));
        const isFlush = suits.every(s => s === suits[0]);

        let isStraight = true;
        for (let i = 0; i < 4; i++) {
            if (ranks[i + 1] !== ranks[i] + 1) {
                isStraight = false;
                break;
            }
        }

        const rankSet = new Set(ranks);
        const is23456 = [0, 1, 2, 3, 12].every(r => rankSet.has(r));
        const isA2345 = [0, 1, 2, 11, 12].every(r => rankSet.has(r));

        const specInfo = this.checkSpecialStraights(sorted, isStraight, isFlush, is23456, isA2345);
        if (specInfo) return specInfo;

        if (isStraight && isFlush) return { type: 'STRAIGHT_FLUSH', value: sorted[4], strength: 5 };

        if (ranks[0] === ranks[3]) return { type: 'FOUR_OF_A_KIND', value: sorted[0], strength: 4 };
        if (ranks[1] === ranks[4]) return { type: 'FOUR_OF_A_KIND', value: sorted[1], strength: 4 };

        if (ranks[0] === ranks[2] && ranks[3] === ranks[4]) return { type: 'FULL_HOUSE', value: sorted[0], strength: 3 };
        if (ranks[0] === ranks[1] && ranks[2] === ranks[4]) return { type: 'FULL_HOUSE', value: sorted[2], strength: 3 };

        if (isFlush && this.allowFlushHand()) {
            return { type: 'FLUSH', value: sorted[4], strength: 2 };
        }
        if (isStraight) return { type: 'STRAIGHT', value: sorted[4], strength: 1 };

        return null;
    }

    checkSpecialStraights(sorted, isStraight, isFlush, is23456, isA2345) {
        return null;
    }

    allowFlushHand() {
        return false;
    }

    allowTripleHand() {
        return false;
    }

    compareHands(hand1, hand2) {
        const info1 = this.getHandInfo(hand1);
        const info2 = this.getHandInfo(hand2);

        if (!info1 || !info2) return 0;

        const bombBeat = this.checkBombBeating(info1, info2, hand1.length, hand2.length);
        if (bombBeat !== null) return bombBeat;

        if (info1.type === 'DRAGON' || info2.type === 'DRAGON') {
            if (info1.type === 'DRAGON' && info2.type === 'DRAGON') {
                if (info1.isFlush !== info2.isFlush) return info1.isFlush ? 1 : -1;
                return this.compareCards(info1.value, info2.value);
            }
            return info1.type === 'DRAGON' ? 1 : -1;
        }

        if (info1.type !== info2.type) {
            if (hand1.length === 5 && hand2.length === 5) {
                return info1.strength > info2.strength ? 1 : -1;
            }
            return 0;
        }

        if (info1.type === 'SINGLE' || info1.type === 'PAIR' || info1.type === 'STRAIGHT' || info1.type === 'FLUSH' || info1.type === 'STRAIGHT_FLUSH') {
            const specComp = this.compareSpecialStraights(info1, info2);
            if (specComp !== null) return specComp;

            return this.compareCards(info1.value, info2.value);
        }

        if (info1.type === 'FOUR_OF_A_KIND' || info1.type === 'FULL_HOUSE' || info1.type === 'TRIPLE') {
            return this.compareCards(info1.value, info2.value);
        }

        return 0;
    }

    checkBombBeating(info1, info2, len1, len2) {
        return null;
    }

    compareSpecialStraights(info1, info2) {
        return null;
    }

    findPairs(cards) {
        const pairs = [];
        const sorted = this.sortCards(cards);
        for (let i = 0; i < sorted.length - 1; i++) {
            if (this.getRank(sorted[i]) === this.getRank(sorted[i + 1])) {
                let j = i + 1;
                while (j < sorted.length && this.getRank(sorted[j]) === this.getRank(sorted[i])) {
                    j++;
                }
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

    findTriples(cards) {
        const triples = [];
        const sorted = this.sortCards(cards);
        for (let i = 0; i < sorted.length - 2; i++) {
            if (this.getRank(sorted[i]) === this.getRank(sorted[i + 1]) &&
                this.getRank(sorted[i + 1]) === this.getRank(sorted[i + 2])) {
                triples.push([sorted[i], sorted[i + 1], sorted[i + 2]]);
                i += 2;
            }
        }
        return triples;
    }

    findFiveCardHands(cards) {
        const hands = [];
        const sf = this.findStraightFlushes(cards);
        if (sf.length > 0) hands.push(...sf);

        const fk = this.findFourOfAKinds(cards);
        if (fk.length > 0) hands.push(...fk);

        const fh = this.findFullHouses(cards);
        if (fh.length > 0) hands.push(...fh);

        if (this.allowFlushHand()) {
            const f = this.findFlushes(cards);
            if (f.length > 0) hands.push(...f);
        }

        const s = this.findStraights(cards);
        if (s.length > 0) hands.push(...s);

        return hands;
    }

    findFlushes(cards) {
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

    findStraights(cards) {
        const straights = [];
        const sorted = [...new Set(cards.map(c => this.getRank(c)))].sort((a, b) => a - b);
        if (sorted.length < 5) return [];

        for (let i = 0; i <= sorted.length - 5; i++) {
            if (sorted[i + 4] - sorted[i] === 4) {
                const combination = [];
                for (let j = 0; j < 5; j++) {
                    const rank = sorted[i + j];
                    const rankCards = cards.filter(c => this.getRank(c) === rank);
                    const bestCard = rankCards.sort((a, b) => this.compareCards(a, b)).pop();
                    combination.push(bestCard);
                }
                straights.push(combination);
            }
        }
        return straights;
    }

    findFullHouses(cards) {
        const fhs = [];
        const triples = this.findTriples(cards);
        for (let t of triples) {
            const remaining = cards.filter(c => !t.includes(c));
            const pairs = this.findPairs(remaining);
            for (let p of pairs) {
                fhs.push([...t, ...p]);
            }
        }
        return fhs;
    }

    findFourOfAKinds(cards) {
        const fks = [];
        const sorted = this.sortCards(cards);
        for (let i = 0; i < sorted.length - 3; i++) {
            if (this.getRank(sorted[i]) === this.getRank(sorted[i + 3])) {
                const quad = sorted.slice(i, i + 4);
                const remaining = cards.filter(c => !quad.includes(c));
                if (remaining.length > 0) {
                    const sortedRemaining = this.sortCards(remaining);
                    fks.push([...quad, sortedRemaining[0]]);
                }
                i += 3;
            }
        }
        return fks;
    }

    findStraightFlushes(cards) {
        const sfs = [];
        for (let suit = 0; suit < 4; suit++) {
            const suitCards = cards.filter(c => this.getSuit(c) === suit);
            if (suitCards.length >= 5) {
                sfs.push(...this.findStraights(suitCards));
            }
        }
        return sfs;
    }

    isLastHand(cards) {
        if (!cards || cards.length === 0) return false;
        const info = this.getHandInfo(cards);
        return info !== null;
    }

    getLegalMoves(hand, lastPlay, lastPlayerIndex, playerIndex, shouted) {
        const moves = [];
        const isLead = !lastPlay || lastPlay.length === 0;
        const sortedHand = this.sortCards(hand);
        const startCard = this.getStartCard();

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
            const hasStartCard = hand.includes(startCard);

            if (isFirstRound && !hasStartCard) {
                return [];
            }

            sortedHand.forEach(c => {
                if (isFirstRound && c !== startCard) return;
                moves.push({ cards: [c], type: 'SINGLE' });
            });
            this.findPairs(sortedHand).forEach(p => {
                if (isFirstRound && !p.includes(startCard)) return;
                moves.push({ cards: p, type: 'PAIR' });
            });
            if (this.allowTripleHand()) {
                this.findTriples(sortedHand).forEach(t => {
                    if (isFirstRound && !t.includes(startCard)) return;
                    moves.push({ cards: t, type: 'TRIPLE' });
                });
            }
            this.findFiveCardHands(sortedHand).forEach(h => {
                if (isFirstRound && !h.includes(startCard)) return;
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
                this.addMonsterMovesForSingleOrPair(moves, sortedHand);
            } else if (targetLen === 2) {
                this.findPairs(sortedHand).forEach(p => {
                    if (this.compareHands(p, lastPlay) > 0) {
                        moves.push({ cards: p, type: 'PAIR' });
                    }
                });
                this.addMonsterMovesForSingleOrPair(moves, sortedHand);
            } else if (targetLen === 3) {
                if (this.allowTripleHand()) {
                    this.findTriples(sortedHand).forEach(t => {
                        if (this.compareHands(t, lastPlay) > 0) {
                            moves.push({ cards: t, type: 'TRIPLE' });
                        }
                    });
                }
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

    addMonsterMovesForSingleOrPair(moves, sortedHand) {
        // Default: no-op
    }

    countFourOfAKinds(cards) {
        if (cards.length < 4) return 0;
        const counts = {};
        cards.forEach(c => {
            const r = this.getRank(c);
            counts[r] = (counts[r] || 0) + 1;
        });
        return Object.values(counts).filter(c => c >= 4).length;
    }

    countStraightFlushes(cards) {
        if (cards.length < 5) return 0;
        const sfs = this.findStraightFlushes(cards);
        return sfs.length;
    }

    hasValidMoves(hand, lastPlay) {
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
        if (len === 3) {
            if (this.allowTripleHand()) {
                const triples = this.findTriples(hand);
                return triples.some(t => this.compareHands(t, lastPlay) > 0);
            }
            return false;
        }
        if (len === 5) {
            const hands = this.findFiveCardHands(hand);
            return hands.some(h => this.compareHands(h, lastPlay) > 0);
        }
        return false;
    }
}

class TaiwanRules extends BaseRules {
    getStartCard() {
        return 0; // Club 3
    }

    getSuitStrength(cardId) {
        return this.getSuit(cardId);
    }

    checkBombBeating(info1, info2, len1, len2) {
        const isBomb1 = info1.type === 'FOUR_OF_A_KIND' || info1.type === 'STRAIGHT_FLUSH';
        const isBomb2 = info2.type === 'FOUR_OF_A_KIND' || info2.type === 'STRAIGHT_FLUSH';

        if (len1 === 5 && (len2 === 1 || len2 === 2)) {
            return isBomb1 ? 1 : 0;
        }
        if (len2 === 5 && (len1 === 1 || len1 === 2)) {
            return isBomb2 ? -1 : 0;
        }
        return null;
    }

    compareSpecialStraights(info1, info2) {
        if (info1.special === '23456' && info2.special !== '23456') return 1;
        if (info1.special !== '23456' && info2.special === '23456') return -1;
        if (info1.special === 'A2345' && info2.special !== 'A2345') return -1;
        if (info1.special !== 'A2345' && info2.special === 'A2345') return 1;
        return null;
    }

    checkSpecialStraights(sorted, isStraight, isFlush, is23456, isA2345) {
        if (is23456) {
            const card2 = sorted.find(c => this.getRank(c) === 12);
            return { type: isFlush ? 'STRAIGHT_FLUSH' : 'STRAIGHT', value: card2, strength: isFlush ? 5 : 1, special: '23456' };
        }
        if (isA2345) {
            return { type: isFlush ? 'STRAIGHT_FLUSH' : 'STRAIGHT', value: sorted[2], strength: isFlush ? 5 : 1, special: 'A2345' };
        }
        return null;
    }

    addMonsterMovesForSingleOrPair(moves, sortedHand) {
        this.findFourOfAKinds(sortedHand).forEach(fk => {
            moves.push({ cards: fk, type: 'FOUR_OF_A_KIND' });
        });
        this.findStraightFlushes(sortedHand).forEach(sf => {
            moves.push({ cards: sf, type: 'STRAIGHT_FLUSH' });
        });
    }
}

class HongKongRules extends BaseRules {
    getStartCard() {
        return 13; // Diamond 3
    }

    getSuitStrength(cardId) {
        const suit = this.getSuit(cardId);
        const hkStrengths = [1, 0, 2, 3];
        return hkStrengths[suit];
    }

    getTripleHandInfo(sorted) {
        if (this.getRank(sorted[0]) === this.getRank(sorted[1]) && 
            this.getRank(sorted[1]) === this.getRank(sorted[2])) {
            return { type: 'TRIPLE', value: sorted[2] };
        }
        return null;
    }

    allowFlushHand() {
        return true;
    }

    allowTripleHand() {
        return true;
    }
}

class GameLogic {
    static taiwanStrategy = new TaiwanRules();
    static hkStrategy = new HongKongRules();

    static getRuleMode() {
        if (typeof AppStorage !== 'undefined' && typeof AppStorage.getItem === 'function') {
            return AppStorage.getItem('ruleMode') || 'taiwan';
        }
        return 'taiwan';
    }

    static getStrategy() {
        return this.getRuleMode() === 'hongkong' ? this.hkStrategy : this.taiwanStrategy;
    }

    static getRank(cardId) {
        return cardId % 13;
    }

    static getSuit(cardId) {
        return Math.floor(cardId / 13);
    }

    static getStartCard() {
        return this.getStrategy().getStartCard();
    }

    static getSuitStrength(cardId) {
        return this.getStrategy().getSuitStrength(cardId);
    }

    static compareCards(card1, card2) {
        return this.getStrategy().compareCards(card1, card2);
    }

    static sortCards(cards) {
        return this.getStrategy().sortCards(cards);
    }

    static getHandInfo(cards) {
        return this.getStrategy().getHandInfo(cards);
    }

    static compareHands(hand1, hand2) {
        return this.getStrategy().compareHands(hand1, hand2);
    }

    static findPairs(cards) {
        return this.getStrategy().findPairs(cards);
    }

    static findTriples(cards) {
        return this.getStrategy().findTriples(cards);
    }

    static findFiveCardHands(cards) {
        return this.getStrategy().findFiveCardHands(cards);
    }

    static findFlushes(cards) {
        return this.getStrategy().findFlushes(cards);
    }

    static findStraights(cards) {
        return this.getStrategy().findStraights(cards);
    }

    static findFullHouses(cards) {
        return this.getStrategy().findFullHouses(cards);
    }

    static findFourOfAKinds(cards) {
        return this.getStrategy().findFourOfAKinds(cards);
    }

    static findStraightFlushes(cards) {
        return this.getStrategy().findStraightFlushes(cards);
    }

    static isLastHand(cards) {
        return this.getStrategy().isLastHand(cards);
    }

    static getLegalMoves(hand, lastPlay, lastPlayerIndex, playerIndex, shouted) {
        return this.getStrategy().getLegalMoves(hand, lastPlay, lastPlayerIndex, playerIndex, shouted);
    }

    static countFourOfAKinds(cards) {
        return this.getStrategy().countFourOfAKinds(cards);
    }

    static countStraightFlushes(cards) {
        return this.getStrategy().countStraightFlushes(cards);
    }

    static hasValidMoves(hand, lastPlay) {
        return this.getStrategy().hasValidMoves(hand, lastPlay);
    }
}

if (typeof module !== 'undefined') {
    module.exports = GameLogic;
}
if (typeof window !== 'undefined') {
    window.GameLogic = GameLogic;
}

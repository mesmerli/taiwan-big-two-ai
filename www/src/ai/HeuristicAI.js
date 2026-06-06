/**
 * Alex - Balanced Strategy
 */
class AlexAI extends AICharacter {
    constructor(gameLogic) {
        super(gameLogic, "Alex");
        this.avatar = "src/assets/avatars/avatar_alex.png";
    }

    async chooseLead(sorted, context) {
        const Logic = this.getLogic();
        const { players } = context;
        const anyOpponentHasOne = players && players.some((p, idx) => idx !== context.playerIndex && p && p.length === 1);
        const anyOpponentHasTwo = players.some((p, idx) => idx !== context.playerIndex && p && p.length === 2);

        if (anyOpponentHasTwo) {
            const five = Logic.findFiveCardHands(sorted);
            if (five.length > 0) return five[0];
            const nonTwos = sorted.filter(c => Logic.getRank(c) < 12);
            if (nonTwos.length > 0) {
                return anyOpponentHasOne ? [nonTwos[nonTwos.length - 1]] : [nonTwos[0]];
            }
        } else {
            const five = Logic.findFiveCardHands(sorted);
            if (five.length > 0) return five[0];
            const pairs = Logic.findPairs(sorted);
            if (pairs.length > 0) return pairs[0];
        }
        return anyOpponentHasOne ? [sorted[sorted.length - 1]] : [sorted[0]];
    }
}

/**
 * Bella - Defensive Strategy (Favors Pairs)
 */
class BellaAI extends AICharacter {
    constructor(gameLogic) {
        super(gameLogic, "Bella");
        this.avatar = "src/assets/avatars/avatar_bella.png";
    }

    async chooseLead(sorted, context) {
        const Logic = this.getLogic();
        const { players } = context;
        const anyOpponentHasOne = players && players.some((p, idx) => idx !== context.playerIndex && p && p.length === 1);

        const pairs = Logic.findPairs(sorted);
        if (pairs.length > 0) return pairs[0];

        const five = Logic.findFiveCardHands(sorted);
        if (five.length > 0) return five[0];

        return anyOpponentHasOne ? [sorted[sorted.length - 1]] : [sorted[0]];
    }
}

/**
 * Chris - Aggressive Strategy
 */
class ChrisAI extends AICharacter {
    constructor(gameLogic) {
        super(gameLogic, "Chris");
        this.avatar = "src/assets/avatars/avatar_chris.png";
    }

    async chooseLead(sorted, context) {
        const Logic = this.getLogic();
        const five = Logic.findFiveCardHands(sorted);
        if (five.length > 0) return five[five.length - 1];
        const nonTwos = sorted.filter(c => Logic.getRank(c) < 12);
        if (nonTwos.length > 0) return [nonTwos[nonTwos.length - 1]];
        return [sorted[sorted.length - 1]];
    }
}

// Browser/Electron export
if (typeof module !== 'undefined') {
    module.exports = { AlexAI, BellaAI, ChrisAI };
}

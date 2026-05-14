/**
 * Logic Test Suite for Taiwan Big Two
 * Run with: node tests/logic.test.js
 */

const GameLogic = require('../src/gameLogic');

const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m"
};

function assert(condition, message) {
    if (!condition) {
        console.log(`${colors.red}  [FAIL] ${message}${colors.reset}`);
        return false;
    }
    console.log(`${colors.green}  [PASS] ${message}${colors.reset}`);
    return true;
}

console.log(`${colors.cyan}=== Big Two Logic Test Suite ===${colors.reset}\n`);

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
    console.log(`${colors.yellow}Running: ${name}${colors.reset}`);
    const result = fn();
    if (result) passedCount++;
    totalCount++;
}

// --- Test Cases ---

runTest("Card Ranks (3 is lowest, 2 is highest)", () => {
    const threeOfClubs = 0;
    const twoOfSpades = 51; // 12 + 3*13
    return assert(GameLogic.getRank(threeOfClubs) === 0, "3 should be Rank 0") &&
           assert(GameLogic.getRank(twoOfSpades) === 12, "2 should be Rank 12");
});

runTest("Card Comparison (Spade beats Club)", () => {
    const clubA = 11;  // Rank 11, Suit 0
    const spadeA = 50; // Rank 11, Suit 3
    return assert(GameLogic.compareCards(spadeA, clubA) > 0, "Spade A should beat Club A");
});

runTest("Hand Identification (Pairs)", () => {
    const pairOf3s = [0, 13]; // Club 3, Diamond 3
    const info = GameLogic.getHandInfo(pairOf3s);
    return assert(info && info.type === 'PAIR', "Should detect PAIR") &&
           assert(info.value === 13, "Value should be determined by Diamond (higher suit)");
});

runTest("Hand Identification (Straight)", () => {
    // 3 of Clubs, 4 of Diamonds, 5 of Hearts, 6 of Spades, 7 of Clubs
    const straight = [0, 14, 28, 42, 4]; 
    const info = GameLogic.getHandInfo(straight);
    return assert(info && info.type === 'STRAIGHT', "Should detect STRAIGHT");
});

runTest("Hand Identification (Flush - SHOULD BE INVALID)", () => {
    // 3C, 4C, 5C, 6C, 8C (Flush, not a straight)
    const flush = [0, 1, 2, 3, 5]; 
    const info = GameLogic.getHandInfo(flush);
    return assert(info === null, "Flush should be INVALID in Taiwan Big Two");
});

runTest("Hand Comparison (Full House vs Straight)", () => {
    // 3C, 3D, 3H, 4C, 4D (Full House)
    const fullHouse = [0, 13, 26, 1, 14]; 
    // 3C, 4D, 5H, 6S, 7C (Straight)
    const straight = [0, 14, 28, 42, 4]; 
    return assert(GameLogic.compareHands(fullHouse, straight) > 0, "Full House should beat Straight");
});

runTest("Hand Comparison (4-of-a-Kind vs Full House)", () => {
    const quads = [0, 13, 26, 39, 1]; // 3,3,3,3, 4
    const fullHouse = [0, 13, 26, 1, 14]; // 3,3,3, 4,4
    return assert(GameLogic.compareHands(quads, fullHouse) > 0, "4-of-a-kind should beat Full House");
});

runTest("Hand Comparison (Straight Flush vs 4-of-a-kind)", () => {
    const sf = [0, 1, 2, 3, 4]; // 3,4,5,6,7 of Clubs
    const quads = [0, 13, 26, 39, 1]; // 3,3,3,3, 4
    return assert(GameLogic.compareHands(sf, quads) > 0, "Straight Flush should beat 4-of-a-kind");
});

runTest("Hand Comparison (Full House vs Full House - Rank Priority)", () => {
    // Q, Q, Q, 10, 10
    const lowerFH = [48, 35, 22, 46, 33];
    // K, K, K, 6, 6
    const higherFH = [10, 23, 36, 3, 16];
    return assert(GameLogic.compareHands(higherFH, lowerFH) > 0, "K-high Full House should beat Q-high Full House regardless of card IDs");
});


console.log(`\n${colors.cyan}Summary: ${passedCount}/${totalCount} tests passed.${colors.reset}`);

if (passedCount < totalCount) {
    process.exit(1);
} else {
    process.exit(0);
}

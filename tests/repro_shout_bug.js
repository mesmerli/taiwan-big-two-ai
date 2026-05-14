const GameLogic = require('../src/gameLogic');

// Mock gameState for simulation
const gameState = {
    players: [[3, 16], [], [], []], // User has Club 6 and Diamond 6 (Pair)
    lastPlay: [5], // Computer played Spade 7 (Single)
    lastPlayerIndex: 1,
    shouted: [true, false, false, false],
    turn: 0
};

function checkCanMove() {
    const hand = gameState.players[0];
    const hasLead = (gameState.lastPlayerIndex === -1 || gameState.lastPlayerIndex === 0);
    let canMove = true;

    if (!hasLead) {
        if (gameState.shouted[0]) {
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
    return canMove;
}

console.log("Testing Shouted La constraint...");
const result = checkCanMove();
console.log("Can User Move?", result);

if (result === false) {
    console.log("✅ SUCCESS: User cannot move (must play pair as pair, but table is single).");
} else {
    console.log("❌ FAILURE: User incorrectly allowed to move.");
}

// Test another case: User has a higher single and shouted
gameState.players[0] = [50]; // Spade Ace
gameState.lastPlay = [0]; // Club 3
gameState.shouted[0] = true;
const result2 = checkCanMove();
console.log("Result 2 (Higher Single):", result2);
if (result2 === true) {
    console.log("✅ SUCCESS: User can move with higher single.");
} else {
    console.log("❌ FAILURE: User blocked from moving with higher single.");
}

// Test case: User has a lower pair and shouted
gameState.players[0] = [0, 13]; // 3s
gameState.lastPlay = [1, 14]; // 4s
gameState.shouted[0] = true;
const result3 = checkCanMove();
console.log("Result 3 (Lower Pair):", result3);
if (result3 === false) {
    console.log("✅ SUCCESS: User cannot move with lower pair.");
} else {
    console.log("❌ FAILURE: User allowed to move with lower pair.");
}

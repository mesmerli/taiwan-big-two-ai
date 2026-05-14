const GameLogic = require('../src/gameLogic');

// User: 3, 4, 4, 5, 5, 6, 7, 7, 8, 8, 8, Q, 2
// Let's assume some suits for the 8s and the 2.
// Rank 3: 0. Rank 4: 1. Rank 5: 2. Rank 6: 3. Rank 7: 4. Rank 8: 5. Rank Q: 9. Rank 2: 12.
const userHand = [
    0,  // 3C
    1, 14, // 4C, 4D
    2, 15, // 5C, 5D
    3, // 6C
    4, 17, // 7C, 7D
    5, 18, 31, // 8C, 8D, 8H
    9, // QC
    12 // 2C
];

// Computer: 9, 9, 9, 10, 10
// Rank 9: 6. Rank 10: 7.
const computerHand = [6, 19, 32, 7, 20]; // 9C, 9D, 9H, 10C, 10D

console.log("Analyzing User Hand...");
const userHands = GameLogic.findFiveCardHands(userHand);
console.log(`Found ${userHands.length} five-card hands.`);

userHands.forEach((h, i) => {
    const info = GameLogic.getHandInfo(h);
    const beats = GameLogic.compareHands(h, computerHand) > 0;
    console.log(`${i+1}: [${h.join(',')}] - Type: ${info.type}, Value: ${info.value}, Beats Computer: ${beats}`);
});

const canMove = GameLogic.hasValidMoves(userHand, computerHand);
console.log("Has Valid Moves?", canMove);

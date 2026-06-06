/**
 * Main AI Manager class
 */
class BigTwoAI {
    constructor(gameLogic) {
        this.gameLogic = gameLogic;
        // All available character blueprints (null = Human)
        this.availableBlueprints = [null, AlexAI, BellaAI, ChrisAI, DianaAI, AresAI];

        // Active characters in slots 0, 1, 2, 3
        this.characters = {
            0: null, // Human
            1: new AlexAI(gameLogic),
            2: new BellaAI(gameLogic),
            3: new ChrisAI(gameLogic)
        };
    }

    /**
     * Swap the character in playerIndex with the one on the bench
     */
    randomizeAllPersonas() {
        for (let i = 0; i < 4; i++) {
            const char = this.characters[i];
            if (char && char.isLLM && typeof char.randomizePersona === 'function') {
                char.randomizePersona();
            }
        }
    }

    swapCharacter(playerIndex) {
        const currentBlueprint = this.characters[playerIndex] ? this.characters[playerIndex].constructor : null;
        const otherActiveBlueprints = Object.entries(this.characters)
            .filter(([idx]) => parseInt(idx) !== playerIndex)
            .map(([_, c]) => c ? c.constructor : null);

        // Find current index in the pool
        let currentIndex = this.availableBlueprints.indexOf(currentBlueprint);

        // Search for the next available character in a circle
        for (let i = 1; i <= this.availableBlueprints.length; i++) {
            let nextIndex = (currentIndex + i) % this.availableBlueprints.length;
            let candidateBlueprint = this.availableBlueprints[nextIndex];

            // Prevention: Only slot 0 (the player) can be 'null' (Human). 
            // This prevents CPUs in slots 1-3 from accidentally becoming Human.
            if (playerIndex > 0 && candidateBlueprint === null) continue;

            if (!otherActiveBlueprints.includes(candidateBlueprint)) {
                if (candidateBlueprint === null) {
                    this.characters[playerIndex] = null;
                    console.log(`%c[AI Manager] Player ${playerIndex + 1} is now Human control`, 'color: #3498db; font-weight: bold;');
                    return { name: "You", avatar: "src/assets/avatars/avatar_you.png", type: "Human", isLLM: false };
                } else {
                    const newCharacter = new candidateBlueprint(this.gameLogic);
                    this.characters[playerIndex] = newCharacter;
                    console.log(`%c[AI Manager] Swapped Player ${playerIndex + 1} to ${newCharacter.name}`, 'color: #3498db; font-weight: bold;');
                    return newCharacter;
                }
            }
        }

        return this.characters[playerIndex] || { name: "You", avatar: "src/assets/avatars/avatar_you.png", type: "Human", isLLM: false };
    }

    async findPlay(playerIndex, context) {
        const character = this.characters[playerIndex];
        if (!character) return null;

        const enhancedContext = { ...context, playerIndex };
        return await character.decide(enhancedContext);
    }

    getCharacter(playerIndex) {
        return this.characters[playerIndex];
    }

    setAICharacterSettings(playerIndex, settings) {
        const char = this.characters[playerIndex];
        if (char && char.isLLM && typeof char.setSettings === 'function') {
            char.setSettings(settings);
            return true;
        }
        return false;
    }

    getNames() {
        const getCharData = (i) => {
            const char = this.characters[i];
            if (!char) return null;
            return { name: char.name, avatar: char.avatar, type: char.type, isLLM: char.isLLM };
        };
        return {
            0: getCharData(0),
            1: getCharData(1),
            2: getCharData(2),
            3: getCharData(3)
        };
    }

    postGameReflection(gameLog, winnerIndex, finalHands) {
        const names = this.getNames();

        // Helper to get a readable name for any slot
        const getPlayerName = (idx) => {
            if (names[idx]) return names[idx].name;
            return "Player (Human)";
        };

        const winnerName = getPlayerName(winnerIndex);

        const characterNames = {
            0: getPlayerName(0),
            1: getPlayerName(1),
            2: getPlayerName(2),
            3: getPlayerName(3)
        };

        for (let i = 0; i < 4; i++) {
            const char = this.characters[i];
            if (char && char.isLLM && typeof char.reflect === 'function') {
                const didWin = (i === winnerIndex);
                char.reflect(gameLog, didWin, winnerName, characterNames, i, finalHands ? finalHands[i] : []);
            }
        }
    }
}

// Electron/Browser Export Logic
if (typeof module !== 'undefined') {
    module.exports = { BigTwoAI };
}

window.AI = new BigTwoAI(window.GameLogic || (typeof GameLogic !== 'undefined' ? GameLogic : null));

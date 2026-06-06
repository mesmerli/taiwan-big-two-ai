/**
 * Diana (LLM) - The Oracle
 */
class DianaAI extends BaseLLMAI {
    constructor(gameLogic) {
        super(gameLogic, "Diana", "src/assets/avatars/avatar_diana.png");
    }
}

/**
 * Ares (LLM) - The God of War
 */
class AresAI extends BaseLLMAI {
    constructor(gameLogic) {
        super(gameLogic, "Ares", "src/assets/avatars/avatar_ares.png");
    }
}

// Browser/Electron export
if (typeof module !== 'undefined') {
    module.exports = { DianaAI, AresAI };
}

/**
 * Big Two AI Strategy Engine - Modular Version
 */

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
            // First turn rule: Must include 3 of Clubs (Card 0)
            const hasThreeOfClubs = hand.includes(0);
            if (hasThreeOfClubs && (lastPlayerIndex === -1 || lastPlayerIndex === undefined)) {
                const five = Logic.findFiveCardHands(hand).filter(h => h.includes(0));
                if (five.length > 0) return five[0];
                const pairs = Logic.findPairs(hand).filter(p => p.includes(0));
                if (pairs.length > 0) return pairs[0];
                return [0];
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
            for (let c of sorted) {
                if (Logic.compareCards(c, lastPlay[0]) > 0) return [c];
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
        return [sorted[0]];
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
            return [sorted[0]];
        } else {
            return await this.chooseFollow(sorted, context);
        }
    }
}

/**
 * Alex - Balanced Strategy
 */
class AlexAI extends AICharacter {
    constructor(gameLogic) {
        super(gameLogic, "Alex");
        this.avatar = "🦊";
    }

    async chooseLead(sorted, context) {
        const Logic = this.getLogic();
        const { players } = context;
        const humanHasTwo = (players[0] && players[0].length === 2);

        if (humanHasTwo) {
            const five = Logic.findFiveCardHands(sorted);
            if (five.length > 0) return five[0];
            const nonTwos = sorted.filter(c => Logic.getRank(c) < 12);
            if (nonTwos.length > 0) return [nonTwos[0]];
        } else {
            const five = Logic.findFiveCardHands(sorted);
            if (five.length > 0) return five[0];
            const pairs = Logic.findPairs(sorted);
            if (pairs.length > 0) return pairs[0];
        }
        return [sorted[0]];
    }
}

/**
 * Bella - Defensive Strategy (Favors Pairs)
 */
class BellaAI extends AICharacter {
    constructor(gameLogic) {
        super(gameLogic, "Bella");
        this.avatar = "🐰";
    }

    async chooseLead(sorted, context) {
        const Logic = this.getLogic();
        const pairs = Logic.findPairs(sorted);
        if (pairs.length > 0) return pairs[0];

        const five = Logic.findFiveCardHands(sorted);
        if (five.length > 0) return five[0];

        return [sorted[0]];
    }
}

/**
 * Chris - Aggressive Strategy
 */
class ChrisAI extends AICharacter {
    constructor(gameLogic) {
        super(gameLogic, "Chris");
        this.avatar = "🦁";
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

/**
 * Base LLM Character Class
 * Handles generic LLM reasoning, prompting, and memory persistence.
 */
class BaseLLMAI extends AICharacter {
    constructor(gameLogic, name, avatar = "✨") {
        super(gameLogic, name);
        this.avatar = avatar;
        this.type = "LLM";
        this.isLLM = true;

        // Storage keys based on name
        this.settingsKey = `ai_settings_${this.name}`;
        this.memoryKey = `ai_memory_${this.name}`;

        // Handle migration for Diana (legacy keys)
        if (this.name === "Diana") {
            if (!localStorage.getItem(this.settingsKey) && localStorage.getItem('ai_settings_Diana')) {
                // Already matching, but good to be explicit
            }
        }

        this.loadSettings();
        this.randomizePersona();
    }

    randomizePersona() {
        const personas = [
            {
                name: "The Wall (Defensive)",
                desc: "Your priority is to BLOCK opponents. You are willing to break your own pairs or triples to stop an opponent from winning. Save your 2s and Aces exclusively for defense."
            },
            {
                name: "The Sprinter (Fast-paced)",
                desc: "Your priority is to EMPTY your hand as fast as possible. Focus on playing your 5-card hands (Straights, Full Houses) and high pairs early. Don't worry too much about what others are playing."
            },
            {
                name: "The Predator (Late-game power)",
                desc: "You are a patient hunter. You allow others to lead early while you save your big cards (Kings, Aces, 2s). You aim to take absolute control in the final half of the game to deliver a crushing blow."
            }
        ];

        // Ares specific persona override if needed
        if (this.name === "Ares") {
            personas.push({
                name: "The Berserker (Ultra-Aggressive)",
                desc: "You are the God of War. You never PASS if you have a card to play. You use your big cards (Aces, 2s) to seize control at every opportunity. You prefer to lead with your strongest hands to overwhelm opponents."
            });
        }

        this.persona = personas[Math.floor(Math.random() * personas.length)];
        console.log(`%c[${this.name} Engine] Persona selected for this game: ${this.persona.name}`, 'color: #3498db; font-weight: bold;');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(this.settingsKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.apiUrl = parsed.apiUrl || 'http://127.0.0.1:1234/v1/chat/completions';
                this.modelId = parsed.modelId || '';
                this.extraPrompt = parsed.extraPrompt || "";
            } else {
                this.apiUrl = 'http://127.0.0.1:1234/v1/chat/completions';
                this.modelId = '';
                this.extraPrompt = "";
            }
        } catch (e) {
            this.apiUrl = 'http://127.0.0.1:1234/v1/chat/completions';
            this.modelId = '';
            this.extraPrompt = "";
        }

        // Load Memory (Learnings & Stats)
        try {
            const memory = localStorage.getItem(this.memoryKey);
            if (memory) {
                const parsedMem = JSON.parse(memory);
                this.learnings = (parsedMem.learnings || []).map(item => {
                    let obj = typeof item === 'string'
                        ? { tip: item, count: 1, priority: "P1", timestamp: Date.now() }
                        : item;
                    obj.tip = obj.tip.replace(/^(Next time,\s*)?I should\s*/i, '').trim();
                    obj.tip = obj.tip.charAt(0).toUpperCase() + obj.tip.slice(1);
                    return obj;
                });
                this.stats = parsedMem.stats || { wins: 0, losses: 0 };
            } else {
                this.learnings = [];
                this.stats = { wins: 0, losses: 0 };
            }
        } catch (e) {
            this.learnings = [];
            this.stats = { wins: 0, losses: 0 };
        }
    }

    saveMemory() {
        try {
            localStorage.setItem(this.memoryKey, JSON.stringify({
                learnings: this.learnings,
                stats: this.stats
            }));
        } catch (e) {
            console.error(`[${this.name} Memory] Failed to save:`, e);
        }
    }

    setSettings(settings) {
        this.apiUrl = settings.apiUrl || this.apiUrl;
        this.modelId = settings.modelId || this.modelId;
        this.extraPrompt = settings.extraPrompt || "";
        localStorage.setItem(this.settingsKey, JSON.stringify({
            apiUrl: this.apiUrl,
            modelId: this.modelId,
            extraPrompt: this.extraPrompt
        }));
    }

    getSettings() {
        return {
            apiUrl: this.apiUrl,
            modelId: this.modelId,
            extraPrompt: this.extraPrompt,
            learnings: this.learnings.map(l => l.tip) // Map objects back to strings for UI
        };
    }

    pruneLearnings() {
        // Priority Weights: P0=0 (Highest), P1=1, P2=2
        const pWeights = { "P0": 0, "P1": 1, "P2": 2 };

        // Sort by Priority, then by frequency (Count), then by Recency (Timestamp)
        this.learnings.sort((a, b) => {
            if (pWeights[a.priority] !== pWeights[b.priority]) {
                return pWeights[a.priority] - pWeights[b.priority];
            }
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return b.timestamp - a.timestamp;
        });

        // Keep top 10 most valuable entries
        if (this.learnings.length > 10) {
            this.learnings = this.learnings.slice(0, 10);
        }
    }

    isSimilar(tip1, tip2) {
        const getKeywords = (str) => {
            return str.toLowerCase()
                .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
                .split(/\s+/)
                .filter(w => w.length > 2 && !["the", "and", "should", "with", "for", "your", "opponent", "than", "more"].includes(w));
        };
        const k1 = getKeywords(tip1);
        const k2 = getKeywords(tip2);

        // Fallback to exact match if no significant keywords found
        if (k1.length === 0 || k2.length === 0) return tip1.toLowerCase() === tip2.toLowerCase();

        // Calculate overlap score (Intersection over larger set to prevent short rules from absorbing long ones)
        const intersection = k1.filter(w => k2.includes(w));
        const score = intersection.length / Math.max(k1.length, k2.length);

        return score >= 0.6; // Slightly lower threshold but stricter denominator
    }

    async decide(context) {
        const Logic = this.getLogic();
        const { hand, lastPlay } = context;

        console.log(`%c[${this.name} Engine] Generating legal moves...`, 'color: #9b59b6;');
        const legalMoves = this.getAllLegalMoves(context);

        if (legalMoves.length <= 1) {
            if (legalMoves.length === 1) {
                console.log(`%c[${this.name} Engine] Only one legal move. Skipping LLM.`, 'color: #16a085; font-style: italic;');
                const selectedMove = legalMoves[0];
                console.log(`%c${this.name} Plays (Bypass):`, 'color: #e74c3c; font-weight: bold;', selectedMove.cards.map(id => this.cardToString(id)));
                return selectedMove.cards;
            }
            return await this.localDecide(context);
        }

        console.log(`%c[${this.name} Engine] Requesting Strategic Selection...`, 'color: #9b59b6; font-weight: bold;');

        const userPrompt = this.generatePrompt(context, legalMoves);

        // Dynamic Profile
        let profile = "Balanced";
        const totalGames = this.stats.wins + this.stats.losses;
        if (totalGames >= 5) {
            const winRate = this.stats.wins / totalGames;
            if (winRate < 0.2) profile = "Aggressive (Prioritize taking control)";
            else if (winRate > 0.6) profile = "Defensive (Save big cards for the endgame)";
        }

        const systemPrompt = `Strategic Game Engine for Taiwanese Big Two. 
Task: Evaluate each legal move from 1-10 based on how likely it leads to a win. Select the move index with the highest score.

Current Persona: ${this.persona.name}
Role Play Instructions: ${this.persona.desc}

Current Profile: ${profile}

Game Logic (Taiwanese Rules):
- Rank: 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2.
- Suit: Club < Diamond < Heart < Spade.
- Strategy: Dump small cards early. Use big cards (2s, Aces) to take control or BLOCK opponents marked as [CRITICAL].

Defensive Rules:
1. If an opponent is [CRITICAL], do NOT pass easily. Use your best cards to prevent them from finishing.
2. If an opponent is [AGGRESSIVE], they are likely trying to empty their hand. Be prepared to fight for control.

Output Schema:
{
  "selected_index": number,
  "confidence_score": number, (1-10)
  "strategy": "Brief explanation of your logic"
}

${this.learnings.length > 0 ? `[PAST_LEARNINGS]\n- ${this.learnings.map(l => l.tip).join('\n- ')}\n` : ''}
${this.extraPrompt ? `Additional Custom Instructions:\n${this.extraPrompt}` : ''}`;

        // Auto-detect model if not manually specified
        let activeModel = this.modelId;
        if (!activeModel) {
            try {
                const urlObj = new URL(this.apiUrl);
                const modelsUrl = `${urlObj.protocol}//${urlObj.host}/v1/models`;
                const modelRes = await fetch(modelsUrl);
                if (modelRes.ok) {
                    const modelData = await modelRes.json();
                    if (modelData && modelData.data && modelData.data.length > 0) {
                        activeModel = modelData.data[0].id;
                        console.log(`%c[Diana Engine] Auto-detected model: ${activeModel}`, 'color: #16a085;');
                    }
                }
            } catch (e) {
                console.warn("[Diana Engine] Model auto-detection failed, falling back to default.", e);
            }
        }
        if (!activeModel) activeModel = "local-model"; // Fallback

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: activeModel,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.1, // Lower temperature as recommended
                    top_p: 0.9,       // Top-P set to 0.9
                    max_tokens: 300,
                    stream: false
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            console.log(`%c[${this.name} Engine] System Prompt:`, 'color: #34495e; font-weight: bold;', systemPrompt);
            console.log(`%c[${this.name} Engine] User Prompt:`, 'color: #34495e; font-weight: bold;', userPrompt);

            const data = await response.json();


            if (!data.choices || data.choices.length === 0) {
                console.warn(`[${this.name} Engine] No choices returned from API.`);
                return await this.localDecide(context);
            }

            const content = data.choices[0].message.content.trim();
            console.log(`%c[${this.name} Raw Output]:`, 'color: #8e44ad;', content);
            if (!content) return await this.localDecide(context);

            // Clean up possible markdown blocks and robustly extract JSON
            let jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();

            try {
                const decision = JSON.parse(jsonStr);
                console.log(`%c[${this.name} Strategy]:`, 'color: #9b59b6; font-style: italic;', decision.strategy);

                const index = parseInt(decision.selected_index);
                if (!isNaN(index) && index >= 0 && index < legalMoves.length) {
                    const selectedMove = legalMoves[index];
                    console.log(`%c${this.name} Plays (Index ${index}):`, 'color: #e74c3c; font-weight: bold;', selectedMove.cards.map(id => this.cardToString(id)));
                    return selectedMove.cards;
                } else {
                    console.warn(`[${this.name} Engine] Invalid index returned:`, index);
                    return await this.localDecide(context);
                }
            } catch (parseError) {
                console.error(`%c[${this.name} Engine] JSON Parse Error:`, 'color: #c0392b; font-weight: bold;', parseError.message);
                console.log(`%c[Raw Response Context]:`, 'color: #7f8c8d;', jsonStr);
                return await this.localDecide(context);
            }

        } catch (e) {
            console.error(`[${this.name} Engine] Error:`, e);
            // Show vivid error in settings modal
            const apiError = document.getElementById('ai-api-error');
            if (apiError) {
                // Use global t if available, otherwise fallback
                const msg = (typeof t === 'function') ? t('apiError') : 'Connection Failed';
                apiError.textContent = `(${msg})`;
            }
        }

        // Clear error on new request attempt
        const apiError = document.getElementById('ai-api-error');
        if (apiError && !aiProcessing) apiError.textContent = '';


        return await this.localDecide(context);
    }

    stringToCardId(name) {
        if (!name) return null;
        const suits = ['Club', 'Diamond', 'Heart', 'Spade'];
        const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

        let foundSuit = -1;
        suits.forEach((s, i) => {
            if (name.toLowerCase().includes(s.toLowerCase())) foundSuit = i;
        });

        let foundRank = -1;
        ranks.forEach((r, i) => {
            const regex = new RegExp(`\\b${r}\\b`, 'i');
            if (regex.test(name)) foundRank = i;
        });

        if (foundSuit !== -1 && foundRank !== -1) {
            return foundRank + (foundSuit * 13);
        }
        return null;
    }

    getAllLegalMoves(context) {
        const Logic = this.getLogic();
        const { hand, lastPlay, lastPlayerIndex, playerIndex, shouted } = context;
        const moves = [];

        const isLead = !lastPlay || lastPlay.length === 0;
        const isFirstRound = lastPlayerIndex === -1 || lastPlayerIndex === undefined;
        const hasThreeOfClubs = hand.includes(0);

        // --- SHOUT RESTRICTION ---
        // If we have shouted "La" and our current hand is a valid combination, 
        // we are restricted to playing the FULL hand or PASS. No splitting.
        const isShouted = shouted && shouted[playerIndex];
        const isLastHand = Logic.isLastHand(hand);
        const shouldRestrictToFullHand = isShouted && isLastHand && hand.length > 1;

        if (shouldRestrictToFullHand) {
            // Option: PASS (if not leading)
            if (!isLead) {
                moves.push({ cards: [], description: "PASS (Must preserve your last hand to win)" });
            }

            // The only other option is to play the WHOLE hand
            const sortedHand = Logic.sortCards(hand);
            if (isLead) {
                const info = Logic.getHandInfo(sortedHand);
                moves.push({ cards: sortedHand, description: `[${sortedHand.map(c => this.cardToVerboseString(c)).join(', ')}] (FINAL HAND: ${info.type})` });
            } else {
                if (Logic.compareHands(sortedHand, lastPlay) > 0) {
                    const info = Logic.getHandInfo(sortedHand);
                    moves.push({ cards: sortedHand, description: `[${sortedHand.map(c => this.cardToVerboseString(c)).join(', ')}] (FINAL HAND: ${info.type} beats table)` });
                }
            }

            // If no moves possible, and we couldn't add PASS (because leading), 
            // this shouldn't happen because isLead is always true if table is empty.
            return moves;
        }
        // -------------------------

        // Option: PASS (if not leading)
        if (!isLead) {
            moves.push({ cards: [], description: "PASS (Keep your hand as is)" });
        }

        const sortedHand = Logic.sortCards(hand);

        if (isLead) {
            // Singles
            sortedHand.forEach(c => {
                if (isFirstRound && hasThreeOfClubs && c !== 0) return;
                moves.push({ cards: [c], description: `[${this.cardToVerboseString(c)}] (SINGLE)` });
            });
            // Pairs
            Logic.findPairs(sortedHand).forEach(p => {
                if (isFirstRound && hasThreeOfClubs && !p.includes(0)) return;
                moves.push({ cards: p, description: `[${p.map(c => this.cardToVerboseString(c)).join(', ')}] (PAIR)` });
            });
            // Triples
            Logic.findTriples(sortedHand).forEach(t => {
                if (isFirstRound && hasThreeOfClubs && !t.includes(0)) return;
                moves.push({ cards: t, description: `[${t.map(c => this.cardToVerboseString(c)).join(', ')}] (TRIPLE)` });
            });
            // 5-Card Hands
            Logic.findFiveCardHands(sortedHand).forEach(h => {
                if (isFirstRound && hasThreeOfClubs && !h.includes(0)) return;
                const info = Logic.getHandInfo(h);
                moves.push({ cards: h, description: `[${h.map(c => this.cardToVerboseString(c)).join(', ')}] (${info.type})` });
            });
        } else {
            const targetLen = lastPlay.length;
            if (targetLen === 1) {
                sortedHand.forEach(c => {
                    if (Logic.compareCards(c, lastPlay[0]) > 0) {
                        moves.push({ cards: [c], description: `[${this.cardToVerboseString(c)}] (Beats ${this.cardToVerboseString(lastPlay[0])})` });
                    }
                });
            } else if (targetLen === 2) {
                Logic.findPairs(sortedHand).forEach(p => {
                    if (Logic.compareHands(p, lastPlay) > 0) {
                        moves.push({ cards: p, description: `[${p.map(c => this.cardToVerboseString(c)).join(', ')}] (PAIR beats table)` });
                    }
                });
            } else if (targetLen === 3) {
                Logic.findTriples(sortedHand).forEach(t => {
                    if (Logic.compareHands(t, lastPlay) > 0) {
                        moves.push({ cards: t, description: `[${t.map(c => this.cardToVerboseString(c)).join(', ')}] (TRIPLE beats table)` });
                    }
                });
            } else if (targetLen === 5) {
                Logic.findFiveCardHands(sortedHand).forEach(h => {
                    if (Logic.compareHands(h, lastPlay) > 0) {
                        const info = Logic.getHandInfo(h);
                        moves.push({ cards: h, description: `[${h.map(c => this.cardToVerboseString(c)).join(', ')}] (${info.type} beats table)` });
                    }
                });
            }
        }

        // Add "Highest card" hint for control if relevant
        if (moves.length > 0) {
            const highTwos = moves.filter(m => m.cards.some(c => Logic.getRank(c) === 12));
            highTwos.forEach(m => {
                m.description += " (Highest card, ensures control)";
            });
        }

        return moves;
    }

    generatePrompt(context, legalMoves) {
        const { hand, lastPlay, players } = context;
        const Logic = this.getLogic();

        let prompt = `[GAME STATE]\n`;
        prompt += `- Your Hand: [${hand.map(c => this.cardToVerboseString(c)).join(', ')}]\n`;

        // Opponent Profiling
        prompt += `- Opponents Status:\n`;
        for (let i = 0; i < 4; i++) {
            if (i === context.playerIndex) continue;
            const count = players[i].length;
            const name = (context.playerNames && context.playerNames[i]) ? context.playerNames[i] : `P${i + 1}`;
            let labels = [];

            if (count <= 2) labels.push("CRITICAL: Near win!");
            if (count <= 5 && count > 2) labels.push("WARNING: Low cards");

            const lastAction = context.playerLastActions ? context.playerLastActions[i] : null;
            if (Array.isArray(lastAction)) {
                const hasBigCard = lastAction.some(c => Logic.getRank(c) >= 11); // Ace or 2
                const isStrongHand = lastAction.length >= 5;
                if (hasBigCard || isStrongHand) {
                    labels.push(`AGGRESSIVE: Just played ${lastAction.length > 1 ? 'a strong hand' : 'a big card'}`);
                }
            }

            prompt += `  * ${name}: ${count} cards ${labels.length > 0 ? `[${labels.join(', ')}]` : ''}\n`;
        }

        // Tracked Cards (Aces and 2s) logic
        if (context.playedCards) {
            const summary = this.getTrackedCardsSummary(context.playedCards, hand);
            prompt += `- Tracked Cards: ${summary}\n`;
        }

        if (lastPlay && lastPlay.length > 0) {
            const info = Logic.getHandInfo(lastPlay);
            prompt += `- Last Play on Table: [${lastPlay.map(c => this.cardToVerboseString(c)).join(', ')}] (${info ? info.type : 'Unknown'})\n`;
        } else {
            prompt += `- Last Play on Table: None (You lead)\n`;
        }

        prompt += `\n[LEGAL_MOVES]\n`;
        const isOpponentCritical = players.some((p, i) => i !== context.playerIndex && p.length <= 2);

        legalMoves.forEach((move, i) => {
            let heuristic = "";
            if (move.cards.length === 0) {
                heuristic = isOpponentCritical ? "(Risk: High probability of opponent winning!)" : "(Benefit: Preserves big cards for later)";
            } else {
                const highCard = Math.max(...move.cards.map(c => Logic.getRank(c)));
                if (highCard >= 11) { // Ace or 2
                    heuristic = "(Benefit: Likely to take control. Risk: Consumes a big card)";
                } else if (move.cards.length >= 5) {
                    heuristic = "(Benefit: Clears many cards. Risk: Might be beaten by a higher 5-card hand)";
                } else if (highCard <= 5) {
                    heuristic = "(Benefit: Dumps a weak card. Risk: Unlikely to take control)";
                }
            }
            prompt += `${i}: ${move.description} ${heuristic}\n`;
        });

        prompt += `\nInstruction: Select the best index.`;
        return prompt;
    }

    cardToVerboseString(cardId) {
        const suits = ['Club', 'Diamond', 'Heart', 'Spade'];
        const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
        const Logic = this.getLogic();
        return `${suits[Logic.getSuit(cardId)]} ${ranks[Logic.getRank(cardId)]}`;
    }

    getTrackedCardsSummary(playedCards, myHand) {
        const Logic = this.getLogic();
        const bigRanks = [10, 11, 12]; // King, Ace, 2
        const suits = ['Club', 'Diamond', 'Heart', 'Spade'];
        const rankNames = { 10: 'King', 11: 'Ace', 12: '2' };

        let summary = [];
        let bossCards = [];

        // 1. Track Big Cards Remaining
        for (let r of bigRanks) {
            let unplayedInSuit = [];
            for (let s = 0; s < 4; s++) {
                const cardId = r + (s * 13);
                if (!playedCards.includes(cardId) && !myHand.includes(cardId)) {
                    unplayedInSuit.push(suits[s]);
                }
            }

            if (unplayedInSuit.length === 0) {
                summary.push(`All ${rankNames[r]}s are accounted for`);
            } else {
                summary.push(`${unplayedInSuit.join('/')} ${rankNames[r]}s are still out there`);
            }
        }

        // 2. Boss Card Detection (Is my card the highest remaining?)
        // Check my hand for the absolute highest remaining card in the game
        const allUnplayed = [];
        for (let i = 0; i < 52; i++) {
            if (!playedCards.includes(i)) allUnplayed.push(i);
        }
        const sortedUnplayed = Logic.sortCards(allUnplayed);
        const highestOverall = sortedUnplayed[sortedUnplayed.length - 1];

        if (myHand.includes(highestOverall)) {
            bossCards.push(this.cardToVerboseString(highestOverall));
        }

        let result = `Remaining High Cards: ${summary.join('; ')}.`;
        if (bossCards.length > 0) {
            result += ` YOU HAVE THE BOSS CARD: ${bossCards.join(', ')}. Use it to take control!`;
        }

        return result;
    }

    setSettings(settings) {
        if (settings.apiUrl !== undefined) this.apiUrl = settings.apiUrl;
        if (settings.modelId !== undefined) this.modelId = settings.modelId;
        if (settings.extraPrompt !== undefined) this.extraPrompt = settings.extraPrompt;

        // Save to persistent storage using character-specific key
        try {
            localStorage.setItem(this.settingsKey, JSON.stringify({
                apiUrl: this.apiUrl,
                modelId: this.modelId,
                extraPrompt: this.extraPrompt
            }));
        } catch (e) {
            console.error(`[${this.name} Engine] Failed to save settings:`, e);
        }
    }

    getSettings() {
        return {
            apiUrl: this.apiUrl,
            modelId: this.modelId,
            extraPrompt: this.extraPrompt
        };
    }

    async reflect(gameLog, didWin, winnerName, characterNames, myIndex, finalHand) {
        // Update Stats
        if (didWin) this.stats.wins++;
        else this.stats.losses++;
        this.saveMemory();

        if (didWin) return; // Only reflect on losses to save compute

        console.log(`%c[${this.name} Engine] Analyzing loss and reflecting...`, 'color: #f39c12; font-weight: bold;');

        // Simplify log for prompt (translate P-indices to Names)
        let logStr = gameLog.map(l => {
            const pName = l.player === myIndex ? "You" : (characterNames[l.player] || `P${l.player + 1}`);
            let actionStr = "skipped (PASS)";
            if (Array.isArray(l.action)) {
                actionStr = `played [${l.action.map(c => this.cardToString(c)).join(',')}]`;
            }
            return `T${l.turn}: ${pName} ${actionStr}`;
        }).join('\n');

        // Truncate to only the last 10 turns
        const logLines = logStr.split('\n');
        if (logLines.length > 10) {
            logStr = "...(earlier turns omitted)...\n" + logLines.slice(-10).join('\n');
        }

        const handStr = finalHand && finalHand.length > 0
            ? `[${finalHand.map(c => this.cardToVerboseString(c)).join(', ')}]`
            : `None`;

        const prompt = `[${this.name} Reflection Prompt]
Role: Big Two Strategist.
Status: You (${this.name}) LOST. ${winnerName} WON.

[SITUATION AT ENDGAME]
- Your Remaining Hand: ${handStr}
- Opponent (${winnerName}) Status: Finished the game.

[GAME LOG SUMMARY]
${logStr}

    Task: Identify ONE mistake. (Hint: Did you hold onto a big card too long? Did you fail to break a pair?)
    Output: EXACTLY one short strategic tip (max 12 words).
    Constraint: NO "Next time", NO conversational text. Just the tip.
    Example: "Break pairs early when opponents have few cards remaining."
    Start your response directly with the tip.`;

        console.log(`%c[${this.name} Reflection Prompt]:`, 'color: #f39c12; font-weight: bold;', prompt);

        // Auto-detect model if not manually specified
        let activeModel = this.modelId;
        if (!activeModel) {
            try {
                const urlObj = new URL(this.apiUrl);
                const modelsUrl = `${urlObj.protocol}//${urlObj.host}/v1/models`;
                const modelRes = await fetch(modelsUrl);
                if (modelRes.ok) {
                    const modelData = await modelRes.json();
                    if (modelData && modelData.data && modelData.data.length > 0) {
                        activeModel = modelData.data[0].id;
                        console.log(`%c[${this.name} Engine] Auto-detected reflection model: ${activeModel}`, 'color: #16a085;');
                    }
                }
            } catch (e) {
                console.warn(`[${this.name} Engine] Model auto-detection failed for reflection.`, e);
            }
        }
        if (!activeModel) activeModel = "local-model"; // Fallback

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: activeModel,
                    messages: [
                        { role: "user", content: "Instruction: SKIP thinking. Do NOT provide a reasoning process. Output ONLY the strategic rule.\n\n" + prompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 4096,
                    stream: false
                }),
                signal: controller.signal
            });
            console.log(`%c[${this.name} Engine] API Response Status: ${response.status}`, 'color: #3498db;');
            if (response.ok) {
                const data = await response.json();
                console.log(`[${this.name} Engine] Raw Reflection Data:`, data);

                if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                    const msg = data.choices[0].message;
                    // Support models that put output in reasoning_content
                    let rawContent = (msg.content || msg.reasoning_content || "").trim();
                    console.log(`[${this.name} Engine] Parsed Rule Candidate (Raw):`, rawContent);

                    // EXTRACTION: Small models often ignore instructions to skip thinking.
                    // We look for the specific required prefix.
                    let rule = "";
                    const match = rawContent.match(/, I should[\s\S]*/i);
                    if (match) {
                        // Capture until the first double newline or end of string
                        rule = match[0].split("\n\n")[0].trim();
                    } else {
                        rule = rawContent; // Fallback
                    }

                    // Clean up common LLM artifacts and thinking blocks
                    rule = rule.replace(/<think>[\s\S]*?<\/think>/g, '');
                    rule = rule.replace(/Thinking Process:[\s\S]*?\n\n/gi, '');
                    rule = rule.replace(/^[\d.\s*-]+/, ''); // Remove leading numbers/bullets like "1. " or "- "
                    rule = rule.replace(/^["'*]+|["'*]+$/g, '').replace(/^Rule: /i, '').trim();

                    // Robust prefix stripping
                    rule = rule.replace(/^(Next time,\s*)?I should\s*/i, '').trim();
                    if (rule) rule = rule.charAt(0).toUpperCase() + rule.slice(1);

                    if (rule && rule.length > 3) {
                        // 1. Determine Priority
                        let priority = "P2"; // Default: Efficiency
                        const lowRule = rule.toLowerCase();
                        if (lowRule.includes("one card") || lowRule.includes("last") || lowRule.includes("shout") || lowRule.includes("stop") || lowRule.includes("endgame")) {
                            priority = "P0"; // Endgame Survival
                        } else if (lowRule.includes("2") || lowRule.includes("ace") || lowRule.includes("control") || lowRule.includes("lead") || lowRule.includes("pass")) {
                            priority = "P1"; // Control/Tactical
                        }

                        // 2. Check for Duplicates / Frequency Update (Using Similarity)
                        const existing = this.learnings.find(l => this.isSimilar(l.tip, rule));
                        if (existing) {
                            existing.count++;
                            existing.timestamp = Date.now();
                            // If the new rule is slightly different but similar, keep the shorter one
                            if (rule.length < existing.tip.length) existing.tip = rule;
                            existing.priority = priority;
                        } else {
                            this.learnings.push({
                                tip: rule,
                                count: 1,
                                priority: priority,
                                timestamp: Date.now()
                            });
                        }

                        // 3. Intelligent Pruning
                        this.pruneLearnings();
                        this.saveMemory();
                        console.log(`%c[${this.name} Learning] Rule processed (${priority}, count: ${existing ? existing.count : 1}): ${rule}`, 'color: #2ecc71; font-weight: bold;');
                    } else {
                        console.log(`%c[${this.name} Engine] Rule rejected (too short or no 'Next time' prefix)`, 'color: #e67e22;');
                    }
                }
            }
        } catch (e) {
            console.warn(`[${this.name} Engine] Reflection failed.`, e);
        }
    }
}

/**
 * Diana (LLM) - The Oracle
 */
class DianaAI extends BaseLLMAI {
    constructor(gameLogic) {
        super(gameLogic, "Diana", "✨");
    }
}

/**
 * Ares (LLM) - The God of War
 */
class AresAI extends BaseLLMAI {
    constructor(gameLogic) {
        super(gameLogic, "Ares", "⚔️");
    }
}



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
                    return { name: "You", avatar: "🐼", type: "Human", isLLM: false };
                } else {
                    const newCharacter = new candidateBlueprint(this.gameLogic);
                    this.characters[playerIndex] = newCharacter;
                    console.log(`%c[AI Manager] Swapped Player ${playerIndex + 1} to ${newCharacter.name}`, 'color: #3498db; font-weight: bold;');
                    return newCharacter;
                }
            }
        }

        return this.characters[playerIndex] || { name: "You", avatar: "🐼", type: "Human", isLLM: false };
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
    module.exports = { BigTwoAI, AlexAI, BellaAI, DianaAI };
}

window.AI = new BigTwoAI(window.GameLogic || (typeof GameLogic !== 'undefined' ? GameLogic : null));
window.AI = new BigTwoAI(window.GameLogic || (typeof GameLogic !== 'undefined' ? GameLogic : null));

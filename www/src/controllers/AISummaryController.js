import { AISummaryView } from '../views/AISummaryView.js';

export class AISummaryController {
    constructor() {
        this.apiUrl = typeof AppStorage !== 'undefined' && AppStorage.getItem('reviewLlmUrl')
            ? AppStorage.getItem('reviewLlmUrl')
            : 'http://127.0.0.1:1234/v1/chat/completions';
        this.apiKey = typeof AppStorage !== 'undefined' && AppStorage.getItem('reviewLlmApiKey')
            ? AppStorage.getItem('reviewLlmApiKey')
            : '';
        this.reviewPanelEnabled = typeof AppStorage !== 'undefined' && AppStorage.getItem('reviewPanelEnabled') !== null
            ? AppStorage.getItem('reviewPanelEnabled') === 'true'
            : true;
        this.reviewUseWebGPU = typeof AppStorage !== 'undefined' && AppStorage.getItem('reviewUseWebGPU') === 'true';
        this.currentAbortController = null;
        
        this.lastGameState = null;
        this.lastWinnerIndex = -1;
        this.chatHistory = [];
        this.activeModel = '';
        this.lastConnectionStatus = null;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        AISummaryView.init(this);

        this.panel = AISummaryView.panel;
        this.closeBtn = document.getElementById('ai-review-close-btn');
        this.newGameBtn = document.getElementById('ai-review-newgame-btn');
        this.corsCloseBtn = document.getElementById('ai-cors-close-btn');
        this.corsRetryBtn = AISummaryView.corsRetryBtn;

        if (!this.panel) return;

        if (this.closeBtn) this.closeBtn.onclick = () => this.hidePanel();
        
        this.toggleHandle = document.getElementById('ai-review-toggle-handle');
        if (this.toggleHandle) {
            this.toggleHandle.onclick = (e) => {
                e.stopPropagation();
                const isCollapsed = this.panel.classList.contains('translate-x-full') || this.panel.classList.contains('translate-y-full');
                if (isCollapsed) {
                    this.showPanel();
                } else {
                    this.hidePanel(false);
                }
            };
        }
        
        if (AISummaryView.askBtn) {
            AISummaryView.askBtn.onclick = () => this.handleUserQuestion();
        }
        if (AISummaryView.questionInput) {
            AISummaryView.questionInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleUserQuestion();
                }
            };
        }

        if (this.newGameBtn) {
            this.newGameBtn.onclick = () => {
                this.hidePanel();
                const btnNew = document.getElementById('btn-new');
                if (btnNew) btnNew.click();
            };
        }
        if (this.corsCloseBtn) {
            this.corsCloseBtn.onclick = () => this.hideCORSModal();
        }
        if (this.corsRetryBtn) {
            this.corsRetryBtn.onclick = async () => {
                this.hideCORSModal();
                await this.testConnectionAndPopulateModels();
                if (this.lastGameState) {
                    this.showSummary(this.lastGameState, this.lastWinnerIndex);
                }
            };
        }

        const reviewLlmGuideBtn = document.getElementById('review-llm-guide-btn');
        if (reviewLlmGuideBtn) {
            reviewLlmGuideBtn.onclick = () => {
                this.showCORSModal();
            };
        }

        const reviewPanelEnabledInput = document.getElementById('review-panel-enabled');
        if (reviewPanelEnabledInput) {
            reviewPanelEnabledInput.checked = this.reviewPanelEnabled;
            reviewPanelEnabledInput.onchange = () => {
                const checked = reviewPanelEnabledInput.checked;
                this.reviewPanelEnabled = checked;
                if (typeof AppStorage !== 'undefined') {
                    AppStorage.setItem('reviewPanelEnabled', checked.toString());
                }
            };
        }

        const reviewUseWebGpuInput = document.getElementById('review-use-webgpu');
        if (reviewUseWebGpuInput) {
            reviewUseWebGpuInput.checked = this.reviewUseWebGPU;
            reviewUseWebGpuInput.onchange = () => {
                const checked = reviewUseWebGpuInput.checked;
                this.reviewUseWebGPU = checked;
                if (typeof AppStorage !== 'undefined') {
                    AppStorage.setItem('reviewUseWebGPU', checked.toString());
                }
                this.testConnectionAndPopulateModels();
            };
        }

        const reviewLlmUrlInput = document.getElementById('review-llm-url');
        let debounceTimeout = null;
        if (reviewLlmUrlInput) {
            reviewLlmUrlInput.value = this.apiUrl;
            reviewLlmUrlInput.oninput = () => {
                const val = reviewLlmUrlInput.value.trim();
                this.apiUrl = val || 'http://127.0.0.1:1234/v1/chat/completions';
                if (typeof AppStorage !== 'undefined') {
                    AppStorage.setItem('reviewLlmUrl', this.apiUrl);
                }

                if (debounceTimeout) clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    this.testConnectionAndPopulateModels();
                }, 800);
            };
        }

        const reviewLlmApiKeyInput = document.getElementById('review-llm-api-key');
        if (reviewLlmApiKeyInput) {
            reviewLlmApiKeyInput.value = this.apiKey;
            reviewLlmApiKeyInput.oninput = () => {
                const val = reviewLlmApiKeyInput.value.trim();
                this.apiKey = val;
                if (typeof AppStorage !== 'undefined') {
                    AppStorage.setItem('reviewLlmApiKey', val);
                }

                if (debounceTimeout) clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    this.testConnectionAndPopulateModels();
                }, 800);
            };
        }

        const reviewLlmModelInput = document.getElementById('review-llm-model');
        if (reviewLlmModelInput) {
            reviewLlmModelInput.onchange = () => {
                const val = reviewLlmModelInput.value.trim();
                if (typeof AppStorage !== 'undefined') {
                    AppStorage.setItem('reviewLlmModel', val);
                }
            };
        }

        const aiSettingsTabBtn = document.querySelector('.tab-btn[data-tab="ai-settings"]');
        if (aiSettingsTabBtn) {
            aiSettingsTabBtn.addEventListener('click', () => {
                this.testConnectionAndPopulateModels();
            });
        }

        console.log('[AI Summary] Controller initialized.');
    }

    showPanel() {
        AISummaryView.showPanel();
        this.testConnectionAndPopulateModels();
    }

    hidePanel(shouldHideCompletely = true) {
        AISummaryView.hidePanel(shouldHideCompletely);
        this.abortActiveAnalysis();
    }

    showCORSModal() {
        let displayUrl = 'http://127.0.0.1:1234';
        try {
            const urlObj = new URL(this.apiUrl);
            displayUrl = `${urlObj.protocol}//${urlObj.host}`;
        } catch (e) {
            displayUrl = this.apiUrl;
        }
        AISummaryView.showCORSModal(this.getProviderName(), displayUrl);
    }

    hideCORSModal() {
        AISummaryView.hideCORSModal();
    }

    getProviderName() {
        if (this.reviewUseWebGPU) {
            return 'WebLLM';
        }
        const urlStr = (this.apiUrl || '').toLowerCase();
        if (urlStr.includes('1234') || urlStr.includes('lmstudio') || urlStr.includes('lm-studio')) {
            return 'LM Studio';
        }
        if (urlStr.includes('11434') || urlStr.includes('ollama')) {
            return 'Ollama';
        }
        if (urlStr.includes('openai') || urlStr.includes('api.openai.com')) {
            return 'OpenAI';
        }
        return 'LLM';
    }

    updateConnectionStatus(status) {
        this.lastConnectionStatus = status;
        AISummaryView.updateConnectionStatus(status, this.getProviderName());
    }

    async updateLanguage() {
        this.testConnectionAndPopulateModels();
        
        const titleEl = document.getElementById('ai-review-title');
        if (titleEl) {
            const displayName = this.activeModel || 'AI';
            titleEl.textContent = t('aiReviewTitleParam', { model: displayName });
        }

        if (this.lastGameState) {
            AISummaryView.renderStats(this.lastGameState, this.lastWinnerIndex);
        }

        if (this.lastConnectionStatus) {
            this.updateConnectionStatus(this.lastConnectionStatus);
        }

        const connectingEl = document.getElementById('ai-connecting-message');
        if (connectingEl) {
            const provider = this.getProviderName();
            connectingEl.innerHTML = `
                <span class="animate-spin text-sm">⌛</span> ${t('connectingLocalProvider', { provider })}
            `;
        }

        const loadingMessageEl = document.getElementById('ai-loading-message');
        if (loadingMessageEl) {
            let activeModel = typeof AppStorage !== 'undefined' ? (AppStorage.getItem('reviewLlmModel') || '').trim() : '';
            if (!activeModel) activeModel = this.activeModel || 'AI';
            loadingMessageEl.textContent = t('modelAnalyzingMatch', { model: activeModel });
        }

        const reviewLlmModelInput = document.getElementById('review-llm-model');
        if (reviewLlmModelInput && !reviewLlmModelInput.value.trim()) {
            const activeModel = this.activeModel || 'AI';
            reviewLlmModelInput.placeholder = t('autoDetectedModel', { model: activeModel });
        }
    }

    async testConnectionAndPopulateModels() {
        const statusEl = document.getElementById('review-llm-connection-status');
        const modelList = document.getElementById('review-llm-model');
        const savedModelId = typeof AppStorage !== 'undefined' ? (AppStorage.getItem('reviewLlmModel') || '') : '';

        if (modelList) {
            modelList.innerHTML = '';
        }

        if (this.reviewUseWebGPU) {
            const { WebLlmCacheManager } = await import('../services/WebLlmCacheManager.js');
            const localModels = await WebLlmCacheManager.getFullyCachedStandardModels();

            if (localModels.length === 0) {
                if (statusEl) {
                    statusEl.textContent = t('builtInAiEngineActiveNeedsDownload');
                    statusEl.style.color = '#ef4444';
                }
                if (modelList) {
                    const placeholder = document.createElement('option');
                    placeholder.value = '';
                    placeholder.textContent = t('noModelsDownloaded');
                    modelList.appendChild(placeholder);
                }
            } else {
                if (statusEl) {
                    statusEl.textContent = t('builtInAiEngineActive');
                    statusEl.style.color = '#10b981';
                }
                if (modelList) {
                    localModels.forEach(m => {
                        const option = document.createElement('option');
                        option.value = m.id;
                        option.textContent = m.name;
                        modelList.appendChild(option);
                    });
                }
            }

            if (modelList) {
                if (savedModelId && !localModels.some(m => m.id === savedModelId)) {
                    const cachedList = await WebLlmCacheManager.listCachedModels();
                    const isSavedCached = cachedList.some(c => c.toLowerCase() === savedModelId.toLowerCase());
                    if (isSavedCached) {
                        const completion = await WebLlmCacheManager.getCacheCompletion(savedModelId);
                        if (completion === 100) {
                            const customOption = document.createElement('option');
                            customOption.value = savedModelId;
                            customOption.textContent = savedModelId;
                            modelList.appendChild(customOption);
                        }
                    }
                }

                modelList.value = savedModelId || (localModels.length > 0 ? localModels[0].id : '');
                if (modelList.value !== savedModelId) {
                    if (typeof AppStorage !== 'undefined') {
                        AppStorage.setItem('reviewLlmModel', modelList.value);
                    }
                }
            }
            this.retrySummary();
            return;
        }

        if (this._modelFetchController) {
            this._modelFetchController.abort();
        }
        this._modelFetchController = new AbortController();
        const controller = this._modelFetchController;

        if (modelList) {
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = t('autoDetect');
            modelList.appendChild(defaultOption);
        }

        if (statusEl) {
            statusEl.textContent = t('connectionTesting');
            statusEl.style.color = '#f59e0b';
        }

        try {
            const urlObj = new URL(this.apiUrl);
            const modelsUrl = `${urlObj.protocol}//${urlObj.host}/v1/models`;

            const id = setTimeout(() => controller.abort(), 3000);

            const headers = {};
            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const response = await fetch(modelsUrl, {
                method: 'GET',
                mode: 'cors',
                headers: headers,
                signal: controller.signal
            });
            clearTimeout(id);

            if (response.ok) {
                const data = await response.json();
                if (statusEl) {
                    statusEl.textContent = t('connectionSuccess');
                    statusEl.style.color = '#10b981';
                }

                this.retrySummary();

                if (modelList) {
                    const seen = new Set();
                    let hasSavedModel = false;
                    if (data && data.data) {
                        data.data.forEach((model) => {
                            const mId = model.id;
                            if (!mId || seen.has(mId)) return;
                            seen.add(mId);
                            if (mId === savedModelId) hasSavedModel = true;
                            const option = document.createElement('option');
                            option.value = mId;
                            option.textContent = mId;
                            modelList.appendChild(option);
                        });
                    }
                    if (savedModelId && !hasSavedModel) {
                        const customOption = document.createElement('option');
                        customOption.value = savedModelId;
                        customOption.textContent = savedModelId;
                        modelList.appendChild(customOption);
                    }
                    modelList.value = savedModelId;
                }
            } else {
                throw new Error('Response not OK');
            }
        } catch (e) {
            console.warn('[AI Summary] Settings connection check failed:', e);
            if (statusEl) {
                statusEl.textContent = t('connectionFailed');
                statusEl.style.color = '#ef4444';
            }
            if (modelList && savedModelId) {
                const customOption = document.createElement('option');
                customOption.value = savedModelId;
                customOption.textContent = savedModelId;
                modelList.appendChild(customOption);
                modelList.value = savedModelId;
            }
        }
    }

    retrySummary() {
        if (this.lastGameState && this.lastConnectionStatus === 'failed') {
            console.log('[AI Summary] Retrying failed summary...');
            this.showSummary(this.lastGameState, this.lastWinnerIndex);
        }
    }

    async checkConnection() {
        try {
            const urlObj = new URL(this.apiUrl);
            const modelsUrl = `${urlObj.protocol}//${urlObj.host}/v1/models`;
            
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 2000);
            
            const headers = {};
            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const response = await fetch(modelsUrl, {
                method: 'GET',
                mode: 'cors',
                headers: headers,
                signal: controller.signal
            });
            clearTimeout(id);
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    async showSummary(gameState, winnerIndex) {
        this.lastGameState = gameState;
        this.lastWinnerIndex = winnerIndex;
        this.chatHistory = [];
        this.activeModel = '';
        
        if (AISummaryView.questionInput) {
            AISummaryView.questionInput.value = '';
        }
        AISummaryView.setInputDisabledState(false);

        this.abortActiveAnalysis();
        this.currentAbortController = new AbortController();
        
        this.showPanel();
        AISummaryView.renderStats(gameState, winnerIndex);
        
        const isEn = window.currentLang === 'en';
        let activeModel = typeof AppStorage !== 'undefined' ? (AppStorage.getItem('reviewLlmModel') || '').trim() : '';
        const displayName = activeModel || 'AI';

        const titleEl = document.getElementById('ai-review-title');
        if (titleEl) {
            titleEl.textContent = t('aiReviewTitleParam', { model: displayName });
        }

        const provider = this.getProviderName();

        if (AISummaryView.summaryContainer) {
            AISummaryView.summaryContainer.innerHTML = `
                <div id="ai-connecting-message" class="flex items-center gap-2 text-slate-400 text-xs">
                    <span class="animate-spin text-sm">⌛</span> ${t('connectingLocalProvider', { provider })}
                </div>
            `;
        }

        if (this.reviewUseWebGPU) {
            this.updateConnectionStatus('connected');
            let activeModel = typeof AppStorage !== 'undefined' ? (AppStorage.getItem('reviewLlmModel') || '').trim() : '';
            if (!activeModel) activeModel = 'AI';
            AISummaryView.startLoadingAnimation(activeModel);
            const subEl = document.getElementById('ai-loading-submessage');
            if (subEl) {
                subEl.textContent = t('preparingWebgpuModel');
            }
        } else {
            this.updateConnectionStatus('checking');
            const isConnected = await this.checkConnection();

            if (!isConnected) {
                this.updateConnectionStatus('failed');
                if (AISummaryView.summaryContainer) {
                    if (provider === 'LM Studio') {
                        AISummaryView.summaryContainer.innerHTML = `<div class="text-red-400 text-xs border border-red-950 bg-red-950/20 p-3 rounded-lg flex flex-col gap-2"><span>${t('connectionLmstFailed')}</span><span class="text-[11px] text-slate-400">${t('connectionLmstFailedTip')}</span></div>`;
                    } else {
                        AISummaryView.summaryContainer.innerHTML = `<div class="text-red-400 text-xs border border-red-950 bg-red-950/20 p-3 rounded-lg flex flex-col gap-2"><span>${t('connectionProviderFailed', { provider })}</span><span class="text-[11px] text-slate-400">${t('connectionProviderFailedTip', { url: this.apiUrl })}</span></div>`;
                    }
                }
                return;
            }

            this.updateConnectionStatus('connected');
            let activeModel = typeof AppStorage !== 'undefined' ? (AppStorage.getItem('reviewLlmModel') || '').trim() : '';
            if (!activeModel) activeModel = 'AI';
            AISummaryView.startLoadingAnimation(activeModel);
        }
        
        try {
            await this.requestAISummary(gameState, winnerIndex, this.currentAbortController.signal);
        } catch (err) {
            AISummaryView.stopLoadingAnimation();
            if (err.name === 'AbortError') {
                console.log('[AI Summary] Fetch aborted.');
                return;
            }
            console.error('[AI Summary] Request failed:', err);
            if (AISummaryView.summaryContainer) {
                AISummaryView.summaryContainer.innerHTML = `<div class="text-red-400 text-xs border border-red-950 bg-red-950/20 p-3 rounded-lg">❌ ${t('analysisFailed')}：${err.message || err}</div>`;
            }
            this.updateConnectionStatus('failed');
        }
    }

    async requestAISummary(gameState, winnerIndex, signal) {
        const isEn = window.currentLang === 'en';
        const playerNames = window.PLAYER_NAMES || (isEn ? ["You", "Alex", "Bella", "Chris"] : ["你", "艾力克斯", "貝拉", "克里斯"]);

        const startingHands = [[], [], [], []];
        gameState.players.forEach((hand, idx) => {
            startingHands[idx] = [...hand];
        });
        if (gameState.gameLog && Array.isArray(gameState.gameLog)) {
            gameState.gameLog.forEach(entry => {
                if (entry.action !== "PASS" && Array.isArray(entry.action)) {
                    startingHands[entry.player].push(...entry.action);
                }
            });
        }
        startingHands.forEach((hand, idx) => {
            if (typeof GameLogic !== 'undefined') {
                startingHands[idx] = GameLogic.sortCards(hand);
            } else {
                startingHands[idx] = hand.sort((a, b) => a - b);
            }
        });

        const getCardName = (cardId) => {
            const rankLabels = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
            const suitSymbols = ['♣', '♦', '♥', '♠'];
            const rankIdx = typeof GameLogic !== 'undefined' ? GameLogic.getRank(cardId) : (cardId % 13);
            const suitIdx = typeof GameLogic !== 'undefined' ? GameLogic.getSuit(cardId) : Math.floor(cardId / 13);
            return suitSymbols[suitIdx] + rankLabels[rankIdx];
        };

        const stats = {
            winner: playerNames[winnerIndex],
            players: gameState.players.map((hand, idx) => ({
                name: playerNames[idx],
                starting_hand: startingHands[idx].map(getCardName),
                remaining_cards: hand.map(getCardName),
                remaining_count: hand.length,
                is_homerun: hand.length === 13
            })),
            game_play_history: (gameState.gameLog || []).map(entry => {
                const name = playerNames[entry.player];
                if (entry.action === "PASS") {
                    return `Turn ${entry.turn + 1}: ${name} passed`;
                } else {
                    return `Turn ${entry.turn + 1}: ${name} played [${entry.action.map(getCardName).join(', ')}]`;
                }
            })
        };

        let systemPrompt = '';
        let userPrompt = '';

        if (isEn) {
            systemPrompt = `You are a professional Big Two card game analysis expert reviewing a match that just ended.
Your task is to analyze the match results, the starting hands of each player, and the chronological play history. Give constructive tactical commentary for each player based on how they played their cards. Keep the tone helpful, encouraging, and professional.

Your review MUST include the following sections and be presented in clean Markdown format:
### 🃏 Match Summary
(Provide an overall summary of the match results, highlighting the key turns and interesting plays)

### 💡 Tactical Analysis
(Provide tactical advice and analysis for the players. Analyze their starting hands and how they managed their cards throughout the play history)

Please structure your comments into distinct blocks of [Review] and [Analysis]:
- Use [Review] at the beginning of a paragraph to explain which step was not played well (identify suboptimal plays, e.g., playing a high card too early or passing when they could have taken control) in a positive and constructive manner. Do NOT tease or roast the player.
- Use [Analysis] at the beginning of a paragraph to explain how the player can do better in the future (provide improvement strategies and tactical suggestions).
Ensure every paragraph starts with either [Review] or [Analysis]!`;

            userPrompt = `Here is the Big Two game statistics, starting hands, and play history in JSON format:
\`\`\`json
${JSON.stringify(stats, null, 2)}
\`\`\`
Please review this match according to the rules, analyze the play history, and output strictly in English.`;
        } else {
            systemPrompt = `你是一個專業的大老二牌局分析專家，在大老二牌局結束後進行戰術復盤。
你的任務是點評這次牌局的結果。請根據每位玩家的起始手牌（starting_hand）、完整的出牌歷程（game_play_history）以及最終賸餘手牌（remaining_cards），對每個人在關鍵輪次的出牌決策給予客觀、精準且具建設性的戰術點評。請保持態度積極正面、客觀且具建設性，切勿嘲諷玩家。

你的點評必須包含以下部分，並以清晰的 Markdown 格式呈現：
### 🃏 戰局結果點評
（對整體局勢進行精簡點評，指出關鍵轉折點與勝負分析）

### 💡 戰術點評
（針對各個玩家的起手牌與出牌歷史，指出哪些牌打得好，哪些牌的出牌時機不佳，並給出專業實用的戰術建議，例如出牌順序、控牌權的爭奪、大牌的保留時機等）

請在點評時，將段落區分為 [檢討] 或 [分析] 兩類區塊：
- 當你需要說明玩家本局哪一步做得不好，指出其戰術失誤或不夠妥當的出牌選擇時（例如過早打出關鍵大牌，或在有機會接牌時選擇過牌），請在段落開頭加上 [檢討]（例如：[檢討] 艾力克斯在第5輪過早打出梅花K，導致後期失去了控牌權...）。請務必用正面、客觀的態度指出問題，絕不帶任何挖苦與嘲諷。
- 當你需要說明玩家將來可以怎麼做，提供專業的戰術建議與改進策略時，請在段落開頭加上 [分析]（例如：[分析] 艾力克斯將來在手牌大牌較少時，可以考慮優先保留黑桃2作為關鍵的斷牌工具...）。
請確保每一段評語都要以 [檢討] 或 [分析] 開頭！`;

            userPrompt = `以下為大老二牌局統計數據、起手牌及出牌歷程（JSON 格式）：
\`\`\`json
${JSON.stringify(stats, null, 2)}
\`\`\`
請針對此數據與完整出牌歷程進行復盤，並使用繁體中文輸出。`;
        }

        let activeModel = typeof AppStorage !== 'undefined' ? (AppStorage.getItem('reviewLlmModel') || '').trim() : '';
        if (!activeModel && !this.reviewUseWebGPU) {
            try {
                const urlObj = new URL(this.apiUrl);
                const modelsUrl = `${urlObj.protocol}//${urlObj.host}/v1/models`;
                const detectHeaders = {};
                if (this.apiKey) {
                    detectHeaders['Authorization'] = `Bearer ${this.apiKey}`;
                }
                const modelRes = await fetch(modelsUrl, {
                    headers: detectHeaders,
                    signal
                });
                if (modelRes.ok) {
                    const modelData = await modelRes.json();
                    if (modelData && modelData.data && modelData.data.length > 0) {
                        activeModel = modelData.data[0].id;
                    }
                }
            } catch (e) {
                console.warn('[AI Summary] Could not auto-detect model ID, falling back to local-model:', e);
            }
        }
        if (!activeModel) {
            activeModel = this.reviewUseWebGPU ? 'gemma-2-2b-it-q4f16_1-MLC' : 'local-model';
        }

        this.activeModel = activeModel;

        const loadingMessageEl = document.getElementById('ai-loading-message');
        if (loadingMessageEl) {
            loadingMessageEl.textContent = isEn
                ? `${activeModel} is analyzing the match...`
                : `${activeModel} 正在分析牌局中...`;
        }

        const titleEl = document.getElementById('ai-review-title');
        if (titleEl) {
            titleEl.textContent = isEn
                ? `${activeModel} Match Review`
                : `${activeModel} 牌局復盤`;
        }

        const reviewLlmModelInput = document.getElementById('review-llm-model');
        if (reviewLlmModelInput && !reviewLlmModelInput.value.trim()) {
            reviewLlmModelInput.placeholder = isEn
                ? `Auto-detected: ${activeModel}`
                : `自動選擇：${activeModel}`;
        }

        this.chatHistory = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        let content = '';
        let useWebGPU = this.reviewUseWebGPU;
        let actualModel = activeModel && activeModel !== 'local-model' ? activeModel : '';
        
        if (useWebGPU) {
            try {
                const { WebLlmCacheManager } = await import('../services/WebLlmCacheManager.js');
                if (!actualModel) {
                    const fullyCached = await WebLlmCacheManager.getFullyCachedStandardModels();
                    if (fullyCached.length > 0) {
                        actualModel = fullyCached[0].id;
                        this.activeModel = actualModel;
                        if (typeof AppStorage !== 'undefined') {
                            AppStorage.setItem('reviewLlmModel', actualModel);
                        }
                    } else {
                        actualModel = 'gemma-2-2b-it-q4f16_1-MLC';
                    }
                }
                const f16Supported = await WebLlmCacheManager.checkF16Supported();
                let checkModelId = actualModel;
                if (!f16Supported && actualModel.includes('q4f16_1')) {
                    checkModelId = actualModel.replace('q4f16_1', 'q4f32_1');
                }
                const completion = await WebLlmCacheManager.getCacheCompletion(checkModelId);
                if (completion < 100) {
                    useWebGPU = false;
                }
            } catch (e) {
                useWebGPU = false;
            }
        }

        if (useWebGPU) {
            const { AiServiceFactory } = await import('../services/AiServiceFactory.js');
            
            this.webLlmService = AiServiceFactory.createService({
                useLocalWebGPU: true,
                modelId: actualModel,
                workerPath: './aiWorker.js',
                initProgressCallback: (progress) => {
                    const subEl = document.getElementById('ai-loading-submessage');
                    if (subEl) {
                        subEl.textContent = `${isEn ? 'Loading to GPU VRAM' : '載入顯示記憶體中'}: ${progress.percent}% (${progress.text})`;
                    }
                    const gpuProgressBar = document.getElementById('ai-loading-progress-bar');
                    if (gpuProgressBar) {
                        gpuProgressBar.style.width = `${progress.percent}%`;
                    }
                }
            });

            if (!this.webLlmService.isReady) {
                const subEl = document.getElementById('ai-loading-submessage');
                if (subEl) {
                    subEl.textContent = isEn ? 'Loading local WebGPU model...' : '正在載入本地 WebGPU 模型...';
                }
                await this.webLlmService.init();
            }

            const response = await this.webLlmService.engine.chat.completions.create({
                messages: this.chatHistory,
                temperature: 0.8,
                max_tokens: 4096,
                presence_penalty: 1.0,
                frequency_penalty: 1.0,
                stream: false
            });

            content = response.choices?.[0]?.message?.content || '';
        } else {
            const reqHeaders = { 'Content-Type': 'application/json' };
            if (this.apiKey) {
                reqHeaders['Authorization'] = `Bearer ${this.apiKey}`;
            }
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: reqHeaders,
                body: JSON.stringify({
                    model: activeModel,
                    messages: this.chatHistory,
                    temperature: 0.8,
                    max_tokens: 4096,
                    presence_penalty: 1.0,
                    frequency_penalty: 1.0
                }),
                signal
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            const data = await response.json();
            content = data.choices?.[0]?.message?.content || '';
        }

        AISummaryView.stopLoadingAnimation();

        if (content) {
            this.chatHistory.push({ role: 'assistant', content: content });

            let html = content
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            html = AISummaryView.parseRoastAndAnalysis(html);
            html = AISummaryView.parseBasicMarkdown(html, false);
            html = AISummaryView.applyFadeInEffects(html);

            if (AISummaryView.summaryContainer) {
                AISummaryView.summaryContainer.innerHTML = html;
            }
        } else {
            throw new Error('No content returned from LLM');
        }
    }

    async fetchLLMResponse(signal) {
        if (this.reviewUseWebGPU) {
            if (!this.webLlmService || !this.webLlmService.isReady) {
                throw new Error("WebLLM engine is not ready. Please wait.");
            }
            const response = await this.webLlmService.engine.chat.completions.create({
                messages: this.chatHistory,
                temperature: 0.8,
                max_tokens: 4096,
                presence_penalty: 1.0,
                frequency_penalty: 1.0,
                stream: false
            });
            return response.choices?.[0]?.message?.content || '';
        }

        const reqHeaders = { 'Content-Type': 'application/json' };
        if (this.apiKey) {
            reqHeaders['Authorization'] = `Bearer ${this.apiKey}`;
        }
        
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify({
                model: this.activeModel || 'local-model',
                messages: this.chatHistory,
                temperature: 0.8,
                max_tokens: 4096,
                presence_penalty: 1.0,
                frequency_penalty: 1.0
            }),
            signal
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }

    async handleUserQuestion() {
        if (!AISummaryView.questionInput) return;
        const question = AISummaryView.questionInput.value.trim();
        if (!question) return;

        AISummaryView.questionInput.value = '';

        if (this.currentAbortController) {
            this.currentAbortController.abort();
        }
        this.currentAbortController = new AbortController();
        const signal = this.currentAbortController.signal;

        const isEn = window.currentLang === 'en';
        const langGuideline = isEn 
            ? "\n(Please reply to this question strictly in English. Do not use Chinese.)" 
            : "\n（請嚴格使用繁體中文回答此問題，勿使用簡體中文或英文。）";
        this.chatHistory.push({ role: 'user', content: question + langGuideline });

        const escapedQuestion = question
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const userMsgHtml = `
            <div class="my-4 flex justify-end animate-fade-in">
                <div class="max-w-[85%] bg-violet-600/30 border border-violet-500/40 rounded-2xl rounded-tr-none px-3.5 py-2 text-slate-100 text-xs lg-game:text-sm shadow-sm flex flex-col gap-1">
                    <div class="text-[10px] text-violet-400 font-bold">${t('youName')}</div>
                    <div class="whitespace-pre-wrap">${escapedQuestion}</div>
                </div>
            </div>
        `;
        
        if (AISummaryView.summaryContainer) {
            const existingLoading = document.getElementById('ai-response-loading');
            if (existingLoading) existingLoading.remove();

            AISummaryView.summaryContainer.insertAdjacentHTML('beforeend', userMsgHtml);
            
            const loadingHtml = `
                <div id="ai-response-loading" class="my-4 flex justify-start animate-fade-in">
                    <div class="max-w-[85%] bg-slate-950/40 border border-slate-800 rounded-2xl rounded-tl-none px-3.5 py-2 text-slate-400 text-xs lg-game:text-sm flex items-center gap-2 shadow-sm">
                        <span class="animate-spin text-sm">⌛</span>
                        <span>${t('aiThinking')}</span>
                    </div>
                </div>
            `;
            AISummaryView.summaryContainer.insertAdjacentHTML('beforeend', loadingHtml);
            AISummaryView.scrollToBottom();
        }

        AISummaryView.setInputDisabledState(true);

        try {
            const responseContent = await this.fetchLLMResponse(signal);
            
            this.chatHistory.push({ role: 'assistant', content: responseContent });

            const loadingEl = document.getElementById('ai-response-loading');
            if (loadingEl) loadingEl.remove();

            let html = responseContent
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            html = AISummaryView.parseRoastAndAnalysis(html);
            html = AISummaryView.parseBasicMarkdown(html, false);
            html = AISummaryView.applyFadeInEffects(html);

            const displayName = this.activeModel || 'AI';

            const aiMsgHtml = `
                <div class="my-4 flex justify-start animate-fade-in">
                    <div class="max-w-[85%] bg-slate-950/40 border border-slate-800 rounded-2xl rounded-tl-none px-3.5 py-2 text-slate-200 text-xs lg-game:text-sm shadow-sm flex flex-col gap-1 w-full">
                        <div class="text-[10px] text-violet-400 font-bold">${displayName}</div>
                        <div class="prose prose-invert max-w-none text-slate-200 text-xs lg-game:text-sm leading-relaxed whitespace-pre-wrap">${html}</div>
                    </div>
                </div>
            `;

            if (AISummaryView.summaryContainer) {
                AISummaryView.summaryContainer.insertAdjacentHTML('beforeend', aiMsgHtml);
                AISummaryView.scrollToBottom();
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('[AI Summary] Question fetch aborted.');
                return;
            }
            console.error('[AI Summary] Question request failed:', err);
            
            const loadingEl = document.getElementById('ai-response-loading');
            if (loadingEl) loadingEl.remove();

            const errTitle = isEn ? 'Error' : '發問發生錯誤';
            const errMsgHtml = `
                <div class="my-4 flex justify-start animate-fade-in text-red-400 text-xs border border-red-950 bg-red-950/20 p-3 rounded-lg w-full">
                    ❌ ${errTitle}：${err.message || err}
                </div>
            `;
            if (AISummaryView.summaryContainer) {
                AISummaryView.summaryContainer.insertAdjacentHTML('beforeend', errMsgHtml);
                AISummaryView.scrollToBottom();
            }
        } finally {
            AISummaryView.setInputDisabledState(false);
        }
    }

    abortActiveAnalysis() {
        if (this.currentAbortController) {
            console.log('[AI Summary] Aborting active LM Studio generation.');
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
        AISummaryView.stopLoadingAnimation();
    }
}

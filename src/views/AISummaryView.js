export class AISummaryView {
    static init(system) {
        this.system = system;
        
        // Inject styles
        if (!document.getElementById('ai-summary-styles')) {
            const style = document.createElement('style');
            style.id = 'ai-summary-styles';
            style.textContent = `
                @keyframes paragraphFadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fade-in {
                    animation: paragraphFadeIn 0.4s ease-out forwards;
                }
                @keyframes loadingProgress {
                    from { width: 0%; }
                    to { width: 95%; }
                }
                #ai-loading-submessage {
                    transition: opacity 0.3s ease-in-out;
                }
            `;
            document.head.appendChild(style);
        }

        this.panel = document.getElementById('ai-review-panel');
        this.statsContainer = document.getElementById('ai-review-stats');
        this.summaryContainer = document.getElementById('ai-summary');
        this.scrollContainer = this.summaryContainer ? this.summaryContainer.closest('.overflow-y-auto') : null;
        this.askBtn = document.getElementById('ai-review-ask-btn');
        this.questionInput = document.getElementById('ai-review-question-input');
        this.indicator = document.getElementById('ai-connection-indicator');
        this.indicatorText = document.getElementById('ai-connection-text');
        this.corsModal = document.getElementById('ai-cors-modal');
        this.corsModalContent = document.getElementById('ai-cors-modal-content');
        this.corsRetryBtn = document.getElementById('ai-cors-retry-btn');

        window.addEventListener('resize', () => {
            if (!this.panel || this.panel.classList.contains('hidden')) return;

            const isCollapsed = this.panel.classList.contains('translate-x-full') || 
                                this.panel.classList.contains('translate-y-full') ||
                                this.panel.classList.contains('lg-game:translate-x-full') ||
                                this.panel.classList.contains('lg-game:translate-y-full');
            const isNarrow = document.body.classList.contains('mobile-layout') || document.documentElement.classList.contains('mobile-layout') || window.innerWidth < 900;
            if (isCollapsed) {
                if (isNarrow) {
                    this.panel.classList.remove('translate-x-full', 'lg-game:translate-x-full');
                    this.panel.classList.add('translate-y-full');
                } else {
                    this.panel.classList.remove('translate-y-full');
                    this.panel.classList.add('translate-x-full', 'lg-game:translate-x-full');
                }
                const iconEl = document.getElementById('ai-review-toggle-icon');
                if (iconEl) {
                    iconEl.textContent = isNarrow ? '▲' : '◀';
                }
            } else {
                const iconEl = document.getElementById('ai-review-toggle-icon');
                if (iconEl) {
                    iconEl.textContent = isNarrow ? '▼' : '▶';
                }
            }
        });
    }

    static showPanel() {
        if (!this.panel) return;
        this.panel.classList.remove('hidden');
        
        // Trigger reflow
        void this.panel.offsetWidth;
        
        this.panel.classList.remove(
            'translate-x-full', 
            'lg-game:translate-x-full', 
            'translate-y-full', 
            'lg-game:translate-y-full'
        );
        this.panel.classList.add(
            'translate-x-0', 
            'lg-game:translate-x-0', 
            'translate-y-0', 
            'lg-game:translate-y-0'
        );

        const iconEl = document.getElementById('ai-review-toggle-icon');
        if (iconEl) {
            const isNarrow = document.body.classList.contains('mobile-layout') || document.documentElement.classList.contains('mobile-layout') || window.innerWidth < 900;
            iconEl.textContent = isNarrow ? '▼' : '▶';
        }
    }

    static hidePanel(shouldHideCompletely = true) {
        if (!this.panel) return;
        
        this.panel.classList.remove(
            'translate-x-0', 
            'lg-game:translate-x-0', 
            'translate-y-0', 
            'lg-game:translate-y-0'
        );
        
        const isNarrow = document.body.classList.contains('mobile-layout') || document.documentElement.classList.contains('mobile-layout') || window.innerWidth < 900;
        if (isNarrow) {
            this.panel.classList.add('translate-y-full');
            this.panel.classList.add('lg-game:translate-x-full');
        } else {
            this.panel.classList.add('translate-x-full');
            this.panel.classList.add('lg-game:translate-x-full');
        }
        
        const iconEl = document.getElementById('ai-review-toggle-icon');
        if (iconEl) {
            iconEl.textContent = isNarrow ? '▲' : '◀';
        }
        
        if (shouldHideCompletely) {
            setTimeout(() => {
                if (
                    this.panel.classList.contains('translate-x-full') || 
                    this.panel.classList.contains('translate-y-full') ||
                    this.panel.classList.contains('lg-game:translate-x-full')
                ) {
                    this.panel.classList.add('hidden');
                }
            }, 500);
        }
    }

    static showCORSModal(provider, displayUrl) {
        if (!this.corsModal || !this.corsModalContent) return;
        
        const isEn = window.currentLang === 'en';
        const bodyEl = this.corsModal.querySelector('.p-5.space-y-4');
        
        if (bodyEl) {
            if (provider === 'Ollama') {
                if (isEn) {
                    bodyEl.innerHTML = `
                        <p>Unable to connect to local Ollama Service (<code class="bg-slate-950 px-1 py-0.5 rounded font-mono text-amber-400">${displayUrl}</code>). Please enable CORS by following these steps:</p>
                        <div class="space-y-3 bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                            <div class="flex gap-3">
                                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/60 flex items-center justify-center font-bold text-violet-300 text-xs">1</span>
                                <p>Set the environment variable <code class="bg-slate-950 px-1 py-0.5 rounded font-mono text-pink-500 font-bold">OLLAMA_ORIGINS=*</code> on your system.</p>
                            </div>
                            <div class="flex gap-3">
                                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/60 flex items-center justify-center font-bold text-violet-300 text-xs">2</span>
                                <p>On Windows, run <code class="bg-slate-950 px-1 py-0.5 rounded font-mono text-slate-100">setx OLLAMA_ORIGINS "*"</code> in Command Prompt.</p>
                            </div>
                            <div class="flex gap-3">
                                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/60 flex items-center justify-center font-bold text-violet-300 text-xs">3</span>
                                <p>Close and restart the Ollama application completely from the taskbar.</p>
                            </div>
                        </div>
                        <div class="text-amber-500/80 bg-amber-950/20 border border-amber-900/30 rounded-lg p-2.5 flex gap-2 text-xs">
                            <span>💡</span>
                            <span>Setting OLLAMA_ORIGINS enables the game web app to request tactical reviews from Ollama.</span>
                        </div>
                    `;
                } else {
                    bodyEl.innerHTML = `
                        <p>無法連線至本地運行的 Ollama 服務 (<code class="bg-slate-950 px-1 py-0.5 rounded font-mono text-amber-400">${displayUrl}</code>)。請依循以下步驟啟用 CORS 設定：</p>
                        <div class="space-y-3 bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                            <div class="flex gap-3">
                                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/60 flex items-center justify-center font-bold text-violet-300 text-xs">1</span>
                                <p>在您的系統環境變數中，新增/設定 <code class="bg-slate-950 px-1 py-0.5 rounded font-mono text-pink-500 font-bold">OLLAMA_ORIGINS=*</code>。</p>
                            </div>
                            <div class="flex gap-3">
                                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/60 flex items-center justify-center font-bold text-violet-300 text-xs">2</span>
                                <p>在 Windows 系統，可於 CMD 執行命令 <code class="bg-slate-950 px-1 py-0.5 rounded font-mono text-slate-100">setx OLLAMA_ORIGINS "*"</code>。</p>
                            </div>
                            <div class="flex gap-3">
                                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/60 flex items-center justify-center font-bold text-violet-300 text-xs">3</span>
                                <p>完全退出 Ollama（自系統工作列右下角圖示按右鍵 Quit），然後重新啟動 Ollama。</p>
                            </div>
                        </div>
                        <div class="text-amber-500/80 bg-amber-950/20 border border-amber-900/30 rounded-lg p-2.5 flex gap-2 text-xs">
                            <span>💡</span>
                            <span>設定環境變數即可允許遊戲網頁安全地向本地 Ollama 服務發送復盤請求。</span>
                        </div>
                    `;
                }
            } else if (provider === 'LM Studio') {
                if (isEn) {
                    bodyEl.innerHTML = `
                        <p>Unable to connect to local running LM Studio (<code class="bg-slate-950 px-1 py-0.5 rounded font-mono text-amber-400">${displayUrl}</code>). Please follow these steps to enable CORS:</p>
                        <div class="space-y-3 bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                            <div class="flex gap-3">
                                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/60 flex items-center justify-center font-bold text-violet-300 text-xs">1</span>
                                <p>Launch your <strong class="text-slate-100">LM Studio</strong> software.</p>
                            </div>
                            <div class="flex gap-3">
                                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/60 flex items-center justify-center font-bold text-violet-300 text-xs">2</span>
                                <p>Switch to the <strong class="text-slate-100">Local Server</strong> tab on the sidebar.</p>
                            </div>
                            <div class="flex gap-3">
                                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/60 flex items-center justify-center font-bold text-violet-300 text-xs">3</span>
                                <p>Find the <strong class="text-slate-100">CORS</strong> setting under Server Policies.</p>
                            </div>
                            <div class="flex gap-3">
                                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/60 flex items-center justify-center font-bold text-violet-300 text-xs">4</span>
                                <p>Toggle the <strong class="text-slate-100">CORS</strong> setting to <strong class="text-pink-500 font-bold">ON</strong>.</p>
                            </div>
                        </div>
                        <div class="text-amber-500/80 bg-amber-950/20 border border-amber-900/30 rounded-lg p-2.5 flex gap-2 text-xs">
                            <span>💡</span>
                            <span>Enabling CORS allows the game to query the local model safely from the browser/app.</span>
                        </div>
                    `;
                } else {
                    bodyEl.innerHTML = `
                        <p>無法連線至本地運行的 LM Studio (<code class="bg-slate-950 px-1 py-0.5 rounded font-mono text-amber-400">${displayUrl}</code>)。請依循以下步驟啟用 CORS 設定：</p>
                        <div class="space-y-3 bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                            <div class="flex gap-3">
                                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/60 flex items-center justify-center font-bold text-violet-300 text-xs">1</span>
                                <p>啟動您的 <strong class="text-slate-100">LM Studio</strong> 軟體。</p>
                            </div>
                            <div class="flex gap-3">
                                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/60 flex items-center justify-center font-bold text-violet-300 text-xs">2</span>
                                <p>切換至 <strong class="text-slate-100">Local Server</strong> (開發者/伺服器) 分頁。</p>
                            </div>
                            <div class="flex gap-3">
                                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/60 flex items-center justify-center font-bold text-violet-300 text-xs">3</span>
                                <p>在設定中找到 <strong class="text-slate-100">CORS</strong> 選項。</p>
                            </div>
                            <div class="flex gap-3">
                                <span class="flex-shrink-0 w-5 h-5 rounded-full bg-violet-900/50 border border-violet-700/60 flex items-center justify-center font-bold text-violet-300 text-xs">4</span>
                                <p>將 <strong class="text-slate-100">CORS</strong> 切換為 <strong class="text-pink-500 font-bold">ON (開啟)</strong> 狀態。</p>
                            </div>
                        </div>
                        <div class="text-amber-500/80 bg-amber-950/20 border border-amber-900/30 rounded-lg p-2.5 flex gap-2 text-xs">
                            <span>💡</span>
                            <span>啟用 CORS 可允許遊戲網頁安全地向本地模型發送復盤請求。</span>
                        </div>
                    `;
                }
            } else {
                if (isEn) {
                    bodyEl.innerHTML = `
                        <p>Unable to connect to local running LLM Service (<code class="bg-slate-950 px-1 py-0.5 rounded font-mono text-amber-400">${displayUrl}</code>).</p>
                        <div class="space-y-3 bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                            <div class="flex gap-3">
                                <span>1️⃣</span>
                                <p>Make sure the local service is running and listening on the specified port.</p>
                            </div>
                            <div class="flex gap-3">
                                <span>2️⃣</span>
                                <p>Verify that your LLM provider allows incoming CORS requests from local origins.</p>
                            </div>
                        </div>
                    `;
                } else {
                    bodyEl.innerHTML = `
                        <p>無法連線至本地運行的 LLM 服務 (<code class="bg-slate-950 px-1 py-0.5 rounded font-mono text-amber-400">${displayUrl}</code>)。</p>
                        <div class="space-y-3 bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                            <div class="flex gap-3">
                                <span>1️⃣</span>
                                <p>請確認本地 LLM 服務是否正常啟動，且連接端點埠號正確。</p>
                            </div>
                            <div class="flex gap-3">
                                <span>2️⃣</span>
                                <p>請確認該 LLM 服務已允許來自本機網頁 (Local Origin) 的 CORS 請求。</p>
                            </div>
                        </div>
                    `;
                }
            }
        }

        if (this.corsRetryBtn) {
            this.corsRetryBtn.textContent = t('retryConnection');
        }

        this.corsModal.classList.remove('hidden');
        void this.corsModal.offsetWidth;
        this.corsModalContent.classList.remove('scale-95', 'opacity-0');
        this.corsModalContent.classList.add('scale-100', 'opacity-100');
    }

    static hideCORSModal() {
        if (!this.corsModal || !this.corsModalContent) return;
        this.corsModalContent.classList.remove('scale-100', 'opacity-100');
        this.corsModalContent.classList.add('scale-95', 'opacity-0');
        
        setTimeout(() => {
            this.corsModal.classList.add('hidden');
        }, 200);
    }

    static updateConnectionStatus(status, provider) {
        if (!this.indicator || !this.indicatorText) return;
        
        if (status === 'checking') {
            this.indicator.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse';
            this.indicatorText.textContent = t('testingConnection');
            this.indicatorText.className = 'text-xs text-amber-400 font-medium';
        } else if (status === 'connected') {
            this.indicator.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50';
            if (provider === 'WebLLM') {
                this.indicatorText.textContent = t('builtInAiEngineEnabled');
            } else {
                this.indicatorText.textContent = t('providerConnected', { provider });
            }
            this.indicatorText.className = 'text-xs text-emerald-400 font-medium';
        } else {
            this.indicator.className = 'w-2.5 h-2.5 rounded-full bg-red-500 shadow-md shadow-red-500/50';
            this.indicatorText.textContent = t('connectionFailedLabel');
            this.indicatorText.className = 'text-xs text-red-400 font-medium';
        }
    }

    static renderStats(gameState, winnerIndex) {
        if (!this.statsContainer) return;
        this.statsContainer.innerHTML = '';

        const isEn = window.currentLang === 'en';
        const playerNames = window.PLAYER_NAMES || (isEn ? ["You", "Alex", "Bella", "Chris"] : ["你", "艾力克斯", "貝拉", "克里斯"]);

        const roundScores = [0, 0, 0, 0];
        const isDragon = gameState.players.some(hand => {
            const info = typeof GameLogic !== 'undefined' ? GameLogic.getHandInfo(hand) : null;
            return info && info.type === 'DRAGON';
        }) || (gameState.gameLog && gameState.gameLog.length === 0);

        if (isDragon) {
            let totalGained = 0;
            for (let i = 0; i < 4; i++) {
                if (i === winnerIndex) continue;
                const lost = 13 * 2;
                roundScores[i] = -lost;
                totalGained += lost;
            }
            roundScores[winnerIndex] = totalGained;
        } else {
            let winnerMult = 1;
            if (gameState.lastPlay) {
                const info = typeof GameLogic !== 'undefined' ? GameLogic.getHandInfo(gameState.lastPlay) : null;
                const has2 = gameState.lastPlay.some(c => (typeof GameLogic !== 'undefined' ? GameLogic.getRank(c) : (c % 13)) === 12);
                
                if (info) {
                    if (info.type === 'FOUR_OF_A_KIND') {
                        winnerMult = has2 ? 4 : 2;
                    } else if (info.type === 'STRAIGHT_FLUSH') {
                        winnerMult = (info.special === '23456') ? 4 : 2;
                    } else if (has2) {
                        winnerMult = 2;
                    }
                }
            }

            let totalGained = 0;
            for (let i = 0; i < 4; i++) {
                if (i === winnerIndex) continue;

                let hand = gameState.players[i];
                let baseLost = hand.length;
                let loserMult = 1;

                if (baseLost >= 10) loserMult *= 2;

                const twosCount = hand.filter(c => (typeof GameLogic !== 'undefined' ? GameLogic.getRank(c) : (c % 13)) === 12).length;
                loserMult *= Math.pow(2, twosCount);

                const fkCount = typeof GameLogic !== 'undefined' ? GameLogic.countFourOfAKinds(hand) : 0;
                loserMult *= Math.pow(2, fkCount);

                const sfCount = typeof GameLogic !== 'undefined' ? GameLogic.countStraightFlushes(hand) : 0;
                loserMult *= Math.pow(2, sfCount);

                const finalLost = baseLost * winnerMult * loserMult;
                roundScores[i] = -finalLost;
                totalGained += finalLost;
            }
            roundScores[winnerIndex] = totalGained;
        }

        gameState.players.forEach((hand, idx) => {
            const name = playerNames[idx];
            const remainingCount = hand.length;
            const isWinner = idx === winnerIndex;
            const isHomeRun = remainingCount === 13;
            const roundScore = roundScores[idx];

            const cardDiv = document.createElement('div');
            
            let cardClasses = 'bg-slate-900 border rounded-lg p-2.5 flex flex-col justify-between transition ';
            if (isWinner) {
                cardClasses += 'border-emerald-500/50 bg-emerald-950/10 shadow-sm shadow-emerald-950/30';
            } else if (isHomeRun) {
                cardClasses += 'border-rose-500/50 bg-rose-950/10 shadow-sm shadow-rose-950/30';
            } else {
                cardClasses += 'border-slate-800 bg-slate-950/20';
            }
            cardDiv.className = cardClasses;

            let avatarImgSrc = 'src/assets/avatars/avatar_you.png';
            if (idx === 1) avatarImgSrc = 'src/assets/avatars/avatar_alex.png';
            if (idx === 2) avatarImgSrc = 'src/assets/avatars/avatar_bella.png';
            if (idx === 3) {
                const p4 = document.getElementById('player-4');
                const p4Img = p4 ? p4.querySelector('.avatar img') : null;
                avatarImgSrc = p4Img ? p4Img.getAttribute('src') : 'src/assets/avatars/avatar_diana.png';
            }

            const winText = t('winnerLabel');
            const leftText = t('cardsLeft', { count: remainingCount });
            const hrBadge = t('homeRunLabel');

            let cardsHtml = '';
            if (!isWinner && remainingCount > 0) {
                const sortedHand = [...hand].sort((a, b) => a - b);
                const rankLabels = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
                const suitSymbols = ['♣', '♦', '♥', '♠'];
                
                cardsHtml = `
                    <div class="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1">
                        ${sortedHand.map(cardId => {
                            const rankIdx = typeof GameLogic !== 'undefined' ? GameLogic.getRank(cardId) : (cardId % 13);
                            const suitIdx = typeof GameLogic !== 'undefined' ? GameLogic.getSuit(cardId) : Math.floor(cardId / 13);
                            const isRed = suitIdx === 1 || suitIdx === 2;
                            const colorClass = isRed ? 'text-rose-400 border-rose-950/40 bg-rose-950/20' : 'text-slate-300 border-slate-800/50 bg-slate-950/40';
                            
                            return `
                                <div class="inline-flex flex-col items-center justify-center w-6 h-8 border rounded font-mono text-[10px] font-bold ${colorClass}">
                                    <span>${rankLabels[rankIdx]}</span>
                                    <span class="text-[9px] -mt-1">${suitSymbols[suitIdx]}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }

            cardDiv.innerHTML = `
                <div class="flex items-center gap-2 justify-between w-full">
                    <div class="flex items-center gap-2 truncate flex-1">
                        <div class="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            <img src="${avatarImgSrc}" class="w-full h-full object-cover">
                        </div>
                        <div class="truncate">
                            <div class="font-bold text-slate-200 truncate">${name}</div>
                            <div class="text-[10px] text-slate-400">${isWinner ? winText : leftText}</div>
                        </div>
                    </div>
                    <div class="text-right pl-2 flex-shrink-0">
                        <div class="text-xs font-mono font-extrabold ${roundScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                            ${roundScore >= 0 ? `+${roundScore}` : roundScore}
                        </div>
                    </div>
                </div>
                <div class="mt-2 flex items-center justify-between">
                    ${isWinner ? `<span class="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-[9px] font-extrabold">${t('winnerBadge')}</span>` : ''}
                    ${isHomeRun ? `<span class="px-1.5 py-0.5 rounded bg-rose-950 border border-rose-500/40 text-rose-400 text-[9px] font-extrabold animate-pulse">${hrBadge}</span>` : ''}
                </div>
                ${cardsHtml}
            `;
            this.statsContainer.appendChild(cardDiv);
        });
    }

    static startLoadingAnimation(modelName) {
        this.stopLoadingAnimation();

        const isEn = window.currentLang === 'en';
        this.loadingMessagesEn = [
            "AI is carefully studying your brilliant card placement...",
            "AI is identifying key highlights of your strategies...",
            "AI is drafting professional suggestions to level up your game...",
            "AI is analyzing the math to find your next winning move...",
            "AI is looking for outstanding plays in this round...",
            "AI is preparing a tactical summary to optimize your next win..."
        ];
        this.loadingMessagesZh = [
            "AI 正在認真分析您精彩的出牌策略...",
            "AI 正在整理本局的戰術亮點與精彩瞬間...",
            "AI 正在為您量身打造專業的進階戰術建議...",
            "AI 正在分析數據，尋找您下一次獲勝的關鍵出牌點...",
            "AI 正在記錄您本局的優秀操作...",
            "AI 正在為您的下一場勝利做戰術複盤準備..."
        ];

        this.currentLoadingIndex = Math.floor(Math.random() * this.loadingMessagesEn.length);
        const getNextMessage = () => {
            const currentIsEn = window.currentLang === 'en';
            const messages = currentIsEn ? this.loadingMessagesEn : this.loadingMessagesZh;
            const msg = messages[this.currentLoadingIndex];
            this.currentLoadingIndex = (this.currentLoadingIndex + 1) % messages.length;
            return msg;
        };

        const progressTitle = t('modelAnalyzingMatch', { model: modelName });
        const progressSub = getNextMessage();

        this.summaryContainer.innerHTML = `
            <div class="space-y-2 py-3 px-3 text-center flex flex-col items-center justify-center">
                <div class="text-xs font-bold text-violet-400 animate-pulse mb-1" id="ai-loading-message">${progressTitle}</div>
                <div id="ai-loading-progress-container" class="w-full max-w-[200px]" style="height: 4px; border-radius: 2px; overflow: hidden; background: #334155; margin: 4px auto;">
                    <div id="ai-loading-progress-bar" style="width: 0%; height: 100%; background: #8b5cf6; transition: width 0.2s ease;"></div>
                </div>
                <div class="text-xs text-slate-500 mt-1" id="ai-loading-submessage" style="opacity: 1">${progressSub}</div>
            </div>
        `;

        this.loadingInterval = setInterval(() => {
            const subEl = document.getElementById('ai-loading-submessage');
            if (subEl) {
                subEl.style.opacity = '0';
                setTimeout(() => {
                    subEl.textContent = getNextMessage();
                    subEl.style.opacity = '1';
                }, 300);
            }
        }, 4500);
    }

    static stopLoadingAnimation() {
        if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
            this.loadingInterval = null;
        }
    }

    static setInputDisabledState(disabled) {
        if (this.questionInput) {
            this.questionInput.disabled = disabled;
            if (disabled) {
                this.questionInput.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                this.questionInput.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
        if (this.askBtn) {
            this.askBtn.disabled = disabled;
            if (disabled) {
                this.askBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                this.askBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    }

    static scrollToBottom() {
        if (this.scrollContainer) {
            this.scrollContainer.scrollTo({
                top: this.scrollContainer.scrollHeight,
                behavior: 'smooth'
            });
        }
    }

    static parseRoastAndAnalysis(text) {
        let html = text;
        html = html.replace(/^(\s*[-*]?\s*)\[(檢討|Review|嘲諷|Roast)\](.*)$/gim, '$1<span class="text-rose-400 font-medium">[$2]$3</span>');
        html = html.replace(/^(\s*[-*]?\s*)\[(分析|Analysis)\](.*)$/gim, '$1<span class="text-slate-400">[$2]$3</span>');
        return html;
    }

    static applyFadeInEffects(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const children = Array.from(tempDiv.childNodes);
        let currentParagraph = null;

        children.forEach(node => {
            const isBlock = node.nodeType === Node.ELEMENT_NODE && 
                ['DIV', 'H1', 'H2', 'H3', 'LI', 'UL', 'OL', 'P'].includes(node.tagName);

            if (isBlock) {
                currentParagraph = null;
            } else {
                if (!currentParagraph) {
                    currentParagraph = document.createElement('div');
                    currentParagraph.className = 'my-2';
                    node.parentNode.insertBefore(currentParagraph, node);
                }
                currentParagraph.appendChild(node);
            }
        });

        const blockChildren = Array.from(tempDiv.children).filter(child => {
            return child.textContent.trim() !== '' || child.querySelector('img') || child.tagName === 'H3';
        });

        const count = blockChildren.length;
        blockChildren.forEach((child, i) => {
            child.classList.add('opacity-0', 'animate-fade-in');
            const delay = Math.round(i * Math.min(150, 600 / Math.max(1, count - 1)));
            child.style.animationDelay = `${delay}ms`;
        });

        return tempDiv.innerHTML;
    }

    static parseBasicMarkdown(text, escapeHtml = true) {
        let html = text;
        if (escapeHtml) {
            html = html
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        html = html.replace(/^### (.*$)/gim, '<h3 class="text-xs lg-game:text-sm font-bold text-violet-400 mt-4 mb-2 pb-1 border-b border-slate-800">$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2 class="text-sm lg-game:text-base font-bold text-violet-300 mt-5 mb-2">$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1 class="text-base lg-game:text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 mt-6 mb-3">$1</h1>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-fuchsia-300 font-bold">$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em class="text-slate-300 italic">$1</em>');
        html = html.replace(/`(.*?)`/g, '<code class="bg-slate-950 text-pink-300 px-1 py-0.5 rounded font-mono text-[11px]">$1</code>');
        html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-4 list-disc text-slate-300 my-1 font-sans text-xs lg-game:text-sm">$1</li>');
        html = html.replace(/\n/g, '<br>');

        return html;
    }
}

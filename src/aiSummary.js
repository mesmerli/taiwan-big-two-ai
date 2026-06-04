/**
 * Gemma-4-2b Streaming Post-game Review System
 * Native JavaScript (ES6+), framework-free, highly modular.
 */

class AISummarySystem {
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
        this.typingInterval = null;
        this.loadingInterval = null;
        
        // Typing effect states
        this.typingQueue = [];
        this.accumulatedText = '';
        this.streamFinished = false;
        
        // Cached gameState and winner
        this.lastGameState = null;
        this.lastWinnerIndex = -1;
        this.chatHistory = [];
        this.activeModel = '';
        this.lastConnectionStatus = null;

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        // Inject custom styles for fade-in and loading bar animations
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
        // DOM Elements
        this.panel = document.getElementById('ai-review-panel');
        this.closeBtn = document.getElementById('ai-review-close-btn');
        this.newGameBtn = document.getElementById('ai-review-newgame-btn');
        this.statsContainer = document.getElementById('ai-review-stats');
        this.summaryContainer = document.getElementById('ai-summary');
        this.scrollContainer = this.summaryContainer ? this.summaryContainer.closest('.overflow-y-auto') : null;
        
        // Q&A elements
        this.askBtn = document.getElementById('ai-review-ask-btn');
        this.questionInput = document.getElementById('ai-review-question-input');
        
        this.indicator = document.getElementById('ai-connection-indicator');
        this.indicatorText = document.getElementById('ai-connection-text');

        // CORS Modal Elements
        this.corsModal = document.getElementById('ai-cors-modal');
        this.corsModalContent = document.getElementById('ai-cors-modal-content');
        this.corsCloseBtn = document.getElementById('ai-cors-close-btn');
        this.corsRetryBtn = document.getElementById('ai-cors-retry-btn');

        if (!this.panel) return;

        // Setup Event Listeners
        this.closeBtn.onclick = () => this.hidePanel();
        
        this.toggleHandle = document.getElementById('ai-review-toggle-handle');
        if (this.toggleHandle) {
            this.toggleHandle.onclick = (e) => {
                e.stopPropagation();
                const isCollapsed = this.panel.classList.contains('translate-x-full') || this.panel.classList.contains('translate-y-full');
                if (isCollapsed) {
                    this.showPanel();
                } else {
                    this.hidePanel(false, false);
                }
            };
        }
        
        if (this.askBtn) {
            this.askBtn.onclick = () => this.handleUserQuestion();
        }
        if (this.questionInput) {
            this.questionInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleUserQuestion();
                }
            };
        }

        this.newGameBtn.onclick = () => {
            this.hidePanel();
            // Trigger New Game from main renderer
            const btnNew = document.getElementById('btn-new');
            if (btnNew) btnNew.click();
        };
        if (this.corsCloseBtn) {
            this.corsCloseBtn.onclick = () => this.hideCORSModal();
        }
        if (this.corsRetryBtn) {
            this.corsRetryBtn.onclick = async () => {
                this.hideCORSModal();
                // Always retry connection test to update the Settings tab UI
                await this.testConnectionAndPopulateModels();
                // If there is an ended game context, retry the post-game summary review
                if (this.lastGameState) {
                    this.showSummary(this.lastGameState, this.lastWinnerIndex);
                }
            };
        }
        // Bind Review LLM Guide Button
        const reviewLlmGuideBtn = document.getElementById('review-llm-guide-btn');
        if (reviewLlmGuideBtn) {
            reviewLlmGuideBtn.onclick = () => {
                this.showCORSModal();
            };
        }
        // Bind Review Panel Enabled Switch
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

        // Bind Review Use WebGPU Switch
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
                this.handleReviewWebLlmPreload();
                this.loadCacheList();
            };
        }

        // Bind LLM URL Setting
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

        // Bind LLM API Key Setting
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

        // Bind LLM Model Setting
        const reviewLlmModelInput = document.getElementById('review-llm-model');
        if (reviewLlmModelInput) {
            reviewLlmModelInput.onchange = () => {
                const val = reviewLlmModelInput.value.trim();
                if (typeof AppStorage !== 'undefined') {
                    AppStorage.setItem('reviewLlmModel', val);
                }
                this.handleReviewWebLlmPreload();
                this.loadCacheList();
            };
        }

        // Test connection when settings tab is clicked
        const aiSettingsTabBtn = document.querySelector('.tab-btn[data-tab="ai-settings"]');
        if (aiSettingsTabBtn) {
            aiSettingsTabBtn.addEventListener('click', () => {
                this.testConnectionAndPopulateModels();
                this.loadCacheList();
            });
        }

        // Refresh cache list when manage tab is clicked
        const manageTabBtn = document.querySelector('.tab-btn[data-tab="manage"]');
        if (manageTabBtn) {
            manageTabBtn.addEventListener('click', () => {
                this.loadCacheList();
            });
        }

        // Dynamically adjust collapse classes and icon on window resize
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

        // Initial preload and cache check
        this.handleReviewWebLlmPreload();
        this.loadCacheList();

        console.log('[AI Summary] System initialized.');
    }

    updateLanguage() {
        this.testConnectionAndPopulateModels();
        this.loadCacheList();
    }

    async testConnectionAndPopulateModels() {
        const statusEl = document.getElementById('review-llm-connection-status');
        const modelList = document.getElementById('review-llm-model'); // The select element itself
        const isEn = window.currentLang === 'en';

        const savedModelId = typeof AppStorage !== 'undefined' ? (AppStorage.getItem('reviewLlmModel') || '') : '';

        if (modelList) {
            modelList.innerHTML = '';
        }

        if (this.reviewUseWebGPU) {
            if (statusEl) {
                statusEl.textContent = isEn ? '● Local WebGPU Active' : '● 本地 WebGPU 已啟用';
                statusEl.style.color = '#10b981'; // emerald
            }

            if (modelList) {
                const { WebLlmCacheManager } = await import('./services/WebLlmCacheManager.js');
                const localModels = WebLlmCacheManager.MODELS;

                localModels.forEach(m => {
                    const option = document.createElement('option');
                    option.value = m.id;
                    option.textContent = m.name;
                    modelList.appendChild(option);
                });

                if (savedModelId && !localModels.some(m => m.id === savedModelId)) {
                    const customOption = document.createElement('option');
                    customOption.value = savedModelId;
                    customOption.textContent = savedModelId;
                    modelList.appendChild(customOption);
                }

                modelList.value = savedModelId || 'gemma-2-2b-it-q4f16_1-MLC';
            }
            this.retrySummary();
            return;
        }

        // Cancel any in-flight request to prevent concurrent population of the select options
        if (this._modelFetchController) {
            this._modelFetchController.abort();
        }
        this._modelFetchController = new AbortController();
        const controller = this._modelFetchController;

        if (modelList) {
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = isEn ? 'Auto-detect' : '自動選擇';
            modelList.appendChild(defaultOption);
        }

        if (statusEl) {
            statusEl.textContent = isEn ? '● Testing...' : '● 正在測試連線...';
            statusEl.style.color = '#f59e0b'; // amber
        }

        try {
            const urlObj = new URL(this.apiUrl);
            const modelsUrl = `${urlObj.protocol}//${urlObj.host}/v1/models`;

            const id = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout

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
                    statusEl.textContent = isEn ? '● Connected' : '● 連線成功';
                    statusEl.style.color = '#10b981'; // emerald
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
                statusEl.textContent = isEn ? '● Connection Failed' : '● 連線失敗';
                statusEl.style.color = '#ef4444'; // red
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

    async handleReviewWebLlmPreload() {
        const enabled = this.reviewUseWebGPU;
        const container = document.getElementById('review-webgpu-progress-container');
        const modelList = document.getElementById('review-llm-model');
        const modelId = modelList ? modelList.value : '';
        const isEn = window.currentLang === 'en';

        if (!enabled || !modelId) {
            if (container) container.classList.add('hidden');
            if (this.reviewPreloader) {
                this.reviewPreloader.stopLoading();
                this.reviewPreloader = null;
            }
            return;
        }

        const { WebLlmCacheManager } = await import('./services/WebLlmCacheManager.js');
        const cached = await WebLlmCacheManager.listCachedModels();
        const isCached = cached.some(name => name.includes(modelId));
        
        if (isCached) {
            if (container) container.classList.add('hidden');
            if (this.reviewPreloader && this.reviewPreloader.isInitializing) {
                this.reviewPreloader.stopLoading();
                this.reviewPreloader = null;
            }
            return;
        }

        if (typeof window.isNpcPreloaderActive === 'function' && window.isNpcPreloaderActive()) {
            const alertMsg = isEn ? 'Another model (NPC Player) is downloading. Please wait or pause it first.' : '有其他模型（NPC 玩家）正在下載中，請先等待下載完成或暫停該下載。';
            alert(alertMsg);
            const reviewUseWebGpuCheckbox = document.getElementById('review-use-webgpu');
            if (reviewUseWebGpuCheckbox) reviewUseWebGpuCheckbox.checked = false;
            this.reviewUseWebGPU = false;
            AppStorage.setItem('reviewUseWebGPU', 'false');
            if (container) container.classList.add('hidden');
            return;
        }

        // Open the rules-modal and select the Manage tab programmatically
        const rModal = document.getElementById('rules-modal');
        if (rModal) {
            rModal.classList.remove('hidden');
            const manageTabBtn = rModal.querySelector('.tab-btn[data-tab="manage"]');
            if (manageTabBtn) {
                manageTabBtn.click();
            }
        }

        if (container) container.classList.remove('hidden');
        const progressText = document.getElementById('review-webgpu-progress-text');
        const progressPercent = document.getElementById('review-webgpu-progress-percent');
        const progressBar = document.getElementById('review-webgpu-progress-bar');
        const btnPause = document.getElementById('review-webgpu-btn-pause');
        const btnStop = document.getElementById('review-webgpu-btn-stop');

        if (progressText) progressText.textContent = isEn ? 'Preloading Model...' : '正在預載入模型...';
        if (progressPercent) progressPercent.textContent = '0%';
        if (progressBar) progressBar.style.width = '0%';

        const { AiServiceFactory } = await import('./services/AiServiceFactory.js');
        this.reviewPreloader = AiServiceFactory.createService({
            useLocalWebGPU: true,
            modelId: modelId,
            workerPath: '../aiWorker.js',
            initProgressCallback: (progress) => {
                if (progressText) progressText.textContent = progress.text;
                if (progressPercent) progressPercent.textContent = `${progress.percent}%`;
                if (progressBar) progressBar.style.width = `${progress.percent}%`;

                if (progress.percent === 100) {
                    setTimeout(() => {
                        if (container) container.classList.add('hidden');
                        this.loadCacheList();
                        if (typeof window.loadNpcCacheList === 'function') {
                            window.loadNpcCacheList();
                        }
                    }, 1500);
                }
            }
        });

        const t = (key) => {
            if (typeof window.t === 'function') return window.t(key);
            return isEn ? key : (key === 'pause' ? '暫停' : (key === 'resume' ? '繼續' : '停止'));
        };

        if (btnPause) {
            btnPause.textContent = t('pause');
            btnPause.onclick = () => {
                if (this.reviewPreloader.isPaused) {
                    btnPause.textContent = t('pause');
                    this.reviewPreloader.init();
                } else {
                    btnPause.textContent = t('resume');
                    this.reviewPreloader.pauseLoading();
                }
            };
        }

        if (btnStop) {
            btnStop.onclick = () => {
                if (this.reviewPreloader) {
                    this.reviewPreloader.stopLoading();
                }
                if (container) container.classList.add('hidden');
            };
        }

        this.reviewPreloader.init();
    }

    async loadCacheList() {
        const enabled = this.reviewUseWebGPU;
        const container = document.getElementById('review-cache-container');
        const listEl = document.getElementById('review-cache-list');
        const isEn = window.currentLang === 'en' || (typeof currentLang !== 'undefined' && currentLang === 'en');

        if (!container || !listEl) return;

        container.classList.remove('hidden');
        listEl.innerHTML = `<div style="font-style: italic;">${isEn ? 'Loading cache list...' : '正在載入快取列表...'}</div>`;

        // Check if f16 is supported on GPU
        if (this.f16Supported === undefined) {
            this.f16Supported = true;
            if (typeof navigator !== 'undefined' && navigator.gpu) {
                try {
                    const adapter = await navigator.gpu.requestAdapter();
                    this.f16Supported = adapter ? adapter.features.has('shader-f16') : false;
                } catch (e) {
                    this.f16Supported = false;
                }
            } else {
                this.f16Supported = false;
            }
        }

        const { WebLlmCacheManager } = await import('./services/WebLlmCacheManager.js');
        const cachesList = await WebLlmCacheManager.listCachedModels();

        listEl.innerHTML = '';
        for (const model of WebLlmCacheManager.MODELS) {
            const isF16 = model.id.includes('q4f16_1');
            const hasF32Fallback = isF16; // All f16 models in our list have a matching f32 equivalent in MLC
            const isSupported = !isF16 || this.f16Supported;
            
            // If the GPU doesn't support f16, dynamically query the f32 variant cache instead
            const queryModelId = (!isSupported && hasF32Fallback) ? model.id.replace('q4f16_1', 'q4f32_1') : model.id;
            const isCached = cachesList.some(c => c.toLowerCase() === queryModelId.toLowerCase());

            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 6px 8px; border-radius: 4px;';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = model.name;
            if (!isSupported) {
                if (hasF32Fallback) {
                    nameSpan.textContent += isEn ? ' (Using f32 Compatibility)' : ' (自動轉為 f32 相容版)';
                } else {
                    nameSpan.textContent += isEn ? ' (Unsupported GPU)' : ' (顯卡不支援)';
                    nameSpan.style.color = '#ef4444';
                }
            }
            nameSpan.style.cssText += ' font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px;';

            const rightDiv = document.createElement('div');
            rightDiv.style.cssText = 'display: flex; gap: 8px; align-items: center;';

            if (isCached) {
                const sizeSpan = document.createElement('span');
                sizeSpan.style.cssText = 'color: #64748b; font-size: 10px;';
                sizeSpan.textContent = '...';

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '🗑️';
                deleteBtn.style.cssText = 'background: none; border: none; cursor: pointer; font-size: 12px; padding: 2px;';
                deleteBtn.onclick = async () => {
                    const confirmMsg = !isEn ? `確定要刪除 ${model.name} 的快取以釋放空間嗎？` : `Are you sure you want to delete ${model.name} to free up space?`;
                    if (confirm(confirmMsg)) {
                        await WebLlmCacheManager.deleteCachedModel(queryModelId);
                        this.loadCacheList();
                        if (typeof window.loadNpcCacheList === 'function') {
                            window.loadNpcCacheList();
                        }
                    }
                };

                rightDiv.appendChild(sizeSpan);
                rightDiv.appendChild(deleteBtn);

                Promise.all([
                    WebLlmCacheManager.getCacheCompletion(queryModelId),
                    WebLlmCacheManager.getCacheSize(queryModelId)
                ]).then(([completion, size]) => {
                    const pctText = isEn ? `${completion}% downloaded` : `已下載 ${completion}%`;
                    sizeSpan.textContent = `${pctText} (${size})`;
                });
            } else {
                const downloadBtn = document.createElement('button');
                if (!isSupported && !hasF32Fallback) {
                    downloadBtn.textContent = isEn ? 'Unsupported' : '不支援';
                    downloadBtn.disabled = true;
                    downloadBtn.style.cssText = 'background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 4px; font-size: 10px; color: #f87171; padding: 2px 8px; cursor: not-allowed;';
                } else {
                    downloadBtn.textContent = isEn ? '📥 Download' : '📥 下載';
                    if (!isSupported && hasF32Fallback) {
                        downloadBtn.textContent = isEn ? '📥 Download f32' : '📥 下載 f32';
                    }
                    downloadBtn.style.cssText = 'background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 4px; cursor: pointer; font-size: 10px; color: #a78bfa; padding: 2px 8px; transition: all 0.2s;';
                    downloadBtn.onmouseover = () => {
                        downloadBtn.style.background = 'rgba(139, 92, 246, 0.4)';
                    };
                    downloadBtn.onmouseout = () => {
                        downloadBtn.style.background = 'rgba(139, 92, 246, 0.2)';
                    };
                    downloadBtn.onclick = () => {
                        this.startDownload(model.id);
                    };
                }
                rightDiv.appendChild(downloadBtn);
            }

            itemDiv.appendChild(nameSpan);
            itemDiv.appendChild(rightDiv);
            listEl.appendChild(itemDiv);
        }
    }

    async startDownload(modelId) {
        const isEn = window.currentLang === 'en';
        const container = document.getElementById('review-webgpu-progress-container');
        
        if (typeof window.isNpcPreloaderActive === 'function' && window.isNpcPreloaderActive()) {
            const alertMsg = isEn ? 'Another model (NPC Player) is downloading. Please wait or pause it first.' : '有其他模型（NPC 玩家）正在下載中，請先等待下載完成或暫停該下載。';
            alert(alertMsg);
            return;
        }

        // Apply fallback redirection inside startDownload if GPU doesn't support shader-f16
        let targetModelId = modelId;
        if (modelId.includes('q4f16_1') && this.f16Supported === false) {
            const hasF32Fallback = true; // All f16 models listed have f32 variants available
            if (hasF32Fallback) {
                const msg = isEn 
                    ? "Your GPU/browser does not support f16 precision. The system will automatically download and register the compatible f32 version instead."
                    : "您的顯卡或瀏覽器不支援 f16 精度。系統將自動改為下載並註冊相容的 f32 版本。";
                alert(msg);
                targetModelId = modelId.replace('q4f16_1', 'q4f32_1');
            } else {
                const msg = isEn
                    ? "Your GPU/browser does not support f16 precision, and this model does not have an f32 fallback. It cannot be run on this device."
                    : "您的顯卡或瀏覽器不支援 f16 精度，且此模型沒有 f32 版本，無法在您的裝置上運行。";
                alert(msg);
                return;
            }
        }

        if (container) container.classList.remove('hidden');
        const progressText = document.getElementById('review-webgpu-progress-text');
        const progressPercent = document.getElementById('review-webgpu-progress-percent');
        const progressBar = document.getElementById('review-webgpu-progress-bar');
        const btnPause = document.getElementById('review-webgpu-btn-pause');
        const btnStop = document.getElementById('review-webgpu-btn-stop');

        if (progressText) progressText.textContent = isEn ? `Downloading Model...` : `正在下載模型...`;
        if (progressPercent) progressPercent.textContent = '0%';
        if (progressBar) progressBar.style.width = '0%';

        const { AiServiceFactory } = await import('./services/AiServiceFactory.js');
        
        if (this.reviewPreloader && this.reviewPreloader.isInitializing) {
            this.reviewPreloader.stopLoading();
        }

        this.reviewPreloader = AiServiceFactory.createService({
            useLocalWebGPU: true,
            modelId: targetModelId,
            workerPath: '../aiWorker.js',
            initProgressCallback: (progress) => {
                if (progressText) progressText.textContent = progress.text;
                if (progressPercent) progressPercent.textContent = `${progress.percent}%`;
                if (progressBar) progressBar.style.width = `${progress.percent}%`;

                // 定期更新管理面板的模型下載進度與已下載位元組
                const now = Date.now();
                if (!this._lastDownloadRefresh || now - this._lastDownloadRefresh > 1000) {
                    this.loadCacheList();
                    this._lastDownloadRefresh = now;
                }

                if (progress.percent === 100) {
                    setTimeout(() => {
                        if (container) container.classList.add('hidden');
                        this.loadCacheList();
                        if (typeof window.loadNpcCacheList === 'function') {
                            window.loadNpcCacheList();
                        }
                    }, 1500);
                }
            }
        });

        const t = (key) => {
            if (typeof window.t === 'function') return window.t(key);
            return isEn ? key : (key === 'pause' ? '暫停' : (key === 'resume' ? '繼續' : '停止'));
        };

        if (btnPause) {
            btnPause.textContent = t('pause');
            btnPause.onclick = () => {
                if (this.reviewPreloader.isPaused) {
                    btnPause.textContent = t('pause');
                    this.reviewPreloader.init();
                } else {
                    btnPause.textContent = t('resume');
                    this.reviewPreloader.pauseLoading();
                }
            };
        }

        if (btnStop) {
            btnStop.onclick = () => {
                if (this.reviewPreloader) {
                    this.reviewPreloader.stopLoading();
                }
                if (container) container.classList.add('hidden');
            };
        }

        this.reviewPreloader.init();
    }

    showPanel() {
        if (!this.panel) return;
        this.panel.classList.remove('hidden');
        
        // Trigger reflow for transition
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

        // Update toggle arrow icon
        const iconEl = document.getElementById('ai-review-toggle-icon');
        if (iconEl) {
            const isNarrow = document.body.classList.contains('mobile-layout') || document.documentElement.classList.contains('mobile-layout') || window.innerWidth < 900;
            iconEl.textContent = isNarrow ? '▼' : '▶';
        }
    }
 
    hidePanel(shouldHideCompletely = true, shouldAbort = true) {
        if (!this.panel) return;
        
        // Reset slide classes
        this.panel.classList.remove(
            'translate-x-0', 
            'lg-game:translate-x-0', 
            'translate-y-0', 
            'lg-game:translate-y-0'
        );
        
        // Determine layout to apply the correct slide-out direction
        const isNarrow = document.body.classList.contains('mobile-layout') || document.documentElement.classList.contains('mobile-layout') || window.innerWidth < 900;
        if (isNarrow) {
            this.panel.classList.add('translate-y-full');
            this.panel.classList.add('lg-game:translate-x-full');
        } else {
            this.panel.classList.add('translate-x-full');
            this.panel.classList.add('lg-game:translate-x-full');
        }
        
        // Update toggle arrow icon
        const iconEl = document.getElementById('ai-review-toggle-icon');
        if (iconEl) {
            iconEl.textContent = isNarrow ? '▲' : '◀';
        }

        if (shouldHideCompletely) {
            // Wait for transitions to finish before adding hidden
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

        if (shouldAbort) {
            this.abortActiveAnalysis();
        }
    }

    // Explicitly abort active LLM generation stream and stop typing
    abortActiveAnalysis() {
        if (this.currentAbortController) {
            console.log('[AI Summary] Aborting active LM Studio generation.');
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
        this.stopLoadingAnimation();
        this.stopTyping();
        this.typingQueue = [];
        this.accumulatedText = '';
        this.streamFinished = false;
    }

    showCORSModal() {
        if (!this.corsModal || !this.corsModalContent) return;
        
        const isEn = window.currentLang === 'en';
        const bodyEl = this.corsModal.querySelector('.p-5.space-y-4');
        
        let displayUrl = 'http://127.0.0.1:1234';
        try {
            const urlObj = new URL(this.apiUrl);
            displayUrl = `${urlObj.protocol}//${urlObj.host}`;
        } catch (e) {
            displayUrl = this.apiUrl;
        }

        const provider = this.getProviderName();

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

        // Translate modal buttons
        if (this.corsRetryBtn) {
            this.corsRetryBtn.textContent = isEn ? 'Retry Connection' : '重新連線';
        }

        this.corsModal.classList.remove('hidden');
        void this.corsModal.offsetWidth;
        this.corsModalContent.classList.remove('scale-95', 'opacity-0');
        this.corsModalContent.classList.add('scale-100', 'opacity-100');
    }

    hideCORSModal() {
        if (!this.corsModal || !this.corsModalContent) return;
        this.corsModalContent.classList.remove('scale-100', 'opacity-100');
        this.corsModalContent.classList.add('scale-95', 'opacity-0');
        
        setTimeout(() => {
            this.corsModal.classList.add('hidden');
        }, 200);
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

    updateLanguage() {
        const isEn = window.currentLang === 'en';
        
        // Update title
        const titleEl = document.getElementById('ai-review-title');
        if (titleEl) {
            const displayName = this.activeModel || 'AI';
            titleEl.textContent = isEn
                ? `${displayName} Match Review`
                : `${displayName} 牌局復盤`;
        }

        // Re-render player stats cards if we have round data
        if (this.lastGameState) {
            this.renderStats(this.lastGameState, this.lastWinnerIndex);
        }

        // Update connection status label
        if (this.lastConnectionStatus) {
            this.updateConnectionStatus(this.lastConnectionStatus);
        }

        // Update connecting message if it is currently displayed
        const connectingEl = document.getElementById('ai-connecting-message');
        if (connectingEl) {
            const provider = this.getProviderName();
            connectingEl.innerHTML = `
                <span class="animate-spin text-sm">⌛</span> ${isEn ? `Connecting to local ${provider}...` : `連線本地 ${provider} 中...`}
            `;
        }

        // Update loading animation messages if it is currently loading
        const loadingMessageEl = document.getElementById('ai-loading-message');
        if (loadingMessageEl) {
            let activeModel = typeof AppStorage !== 'undefined' ? (AppStorage.getItem('reviewLlmModel') || '').trim() : '';
            if (!activeModel) activeModel = this.activeModel || 'AI';
            loadingMessageEl.textContent = isEn
                ? `${activeModel} is analyzing the match...`
                : `${activeModel} 正在分析牌局中...`;
        }

        const loadingSubEl = document.getElementById('ai-loading-submessage');
        if (loadingSubEl && this.loadingMessagesEn && this.loadingMessagesZh) {
            const messages = isEn ? this.loadingMessagesEn : this.loadingMessagesZh;
            const prevIndex = (this.currentLoadingIndex - 1 + messages.length) % messages.length;
            loadingSubEl.textContent = messages[prevIndex];
        }

        // Update input placeholder for Model ID input
        const reviewLlmModelInput = document.getElementById('review-llm-model');
        if (reviewLlmModelInput && !reviewLlmModelInput.value.trim()) {
            const activeModel = this.activeModel || 'AI';
            reviewLlmModelInput.placeholder = isEn
                ? `Auto-detected: ${activeModel}`
                : `自動選擇：${activeModel}`;
        }
    }

    // Update the visual status of the LM Studio connection
    updateConnectionStatus(status) {
        if (!this.indicator || !this.indicatorText) return;
        this.lastConnectionStatus = status;
        
        const isEn = window.currentLang === 'en';
        const provider = this.getProviderName();

        if (status === 'checking') {
            this.indicator.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse';
            this.indicatorText.textContent = isEn ? 'Testing connection...' : '正在測試連線...';
            this.indicatorText.className = 'text-xs text-amber-400 font-medium';
        } else if (status === 'connected') {
            this.indicator.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50';
            if (provider === 'WebLLM') {
                this.indicatorText.textContent = isEn ? 'WebLLM (WebGPU) Active' : 'WebLLM (WebGPU) 已啟用';
            } else {
                this.indicatorText.textContent = isEn ? `${provider} connected` : `${provider} 連線正常`;
            }
            this.indicatorText.className = 'text-xs text-emerald-400 font-medium';
        } else {
            this.indicator.className = 'w-2.5 h-2.5 rounded-full bg-red-500 shadow-md shadow-red-500/50';
            this.indicatorText.textContent = isEn ? 'Connection failed' : '連線失敗';
            this.indicatorText.className = 'text-xs text-red-400 font-medium';
        }
    }

    retrySummary() {
        if (this.lastGameState && this.lastConnectionStatus === 'failed') {
            console.log('[AI Summary] Retrying failed summary...');
            this.showSummary(this.lastGameState, this.lastWinnerIndex);
        }
    }

    // Verify if LM Studio is reachable
    async checkConnection() {
        try {
            const urlObj = new URL(this.apiUrl);
            const modelsUrl = `${urlObj.protocol}//${urlObj.host}/v1/models`;
            console.log('[AI Summary] checkConnection fetching modelsUrl:', modelsUrl);
            
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 2000); // 2 seconds timeout for check
            
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
            console.log('[AI Summary] checkConnection response ok:', response.ok);
            return response.ok;
        } catch (e) {
            console.warn('[AI Summary] Connection test failed:', e);
            return false;
        }
    }

    // Main entry method called on round end
    async showSummary(gameState, winnerIndex) {
        this.lastGameState = gameState;
        this.lastWinnerIndex = winnerIndex;
        this.chatHistory = [];
        this.activeModel = '';
        
        if (this.questionInput) {
            this.questionInput.value = '';
        }
        this.setInputDisabledState(false);

        this.abortActiveAnalysis();
        this.currentAbortController = new AbortController();
        
        this.showPanel();
        this.renderStats(gameState, winnerIndex);
        
        const isEn = window.currentLang === 'en';
        let activeModel = typeof AppStorage !== 'undefined' ? (AppStorage.getItem('reviewLlmModel') || '').trim() : '';
        const displayName = activeModel || 'AI';

        const titleEl = document.getElementById('ai-review-title');
        if (titleEl) {
            titleEl.textContent = isEn
                ? `${displayName} Match Review`
                : `${displayName} 牌局復盤`;
        }

        const provider = this.getProviderName();

        // Reset summary box and show status
        this.summaryContainer.innerHTML = `
            <div id="ai-connecting-message" class="flex items-center gap-2 text-slate-400 text-xs">
                <span class="animate-spin text-sm">⌛</span> ${isEn ? `Connecting to local ${provider}...` : `連線本地 ${provider} 中...`}
            </div>
        `;

        if (this.reviewUseWebGPU) {
            this.updateConnectionStatus('connected');
            this.startLoadingAnimation();
            const subEl = document.getElementById('ai-loading-submessage');
            if (subEl) {
                subEl.textContent = isEn ? 'Preparing WebGPU Model...' : '準備 WebGPU 模型中...';
            }
        } else {
            this.updateConnectionStatus('checking');
            const isConnected = await this.checkConnection();

            if (!isConnected) {
                this.updateConnectionStatus('failed');
                if (provider === 'LM Studio') {
                    this.summaryContainer.innerHTML = isEn
                        ? '<div class="text-red-400 text-xs border border-red-950 bg-red-950/20 p-3 rounded-lg flex flex-col gap-2"><span>❌ Connection to local LM Studio failed.</span><span class="text-[11px] text-slate-400">Please enable CORS rules in LM Studio and try again.</span></div>'
                        : '<div class="text-red-400 text-xs border border-red-950 bg-red-950/20 p-3 rounded-lg flex flex-col gap-2"><span>❌ 無法連線至本地 LM Studio 服務。</span><span class="text-[11px] text-slate-400">請啟用 LM Studio 的 CORS 原則後重試。</span></div>';
                } else {
                    this.summaryContainer.innerHTML = isEn
                        ? `<div class="text-red-400 text-xs border border-red-950 bg-red-950/20 p-3 rounded-lg flex flex-col gap-2"><span>❌ Connection to local ${provider} failed.</span><span class="text-[11px] text-slate-400">Please check if the service is running at ${this.apiUrl} and allows CORS.</span></div>`
                        : `<div class="text-red-400 text-xs border border-red-950 bg-red-950/20 p-3 rounded-lg flex flex-col gap-2"><span>❌ 無法連線至本地 ${provider} 服務。</span><span class="text-[11px] text-slate-400">請檢查該服務是否已在 ${this.apiUrl} 啟動，且已開放 CORS 連線。</span></div>`;
                }
                return;
            }

            this.updateConnectionStatus('connected');
            this.startLoadingAnimation();
        }
        
        try {
            await this.requestAISummary(gameState, winnerIndex, this.currentAbortController.signal);
        } catch (err) {
            this.stopLoadingAnimation();
            if (err.name === 'AbortError') {
                console.log('[AI Summary] Fetch aborted.');
                return;
            }
            console.error('[AI Summary] Request failed:', err);
            const errTitle = isEn ? 'Analysis failed' : '分析發生錯誤';
            this.summaryContainer.innerHTML = `<div class="text-red-400 text-xs border border-red-950 bg-red-950/20 p-3 rounded-lg">❌ ${errTitle}：${err.message || err}</div>`;
            this.updateConnectionStatus('failed');
        }
    }

    // Display player remaining cards and home run status
    renderStats(gameState, winnerIndex) {
        if (!this.statsContainer) return;
        this.statsContainer.innerHTML = '';

        const isEn = window.currentLang === 'en';
        const playerNames = window.PLAYER_NAMES || (isEn ? ["You", "Alex", "Bella", "Chris"] : ["你", "艾力克斯", "貝拉", "克里斯"]);

        // Calculate round scores for each player
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
            
            // Premium tailwind styles for stat cards
            let cardClasses = 'bg-slate-900 border rounded-lg p-2.5 flex flex-col justify-between transition ';
            if (isWinner) {
                cardClasses += 'border-emerald-500/50 bg-emerald-950/10 shadow-sm shadow-emerald-950/30';
            } else if (isHomeRun) {
                cardClasses += 'border-rose-500/50 bg-rose-950/10 shadow-sm shadow-rose-950/30';
            } else {
                cardClasses += 'border-slate-800 bg-slate-950/20';
            }
            cardDiv.className = cardClasses;

            // Generate avatars markup from original DOM if possible
            let avatarImgSrc = 'src/assets/avatars/avatar_you.png';
            if (idx === 1) avatarImgSrc = 'src/assets/avatars/avatar_alex.png';
            if (idx === 2) avatarImgSrc = 'src/assets/avatars/avatar_bella.png';
            if (idx === 3) {
                const p4 = document.getElementById('player-4');
                const p4Img = p4 ? p4.querySelector('.avatar img') : null;
                avatarImgSrc = p4Img ? p4Img.getAttribute('src') : 'src/assets/avatars/avatar_diana.png';
            }

            const winText = isEn ? 'Winner' : '贏家';
            const leftText = isEn ? `${remainingCount} cards left` : `剩餘 ${remainingCount} 張`;
            const hrBadge = isEn ? 'Home Run 😱' : '全壘打 😱';

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
                    ${isWinner ? `<span class="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-[9px] font-extrabold">${isEn ? 'WINNER' : '贏家'}</span>` : ''}
                    ${isHomeRun ? `<span class="px-1.5 py-0.5 rounded bg-rose-950 border border-rose-500/40 text-rose-400 text-[9px] font-extrabold animate-pulse">${hrBadge}</span>` : ''}
                </div>
                ${cardsHtml}
            `;
            this.statsContainer.appendChild(cardDiv);
        });
    }

    // Call LM Studio API (Non-streaming standard fetch)
    async requestAISummary(gameState, winnerIndex, signal) {
        const isEn = window.currentLang === 'en';
        const playerNames = window.PLAYER_NAMES || (isEn ? ["You", "Alex", "Bella", "Chris"] : ["你", "艾力克斯", "貝拉", "克里斯"]);

        // Reconstruct starting hands from play history and final remaining cards
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

        // Helper to format card names
        const getCardName = (cardId) => {
            const rankLabels = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
            const suitSymbols = ['♣', '♦', '♥', '♠'];
            const rankIdx = typeof GameLogic !== 'undefined' ? GameLogic.getRank(cardId) : (cardId % 13);
            const suitIdx = typeof GameLogic !== 'undefined' ? GameLogic.getSuit(cardId) : Math.floor(cardId / 13);
            return suitSymbols[suitIdx] + rankLabels[rankIdx];
        };

        // Prepare game JSON statistics with full history
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

        // Fetch loaded model ID dynamically or fall back to default
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

        // Update UI headers with the dynamically auto-detected model name
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

        if (this.reviewUseWebGPU) {
            const { AiServiceFactory } = await import('./services/AiServiceFactory.js');
            const actualModel = activeModel && activeModel !== 'local-model' ? activeModel : 'gemma-2-2b-it-q4f16_1-MLC';
            
            this.webLlmService = AiServiceFactory.createService({
                useLocalWebGPU: true,
                modelId: actualModel,
                workerPath: '../aiWorker.js',
                initProgressCallback: (progress) => {
                    console.log(`[Review WebLLM Load] ${progress.percent}% - ${progress.text}`);
                    const subEl = document.getElementById('ai-loading-submessage');
                    if (subEl) {
                        subEl.textContent = `${isEn ? 'Loading Model' : '模型載入中'}: ${progress.percent}% (${progress.text})`;
                    }

                    // Sync to Manage tab progress bar
                    const container = document.getElementById('review-webgpu-progress-container');
                    const progressText = document.getElementById('review-webgpu-progress-text');
                    const progressPercent = document.getElementById('review-webgpu-progress-percent');
                    const progressBar = document.getElementById('review-webgpu-progress-bar');
                    
                    if (container && progress.percent < 100) {
                        container.classList.remove('hidden');
                    }
                    if (progressText) progressText.textContent = progress.text;
                    if (progressPercent) progressPercent.textContent = `${progress.percent}%`;
                    if (progressBar) progressBar.style.width = `${progress.percent}%`;

                    if (progress.percent === 100) {
                        setTimeout(() => {
                            if (container) container.classList.add('hidden');
                            this.loadCacheList();
                            if (typeof window.loadNpcCacheList === 'function') {
                                window.loadNpcCacheList();
                            }
                        }, 1500);
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

            console.log('[AI Summary WebGPU] Running inference...');
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
            console.log('[AI Summary] requestAISummary activeModel:', activeModel);
            console.log('[AI Summary] requestAISummary sending POST to:', this.apiUrl);
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

            console.log('[AI Summary] requestAISummary response status:', response.status);
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            const data = await response.json();
            content = data.choices?.[0]?.message?.content || '';
        }

        this.stopLoadingAnimation();

        if (content) {
            this.chatHistory.push({ role: 'assistant', content: content });

            // 1. Escape raw content to prevent HTML injection issues safely
            let html = content
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // 2. Parse custom roast and analysis sections
            html = this.parseRoastAndAnalysis(html);

            // 3. Render markdown structures on the parsed HTML (skipping further escaping)
            html = this.parseBasicMarkdown(html, false);

            // 4. Transform adjacent text nodes and animate with paragraph fade-in
            html = this.applyFadeInEffects(html);

            if (this.summaryContainer) {
                this.summaryContainer.innerHTML = html;
            }
        } else {
            throw new Error('No content returned from LLM');
        }
    }

    startLoadingAnimation() {
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

        let activeModel = typeof AppStorage !== 'undefined' ? (AppStorage.getItem('reviewLlmModel') || '').trim() : '';
        const modelName = activeModel || 'AI';
        const progressTitle = isEn ? `${modelName} is analyzing the match...` : `${modelName} 正在分析牌局中...`;
        const progressSub = getNextMessage();

        this.summaryContainer.innerHTML = `
            <div class="space-y-1.5 py-2 px-3 text-center">
                <div class="text-xs font-bold text-violet-400 animate-pulse" id="ai-loading-message">${progressTitle}</div>
                <div class="text-xs text-slate-500" id="ai-loading-submessage" style="opacity: 1">${progressSub}</div>
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

    stopLoadingAnimation() {
        if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
            this.loadingInterval = null;
        }
    }

    stopTyping() {
        if (this.typingInterval) {
            clearInterval(this.typingInterval);
            this.typingInterval = null;
        }
    }

    // Automatically parse [檢討]/[Review]/[嘲諷]/[Roast] and [分析]/[Analysis] tags into inline styled segments
    parseRoastAndAnalysis(text) {
        let html = text;
        
        // Match line/paragraph starting with [檢討], [Review], [嘲諷], or [Roast]
        html = html.replace(/^(\s*[-*]?\s*)\[(檢討|Review|嘲諷|Roast)\](.*)$/gim, '$1<span class="text-rose-400 font-medium">[$2]$3</span>');
        
        // Match line/paragraph starting with [分析] or [Analysis]
        html = html.replace(/^(\s*[-*]?\s*)\[(分析|Analysis)\](.*)$/gim, '$1<span class="text-slate-400">[$2]$3</span>');
        
        return html;
    }

    // Group text nodes and wrap block elements for smooth sequential paragraph fade-in
    applyFadeInEffects(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Wrap root inline children in structural paragraph containers
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

        // Gather all block elements to apply sequential delays
        const blockChildren = Array.from(tempDiv.children).filter(child => {
            return child.textContent.trim() !== '' || child.querySelector('img') || child.tagName === 'H3';
        });

        const count = blockChildren.length;
        blockChildren.forEach((child, i) => {
            child.classList.add('opacity-0', 'animate-fade-in');
            // Total display time strictly cap at 1 second (1000ms), animation length is 400ms, max delay is 600ms
            const delay = Math.round(i * Math.min(150, 600 / Math.max(1, count - 1)));
            child.style.animationDelay = `${delay}ms`;
        });

        return tempDiv.innerHTML;
    }

    // Fast and safe markdown rendering
    parseBasicMarkdown(text, escapeHtml = true) {
        let html = text;
        if (escapeHtml) {
            // Escape HTML to prevent injection issues
            html = html
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        // Render headings
        html = html.replace(/^### (.*$)/gim, '<h3 class="text-xs lg-game:text-sm font-bold text-violet-400 mt-4 mb-2 pb-1 border-b border-slate-800">$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2 class="text-sm lg-game:text-base font-bold text-violet-300 mt-5 mb-2">$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1 class="text-base lg-game:text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 mt-6 mb-3">$1</h1>');

        // Bold: **text**
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-fuchsia-300 font-bold">$1</strong>');
        
        // Italic: *text*
        html = html.replace(/\*(.*?)\*/g, '<em class="text-slate-300 italic">$1</em>');

        // Inline code: `code`
        html = html.replace(/`(.*?)`/g, '<code class="bg-slate-950 text-pink-300 px-1 py-0.5 rounded font-mono text-[11px]">$1</code>');

        // Lists: - item or * item
        html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-4 list-disc text-slate-300 my-1 font-sans text-xs lg-game:text-sm">$1</li>');

        // Preserve linebreaks
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    async fetchLLMResponse(signal) {
        if (this.reviewUseWebGPU) {
            if (!this.webLlmService || !this.webLlmService.isReady) {
                throw new Error("WebLLM engine is not ready. Please wait.");
            }
            console.log('[AI Summary WebGPU] Running chat Q&A inference...');
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
        if (!this.questionInput) return;
        const question = this.questionInput.value.trim();
        if (!question) return;

        // Clear input field
        this.questionInput.value = '';

        // If there's an ongoing fetch/analysis, abort it or ignore
        if (this.currentAbortController) {
            this.currentAbortController.abort();
        }
        this.currentAbortController = new AbortController();
        const signal = this.currentAbortController.signal;

        // Append user question with language guidelines to history
        const isEn = window.currentLang === 'en';
        const langGuideline = isEn 
            ? "\n(Please reply to this question strictly in English. Do not use Chinese.)" 
            : "\n（請嚴格使用繁體中文回答此問題，勿使用簡體中文或英文。）";
        this.chatHistory.push({ role: 'user', content: question + langGuideline });

        // Add user question to the container visually
        const escapedQuestion = question
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const userMsgHtml = `
            <div class="my-4 flex justify-end animate-fade-in">
                <div class="max-w-[85%] bg-violet-600/30 border border-violet-500/40 rounded-2xl rounded-tr-none px-3.5 py-2 text-slate-100 text-xs lg-game:text-sm shadow-sm flex flex-col gap-1">
                    <div class="text-[10px] text-violet-400 font-bold">${isEn ? 'You' : '你'}</div>
                    <div class="whitespace-pre-wrap">${escapedQuestion}</div>
                </div>
            </div>
        `;
        
        // Append user bubble to summaryContainer
        if (this.summaryContainer) {
            // Remove any previous loading element if any
            const existingLoading = document.getElementById('ai-response-loading');
            if (existingLoading) existingLoading.remove();

            this.summaryContainer.insertAdjacentHTML('beforeend', userMsgHtml);
            
            // Append loading element
            const loadingHtml = `
                <div id="ai-response-loading" class="my-4 flex justify-start animate-fade-in">
                    <div class="max-w-[85%] bg-slate-950/40 border border-slate-800 rounded-2xl rounded-tl-none px-3.5 py-2 text-slate-400 text-xs lg-game:text-sm flex items-center gap-2 shadow-sm">
                        <span class="animate-spin text-sm">⌛</span>
                        <span>${isEn ? 'AI is thinking...' : 'AI 正在思考中...'}</span>
                    </div>
                </div>
            `;
            this.summaryContainer.insertAdjacentHTML('beforeend', loadingHtml);
            this.scrollToBottom();
        }

        // Disable input and button while loading
        this.setInputDisabledState(true);

        try {
            // Call API
            const responseContent = await this.fetchLLMResponse(signal);
            
            // Append response to history
            this.chatHistory.push({ role: 'assistant', content: responseContent });

            // Remove loading indicator
            const loadingEl = document.getElementById('ai-response-loading');
            if (loadingEl) loadingEl.remove();

            // Format response
            let html = responseContent
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            html = this.parseRoastAndAnalysis(html);
            html = this.parseBasicMarkdown(html, false);
            html = this.applyFadeInEffects(html);

            const displayName = this.activeModel || 'AI';

            const aiMsgHtml = `
                <div class="my-4 flex justify-start animate-fade-in">
                    <div class="max-w-[85%] bg-slate-950/40 border border-slate-800 rounded-2xl rounded-tl-none px-3.5 py-2 text-slate-200 text-xs lg-game:text-sm shadow-sm flex flex-col gap-1 w-full">
                        <div class="text-[10px] text-violet-400 font-bold">${displayName}</div>
                        <div class="prose prose-invert max-w-none text-slate-200 text-xs lg-game:text-sm leading-relaxed whitespace-pre-wrap">${html}</div>
                    </div>
                </div>
            `;

            if (this.summaryContainer) {
                this.summaryContainer.insertAdjacentHTML('beforeend', aiMsgHtml);
                this.scrollToBottom();
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
            if (this.summaryContainer) {
                this.summaryContainer.insertAdjacentHTML('beforeend', errMsgHtml);
                this.scrollToBottom();
            }
        } finally {
            this.setInputDisabledState(false);
        }
    }

    setInputDisabledState(disabled) {
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

    scrollToBottom() {
        if (this.scrollContainer) {
            this.scrollContainer.scrollTo({
                top: this.scrollContainer.scrollHeight,
                behavior: 'smooth'
            });
        }
    }

    isReviewPreloaderActive() {
        return this.reviewPreloader && this.reviewPreloader.isInitializing && !this.reviewPreloader.isPaused;
    }
}

// Export singleton to global window scope
window.AISummary = new AISummarySystem();

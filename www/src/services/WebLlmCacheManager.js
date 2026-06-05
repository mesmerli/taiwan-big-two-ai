/**
 * WebLlmCacheManager - Utility to manage downloaded WebLLM model caches
 */

export class WebLlmCacheManager {
    /**
     * Get all cache names in the browser starting with "webllm/"
     * @returns {Promise<string[]>} List of Cache API keys
     */
    // Available models to scan
    static MODELS = [
        { id: 'gemma-2-2b-it-q4f16_1-MLC', name: 'Gemma 2 2B (f16 - High Performance)' },
        { id: 'gemma-2-2b-it-q4f32_1-MLC', name: 'Gemma 2 2B (f32 - High Compatibility)' },
        { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 1.5B (f16 - High Performance)' },
        { id: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC', name: 'Qwen 2.5 1.5B (f32 - High Compatibility)' },
        { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B (f16)' },
        { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B (f16)' },
        { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi 3.5 Mini 3.8B (f16)' }
    ];

    static liveProgress = new Map();
    static activeDownloader = null;
    static completionCache = new Map();
    static sizeCache = new Map();
    static pendingCompletions = new Map();
    static pendingSizes = new Map();

    /**
     * Get all cached model IDs by scanning standard caches
     * @returns {Promise<string[]>} List of model IDs (e.g. ['gemma-2-2b-it-q4f16_1-MLC'])
     */
    static async listCachedModels() {
        if (typeof caches === 'undefined') return [];
        try {
            const cache = await caches.open('webllm/model');
            const keys = await cache.keys();
            const urls = keys.map(k => k.url.toLowerCase());

            // Check which of our supported models have files in the cache
            const cachedModels = [];
            for (const model of this.MODELS) {
                // If there are files containing the model's ID in the cache, it exists
                const modelIdLower = model.id.toLowerCase();
                const hasFiles = urls.some(url => url.includes(modelIdLower));
                if (hasFiles) {
                    cachedModels.push(model.id);
                }

                // If the model is an f16 version, also check if its f32 variant is in the cache
                if (model.id.includes('q4f16_1')) {
                    const f32Id = model.id.replace('q4f16_1', 'q4f32_1');
                    const f32IdLower = f32Id.toLowerCase();
                    const hasF32Files = urls.some(url => url.includes(f32IdLower));
                    if (hasF32Files) {
                        cachedModels.push(f32Id);
                    }
                }
            }

            // Fallback: If we have a generic custom/fallback model cache that is not in MODELS
            const keysRaw = await caches.keys();
            for (const key of keysRaw) {
                if (key.startsWith('webllm/') && key !== 'webllm/config' && key !== 'webllm/wasm' && key !== 'webllm/model') {
                    try {
                        const legacyCache = await caches.open(key);
                        const legacyKeys = await legacyCache.keys();
                        if (legacyKeys.length === 0) {
                            await caches.delete(key);
                        } else {
                            cachedModels.push(key.replace('webllm/', ''));
                        }
                    } catch (_) {
                        cachedModels.push(key.replace('webllm/', ''));
                    }
                }
            }

            return Array.from(new Set(cachedModels));
        } catch (e) {
            console.error('[WebLlmCacheManager] Failed to list caches:', e);
            return [];
        }
    }

    /**
     * Calculate the size of a specific model in the cache
     * @param {string} modelId Model ID
     * @returns {Promise<string>} Formatted size string (e.g. "1.2 GB")
     */
    static getCacheSize(modelId) {
        if (typeof caches === 'undefined') return Promise.resolve('0 MB');
        const cacheKey = modelId.toLowerCase();
        const now = Date.now();
        const cached = this.sizeCache.get(cacheKey);
        if (cached && (now - cached.timestamp < 2000)) {
            return Promise.resolve(cached.value);
        }

        if (this.pendingSizes.has(cacheKey)) {
            return this.pendingSizes.get(cacheKey);
        }

        const promise = this._getCacheSizeInternal(modelId).then(result => {
            this.sizeCache.set(cacheKey, { value: result, timestamp: Date.now() });
            this.pendingSizes.delete(cacheKey);
            return result;
        }).catch(err => {
            this.pendingSizes.delete(cacheKey);
            throw err;
        });

        this.pendingSizes.set(cacheKey, promise);
        return promise;
    }

    static async _getCacheSizeInternal(modelId) {
        try {
            const cache = await caches.open('webllm/model');
            const keys = await cache.keys();
            let totalBytes = 0;
            const modelIdLower = modelId.toLowerCase();

            for (const key of keys) {
                const urlLower = key.url.toLowerCase();
                if (urlLower.includes(modelIdLower)) {
                    const response = await cache.match(key);
                    if (response) {
                        const blob = await response.blob();
                        totalBytes += blob.size;
                    }
                }
            }

            // Also check if there's a standalone cache just for this model ID
            try {
                const hasLegacy = await caches.has('webllm/' + modelId);
                if (hasLegacy) {
                    const legacyCache = await caches.open('webllm/' + modelId);
                    const legacyKeys = await legacyCache.keys();
                    for (const key of legacyKeys) {
                        const response = await legacyCache.match(key);
                        if (response) {
                            const blob = await response.blob();
                            totalBytes += blob.size;
                        }
                    }
                }
            } catch (_) { }

            if (totalBytes === 0) return '0 MB';
            if (totalBytes < 1024 * 1024) {
                return (totalBytes / 1024).toFixed(1) + ' KB';
            } else if (totalBytes < 1024 * 1024 * 1024) {
                return (totalBytes / (1024 * 1024)).toFixed(1) + ' MB';
            } else {
                return (totalBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
            }
        } catch (e) {
            console.warn(`[WebLlmCacheManager] Failed to read size for ${modelId}:`, e);
            return 'Unknown';
        }
    }

    /**
     * Get the download completion percentage of a WebLLM model
     * @param {string} modelId Model ID
     * @returns {Promise<number>} Percentage (0-100)
     */
    static getCacheCompletion(modelId) {
        if (typeof caches === 'undefined') {
            console.debug("[WebLlmCacheManager] getCacheCompletion return: caches is undefined");
            return Promise.resolve(0);
        }

        const cacheKey = modelId.toLowerCase();
        const now = Date.now();
        const cached = this.completionCache.get(cacheKey);
        if (cached && (now - cached.timestamp < 2000)) {
            return Promise.resolve(cached.value);
        }

        if (this.pendingCompletions.has(cacheKey)) {
            return this.pendingCompletions.get(cacheKey);
        }

        const promise = this._getCacheCompletionInternal(modelId).then(result => {
            this.completionCache.set(cacheKey, { value: result, timestamp: Date.now() });
            this.pendingCompletions.delete(cacheKey);
            return result;
        }).catch(err => {
            this.pendingCompletions.delete(cacheKey);
            throw err;
        });

        this.pendingCompletions.set(cacheKey, promise);
        return promise;
    }

    static async _getCacheCompletionInternal(modelId) {
        try {
            const modelIdLower = modelId.toLowerCase();
            let data = null;
            let keysToCount = [];

            // 1. Try to find ndarray-cache.json in the webllm/config cache
            if (await caches.has('webllm/config')) {
                const configCache = await caches.open('webllm/config');
                const configKeys = await configCache.keys();
                const configKey = configKeys.find(k => {
                    const urlDecoded = decodeURIComponent(k.url).toLowerCase();
                    return urlDecoded.includes(modelIdLower) && urlDecoded.includes('ndarray-cache.json');
                });
                if (configKey) {
                    const response = await configCache.match(configKey);
                    if (response) {
                        data = await response.json();
                    }
                }
            }

            // 2. Try to find ndarray-cache.json in the webllm/model cache
            const modelCache = await caches.open('webllm/model');
            const modelKeys = await modelCache.keys();
            keysToCount = modelKeys;

            if (!data) {
                const configKey = modelKeys.find(k => {
                    const urlDecoded = decodeURIComponent(k.url).toLowerCase();
                    return urlDecoded.includes(modelIdLower) && urlDecoded.includes('ndarray-cache.json');
                });
                if (configKey) {
                    const response = await modelCache.match(configKey);
                    if (response) {
                        data = await response.json();
                    }
                }
            }

            // 3. Legacy individual cache check
            if (!data) {
                try {
                    const hasLegacy = await caches.has('webllm/' + modelId);
                    if (hasLegacy) {
                        const legacyCache = await caches.open('webllm/' + modelId);
                        const legacyKeys = await legacyCache.keys();
                        const legacyConfigKey = legacyKeys.find(k => {
                            const urlDecoded = decodeURIComponent(k.url).toLowerCase();
                            return urlDecoded.includes('ndarray-cache.json');
                        });
                        if (legacyConfigKey) {
                            const response = await legacyCache.match(legacyConfigKey);
                            if (response) {
                                data = await response.json();
                                keysToCount = legacyKeys;
                            }
                        }
                    }
                } catch (_) { }
            }

            if (!data || !Array.isArray(data.records)) {
                const isStandardModel = this.MODELS.some(m => m.id.toLowerCase() === modelIdLower || m.id.replace('q4f16_1', 'q4f32_1').toLowerCase() === modelIdLower);
                if (isStandardModel) {
                    console.debug("[WebLlmCacheManager] getCacheCompletion return: standard model " + modelId + " but no data/manifest found in cache");
                    return 0;
                }
                // Fallback: If we find files for this model but no config manifest, count files
                const matchingFiles = keysToCount.filter(k => {
                    const urlDecoded = decodeURIComponent(k.url).toLowerCase();
                    return urlDecoded.includes(modelIdLower);
                });
                console.debug("[WebLlmCacheManager] getCacheCompletion return: non-standard fallback model files count = " + matchingFiles.length);
                return matchingFiles.length > 5 ? 100 : 0;
            }

            const expectedShards = new Set();
            data.records.forEach(r => {
                if (r.dataPath) expectedShards.add(r.dataPath);
            });

            if (expectedShards.size === 0) {
                console.debug("[WebLlmCacheManager] getCacheCompletion return: expectedShards size is 0");
                return 100;
            }

            let cachedCount = 0;
            const cachedUrls = keysToCount.map(k => k.url);

            expectedShards.forEach(shard => {
                const shardLower = shard.toLowerCase();
                if (cachedUrls.some(url => {
                    const urlDecoded = decodeURIComponent(url).toLowerCase();
                    return urlDecoded.includes(modelIdLower) && urlDecoded.includes(shardLower);
                })) {
                    cachedCount++;
                }
            });

            console.debug(`[WebLlmCacheManager] Model ${modelId} completion check: cachedCount=${cachedCount}, expectedShards.size=${expectedShards.size}`);
            console.debug("[WebLlmCacheManager] getCacheCompletion return: calculated percent = " + Math.round((cachedCount / expectedShards.size) * 100));
            return Math.round((cachedCount / expectedShards.size) * 100);
        } catch (e) {
            console.warn(`[WebLlmCacheManager] Failed to calculate completion for ${modelId}:`, e);
            console.debug("[WebLlmCacheManager] getCacheCompletion return: error catch block return 0");
            return 0;
        }
    }

    /**
     * Delete a specific model from the cache
     * @param {string} modelId Model ID
     * @returns {Promise<boolean>} True if deleted successfully
     */
    static async deleteCachedModel(modelId) {
        if (typeof caches === 'undefined') return false;
        try {
            console.log(`[WebLlmCacheManager] Deleting model files for: ${modelId}`);

            // Delete from the shared webllm/model cache
            const cache = await caches.open('webllm/model');
            const keys = await cache.keys();
            const modelIdLower = modelId.toLowerCase();
            let deletedAny = false;

            for (const key of keys) {
                const urlLower = key.url.toLowerCase();
                if (urlLower.includes(modelIdLower)) {
                    await cache.delete(key);
                    deletedAny = true;
                }
            }

            // Clear live progress tracking
            this.liveProgress.delete(modelId);

            // Also delete legacy standalone cache if it exists
            const legacyDeleted = await caches.delete('webllm/' + modelId);

            return deletedAny || legacyDeleted;
        } catch (e) {
            console.error(`[WebLlmCacheManager] Failed to delete cache for ${modelId}:`, e);
            return false;
        }
    }

    /**
     * Map a cache name / model ID to its friendly display name
     * @param {string} modelId The model ID
     * @returns {string} Friendly name
     */
    static getModelFriendlyName(modelId) {
        const id = modelId.replace('webllm/', '');
        const found = this.MODELS.find(m => m.id === id);
        return found ? found.name : id;
    }

    /**
     * Start downloading a model using an AiService instance
     * @param {string} modelId 
     * @param {Object} options callbacks
     */
    static async downloadModel(modelId, options = {}) {
        if (this.activeDownloader) {
            this.activeDownloader.stopLoading();
            this.activeDownloader = null;
        }

        const { AiServiceFactory } = await import('./AiServiceFactory.js');

        const onProgress = options.onProgress || (() => { });
        const onComplete = options.onComplete || (() => { });
        const onError = options.onError || (() => { });

        this.activeDownloader = AiServiceFactory.createService({
            useLocalWebGPU: true,
            modelId: modelId,
            workerPath: '../aiWorker.js',
            initProgressCallback: (progress) => {
                this.liveProgress.set(modelId, progress.percent);

                onProgress(progress);

                if (progress.percent === 100) {
                    this.liveProgress.delete(modelId);
                    this.activeDownloader = null;
                    onComplete(progress);
                }
            }
        });

        // Kick off initialization in the background without blocking the return of downloadModel
        this.activeDownloader.init().catch(err => {
            console.error('[WebLlmCacheManager] Background init failed:', err);
            this.liveProgress.delete(modelId);
            this.activeDownloader = null;
            onError(err);
        });
    }

    static pauseDownload() {
        if (this.activeDownloader) {
            this.activeDownloader.pauseLoading();
        }
    }

    static resumeDownload() {
        if (this.activeDownloader) {
            this.activeDownloader.init();
        }
    }

    static stopDownload() {
        if (this.activeDownloader) {
            this.activeDownloader.stopLoading();
            this.activeDownloader = null;
        }
    }

    static isPaused() {
        return this.activeDownloader ? this.activeDownloader.isPaused : false;
    }

    static isDownloading() {
        return this.activeDownloader !== null;
    }

    static getActiveModelId() {
        return this.activeDownloader ? this.activeDownloader.modelId : null;
    }

    static f16Supported = undefined;

    /**
     * Check if shader-f16 is supported by the GPU adapter
     * @returns {Promise<boolean>} True if f16 is supported
     */
    static async checkF16Supported() {
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
        return this.f16Supported;
    }

    /**
     * Get a list of all standard models from MODELS that are fully cached (100% downloaded)
     * @returns {Promise<Object[]>} Array of model objects (name and id)
     */
    static async getFullyCachedStandardModels() {
        const cachedList = await this.listCachedModels();
        const fullyCached = [];

        for (const m of this.MODELS) {
            let isModelFullyCached = false;
            // Check direct ID
            const isCached = cachedList.some(c => c.toLowerCase() === m.id.toLowerCase());
            if (isCached) {
                const completion = await this.getCacheCompletion(m.id);
                if (completion === 100) {
                    isModelFullyCached = true;
                }
            }

            // Check f32 fallback ID if f16 is not supported
            if (!isModelFullyCached && m.id.includes('q4f16_1')) {
                const f32Id = m.id.replace('q4f16_1', 'q4f32_1');
                const isF32Cached = cachedList.some(c => c.toLowerCase() === f32Id.toLowerCase());
                if (isF32Cached) {
                    const completion = await this.getCacheCompletion(f32Id);
                    if (completion === 100) {
                        isModelFullyCached = true;
                    }
                }
            }

            if (isModelFullyCached) {
                fullyCached.push(m);
            }
        }
        return fullyCached;
    }

    /**
     * Render the cache list UI into the specified element
     * @param {HTMLElement} [listEl] The element to render the list in (defaults to 'review-cache-list')
     * @param {Object} [options] Callbacks and config options
     */
    static async renderCacheList(listEl, options = {}) {
        listEl = listEl || document.getElementById('review-cache-list');
        if (!listEl) return;

        const isEn = window.currentLang === 'en' || (typeof currentLang !== 'undefined' && currentLang === 'en');
        listEl.innerHTML = `<div style="font-style: italic;">${isEn ? 'Loading cache list...' : '正在載入快取列表...'}</div>`;

        const f16Supported = await this.checkF16Supported();
        const cachesList = await this.listCachedModels();

        listEl.innerHTML = '';
        for (const model of this.MODELS) {
            const isF16 = model.id.includes('q4f16_1');
            const hasF32Fallback = isF16;
            const isSupported = !isF16 || f16Supported;

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
                        await this.deleteCachedModel(queryModelId);
                        this.renderCacheList(listEl, options);
                        if (typeof window.loadNpcCacheList === 'function') {
                            window.loadNpcCacheList();
                        }
                    }
                };

                rightDiv.appendChild(sizeSpan);
                rightDiv.appendChild(deleteBtn);

                const livePct = this.liveProgress.get(queryModelId);
                Promise.all([
                    livePct !== undefined ? Promise.resolve(livePct) : this.getCacheCompletion(queryModelId),
                    this.getCacheSize(queryModelId)
                ]).then(([completion, size]) => {
                    const pctText = isEn ? `${completion}% downloaded` : `已下載 ${completion}%`;
                    sizeSpan.textContent = `${pctText} (${size})`;

                    if (completion < 100) {
                        const resumeBtn = document.createElement('button');
                        resumeBtn.textContent = isEn ? '📥 Resume' : '📥 繼續下載';
                        resumeBtn.style.cssText = 'background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 4px; cursor: pointer; font-size: 10px; color: #a78bfa; padding: 2px 8px; transition: all 0.2s;';
                        resumeBtn.onmouseover = () => {
                            resumeBtn.style.background = 'rgba(139, 92, 246, 0.4)';
                        };
                        resumeBtn.onmouseout = () => {
                            resumeBtn.style.background = 'rgba(139, 92, 246, 0.2)';
                        };
                        resumeBtn.onclick = () => {
                            this.startDownload(model.id, options);
                        };
                        rightDiv.insertBefore(resumeBtn, deleteBtn);
                    }
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
                        this.startDownload(model.id, options);
                    };
                }
                rightDiv.appendChild(downloadBtn);
            }

            itemDiv.appendChild(nameSpan);
            itemDiv.appendChild(rightDiv);
            listEl.appendChild(itemDiv);
        }
    }

    /**
     * Start downloading a model and handle UI progress updates
     * @param {string} modelId Model ID to download
     * @param {Object} [options] Callbacks and config options
     */
    static async startDownload(modelId, options = {}) {
        const isEn = window.currentLang === 'en' || (typeof currentLang !== 'undefined' && currentLang === 'en');
        const container = document.getElementById('review-webgpu-progress-container');

        if (typeof window.isNpcPreloaderActive === 'function' && window.isNpcPreloaderActive()) {
            const alertMsg = isEn ? 'Another model (NPC Player) is downloading. Please wait or pause it first.' : '有其他模型（NPC 玩家）正在下載中，請先等待下載完成或暫停該下載。';
            alert(alertMsg);
            return;
        }

        const f16Supported = await this.checkF16Supported();
        let targetModelId = modelId;
        if (modelId.includes('q4f16_1') && f16Supported === false) {
            const hasF32Fallback = true;
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

        await this.downloadModel(targetModelId, {
            onProgress: (progress) => {
                if (progressText) progressText.textContent = progress.text;
                if (progressPercent) progressPercent.textContent = `${progress.percent}%`;
                if (progressBar) progressBar.style.width = `${progress.percent}%`;
            },
            onComplete: (progress) => {
                setTimeout(() => {
                    if (container) container.classList.add('hidden');
                    this.renderCacheList(undefined, options);
                    if (typeof window.loadNpcCacheList === 'function') {
                        window.loadNpcCacheList();
                    }
                }, 1500);
            },
            onError: (err) => {
                this.renderCacheList(undefined, options);
            }
        });

        const t = (key) => {
            if (typeof window.t === 'function') return window.t(key);
            return isEn ? key : (key === 'pause' ? '暫停' : (key === 'resume' ? '繼續' : '停止'));
        };

        if (btnPause) {
            btnPause.textContent = t('pause');
            btnPause.onclick = () => {
                const isCurrentlyPaused = btnPause.textContent === t('resume') || this.isPaused();
                if (isCurrentlyPaused) {
                    btnPause.textContent = t('pause');
                    this.resumeDownload();
                } else {
                    btnPause.textContent = t('resume');
                    this.pauseDownload();
                    this.renderCacheList(undefined, options);
                }
            };
        }

        if (btnStop) {
            btnStop.onclick = () => {
                this.stopDownload();
                this.renderCacheList(undefined, options);
                if (container) container.classList.add('hidden');
            };
        }
    }
}

if (typeof window !== 'undefined') {
    window.WebLlmCacheManager = WebLlmCacheManager;
}

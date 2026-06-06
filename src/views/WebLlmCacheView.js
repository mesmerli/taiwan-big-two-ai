import { WebLlmCacheManager } from '../services/WebLlmCacheManager.js';

export class WebLlmCacheView {
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

        const f16Supported = await WebLlmCacheManager.checkF16Supported();
        const cachesList = await WebLlmCacheManager.listCachedModels();

        listEl.innerHTML = '';
        for (const model of WebLlmCacheManager.MODELS) {
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
                        await WebLlmCacheManager.deleteCachedModel(queryModelId);
                        this.renderCacheList(listEl, options);
                        if (typeof window.loadNpcCacheList === 'function') {
                            window.loadNpcCacheList();
                        }
                    }
                };

                rightDiv.appendChild(sizeSpan);
                rightDiv.appendChild(deleteBtn);

                const livePct = WebLlmCacheManager.liveProgress.get(queryModelId);
                Promise.all([
                    livePct !== undefined ? Promise.resolve(livePct) : WebLlmCacheManager.getCacheCompletion(queryModelId),
                    WebLlmCacheManager.getCacheSize(queryModelId)
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

        const f16Supported = await WebLlmCacheManager.checkF16Supported();
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

        await WebLlmCacheManager.downloadModel(targetModelId, {
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
                const isCurrentlyPaused = btnPause.textContent === t('resume') || WebLlmCacheManager.isPaused();
                if (isCurrentlyPaused) {
                    btnPause.textContent = t('pause');
                    WebLlmCacheManager.resumeDownload();
                } else {
                    btnPause.textContent = t('resume');
                    WebLlmCacheManager.pauseDownload();
                    this.renderCacheList(undefined, options);
                }
            };
        }

        if (btnStop) {
            btnStop.onclick = () => {
                WebLlmCacheManager.stopDownload();
                this.renderCacheList(undefined, options);
                if (container) container.classList.add('hidden');
            };
        }
    }
}

if (typeof window !== 'undefined') {
    window.WebLlmCacheView = WebLlmCacheView;
}

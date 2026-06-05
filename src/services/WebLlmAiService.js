/**
 * WebLlmAiService - 基於 WebLLM (@mlc-ai/web-llm) 與 Web Worker 的本地 AI 服務類別
 */

import { CreateWebWorkerMLCEngine } from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm";
import { SYSTEM_PROMPT } from './sharedPrompt.js';

export class WebLlmAiService {
    /**
     * @param {Object} config 配置參數
     * @param {string} [config.modelId] 模型識別碼，預設為 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'
     * @param {string} [config.workerPath] Web Worker 腳本的路徑，預設為 '../aiWorker.js'
     * @param {Function} [config.initProgressCallback] 模型下載與載入進度回呼函式
     * @param {number} [config.temperature] 溫度參數，預設 0.7
     */
    constructor(config = {}) {
        this.modelId = config.modelId || 'gemma-2-2b-it-q4f16_1-MLC';
        this.workerPath = config.workerPath || '../aiWorker.js';
        this.initProgressCallback = config.initProgressCallback || null;
        this.temperature = config.temperature !== undefined ? config.temperature : 0.1;
        
        this.progressListeners = new Set();
        if (config.initProgressCallback) {
            this.progressListeners.add(config.initProgressCallback);
        }

        this.engine = null;
        this.worker = null;
        this.isInitializing = false;
        this.isReady = false;
        this.isPaused = false;
    }

    addProgressListener(callback) {
        if (callback) {
            this.progressListeners.add(callback);
        }
    }

    removeProgressListener(callback) {
        this.progressListeners.delete(callback);
    }

    /**
     * 初始化 WebLLM Engine，建立 Web Worker 並載入模型
     */
    async init() {
        if (this.isReady) return;
        if (this.isInitializing && !this.isPaused) return;

        this.isPaused = false;
        this.isInitializing = true;
        try {
            // Check if f16 is supported, if not, automatically fallback to q4f32_1
            if (this.modelId.includes('q4f16_1') && typeof navigator !== 'undefined' && navigator.gpu) {
                try {
                    const adapter = await navigator.gpu.requestAdapter();
                    if (adapter && !adapter.features.has('shader-f16')) {
                        console.warn(`[WebLlmAiService] shader-f16 feature not supported by this GPU/browser. Automatically falling back from ${this.modelId} to the f32 variant.`);
                        this.modelId = this.modelId.replace('q4f16_1', 'q4f32_1');
                    }
                } catch (e) {
                    console.warn("[WebLlmAiService] Failed to check GPU features for f16 support:", e);
                }
            }

            // --- 防禦性程式設計：提前抓取驗證 ndarray-cache.json ---
            try {
                const { prebuiltAppConfig } = await import("https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm");
                const modelInfo = prebuiltAppConfig.model_list.find(m => m.model_id === this.modelId);
                if (modelInfo) {
                    let rawUrl = modelInfo.model || modelInfo.model_url;
                    if (rawUrl) {
                        // If it's a Hugging Face repo URL without '/resolve/main/', append it
                        if (rawUrl.includes('huggingface.co') && !rawUrl.includes('/resolve/')) {
                            rawUrl = rawUrl.endsWith('/') ? rawUrl + 'resolve/main/' : rawUrl + '/resolve/main/';
                        }
                        const baseUrl = rawUrl.endsWith('/') ? rawUrl : rawUrl + '/';
                        const jsonUrl = `${baseUrl}ndarray-cache.json`;
                        console.log(`[WebLlmAiService] 正在進行防禦性驗證，抓取：${jsonUrl}`);
                        
                        const response = await fetch(jsonUrl);
                        if (!response.ok) {
                            throw new Error(`無法取得 ndarray-cache.json (HTTP 狀態碼: ${response.status})`);
                        }
                        
                        const responseToCache = response.clone();
                        const ndarrayCache = await response.json();
                        console.log("✅ [WebLlmAiService] 提前驗證 ndarray-cache.json 成功：", ndarrayCache);

                        // 將 ndarray-cache.json 寫入 webllm/config 快取以供 getCacheCompletion() 查詢
                        if (typeof caches !== 'undefined') {
                            try {
                                const configCache = await caches.open('webllm/config');
                                await configCache.put(jsonUrl, responseToCache);
                                console.log(`[WebLlmAiService] 成功將 ndarray-cache.json 快取至 webllm/config (URL: ${jsonUrl})`);
                            } catch (cacheErr) {
                                console.warn("[WebLlmAiService] 寫入 webllm/config 快取失敗:", cacheErr);
                            }
                        }
                    } else {
                        console.warn(`[WebLlmAiService] 模型 ${this.modelId} 的配置中缺少下載網址，跳過防禦性抓取驗證。`);
                    }
                } else {
                    console.warn(`[WebLlmAiService] 在 prebuiltAppConfig 中找不到模型配置: ${this.modelId}，跳過防禦性抓取驗證。`);
                }
            } catch (error) {
                throw new Error(`模型初始化前防禦驗證失敗，無法連接到下載伺服器或索引檔損毀: ${error.message || error}`);
            }
            // --------------------------------------------------------

            console.log(`[WebLlmAiService] 正在背景初始化模型: ${this.modelId}`);
            
            // 建立 Web Worker 實例 (使用 ESM 模組形式載入)
            this.worker = new Worker(new URL(this.workerPath, import.meta.url), {
                type: 'module'
            });

            // 呼叫 WebLLM API 建立由 Web Worker 驅動的引擎
            this.engine = await CreateWebWorkerMLCEngine(
                this.worker,
                this.modelId,
                {
                    initProgressCallback: (report) => {
                        if (this.isPaused) return;
                        const percent = Math.round(report.progress * 100);
                        
                        // 根據語系動態翻譯進度文字
                        const isEn = (typeof window !== 'undefined' && window.currentLang === 'en') || (typeof currentLang !== 'undefined' && currentLang === 'en');
                        let translatedText = report.text;
                        if (!isEn) {
                            if (report.text.includes('Fetching param cache')) {
                                const match = report.text.match(/Fetching param cache\[(\d+)\/(\d+)\]:\s*([\d\.]+\s*[a-zA-Z]+)\s*fetched\.\s*(\d+)%\s*completed,\s*(\d+)\s*secs\s*elapsed/);
                                if (match) {
                                    const [_, current, total, size, pct, secs] = match;
                                    translatedText = `正在下載並建立模型快取 [${current}/${total}]: 已載入 ${size} (${pct}%)，已耗時 ${secs} 秒。首次載入時間較長，之後載入將會加快。`;
                                } else {
                                    translatedText = report.text.replace('Fetching param cache', '正在下載模型快取');
                                }
                            } else if (report.text.includes('Loading model from cache')) {
                                translatedText = '正在從快取中載入模型...';
                            } else if (report.text.includes('Start to fetch')) {
                                translatedText = '開始獲取模型資訊...';
                            } else if (report.text.includes('Finish loading on WebGPU')) {
                                translatedText = '模型已成功載入至 WebGPU 顯示卡！';
                            }
                        }

                        const progressData = {
                            percent: percent,
                            text: translatedText,
                            raw: report
                        };
                        
                        this.progressListeners.forEach(listener => {
                            try { listener(progressData); } catch (e) {}
                        });

                        if (this.initProgressCallback) {
                            try { this.initProgressCallback(progressData); } catch (e) {}
                        }
                    }
                }
            );

            this.isReady = true;
            this.isInitializing = false;
            console.log(`[WebLlmAiService] 模型 ${this.modelId} 初始化成功且準備就緒。`);
        } catch (error) {
            this.isInitializing = false;
            if (this.isPaused) {
                console.log('[WebLlmAiService] 初始化中止：因為已被載入暫停。');
            } else {
                console.error('[WebLlmAiService] 初始化失敗:', error);
                throw error;
            }
        }
    }

    /**
     * 暫停模型載入
     */
    pauseLoading() {
        if (!this.isInitializing || this.isReady) return;
        this.isPaused = true;
        this.isInitializing = false;
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.engine = null;
        console.log('[WebLlmAiService] 模型載入已暫停。');
    }

    /**
     * 停止並重設模型載入
     */
    stopLoading() {
        this.isPaused = false;
        this.isInitializing = false;
        this.isReady = false;
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.engine = null;
        console.log('[WebLlmAiService] 模型載入已停止。');
    }

    /**
     * 利用本地 WebGPU 進行大老二決策推理
     * @param {Object} gameState 當前遊戲狀態局勢
     * @returns {Promise<Object>} 包含 actionType, cardsPlayed, trashTalk 的 JSON 物件
     */
    async fetchAiMove(gameState) {
        if (!this.isReady) {
            // 自動嘗試初始化
            await this.init();
        }

        try {
            const userPrompt = JSON.stringify(gameState, null, 2);
            let finalSystemPrompt = SYSTEM_PROMPT;
            let finalUserPrompt = `當前的遊戲局勢如下，請做出決策：\n${userPrompt}`;

            // 如果帶有預先生成的 Prompt（舊方法相容，節省 Token 並傳遞完整戰術）
            if (gameState.systemPrompt && gameState.userPrompt) {
                finalSystemPrompt = gameState.systemPrompt;
                finalUserPrompt = gameState.userPrompt;
            }

            const response = await this.engine.chat.completions.create({
                messages: [
                    { role: 'system', content: finalSystemPrompt },
                    { role: 'user', content: finalUserPrompt }
                ],
                temperature: this.temperature,
                top_p: 0.9,
                frequency_penalty: 1.0,
                presence_penalty: 0.5,
                max_tokens: 3000,
                stream: false
            });

            let content = response.choices[0].message.content.trim();
            
            // 尋找第一個 '{' 與最後一個 '}' 以提取出 JSON 內容（可防禦性地剥離 Markdown、前後贅字與額外文字等非 JSON 字元）
            const firstBrace = content.indexOf('{');
            const lastBrace = content.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                content = content.substring(firstBrace, lastBrace + 1);
            }

            let parsedResult;
            try {
                parsedResult = JSON.parse(content);
            } catch (jsonErr) {
                console.warn('[WebLlmAiService] JSON 解析失敗，原始回傳內容為:', content);
                throw jsonErr;
            }

            // 如果回傳包含 selected_index (舊評分方法相容)，將其轉換回新介面預期的格式
            if (parsedResult.selected_index !== undefined && gameState.legalMoves) {
                const idx = parseInt(parsedResult.selected_index);
                const selectedCards = (idx >= 0 && idx < gameState.legalMoves.length) ? gameState.legalMoves[idx] : [];
                return {
                    actionType: (selectedCards.length === 0) ? "PASS" : "PLAY",
                    cardsPlayed: selectedCards,
                    trashTalk: parsedResult.trashTalk || "",
                    strategy: parsedResult.strategy || "",
                    confidence_score: parsedResult.confidence_score || 0
                };
            }

            return parsedResult;
        } catch (error) {
            console.error('[WebLlmAiService] 本地 WebGPU 推理出錯:', error);
            // 丟出錯誤交由呼叫端 (ai.js) 降級為電腦玩家決策方法處理，避免強制 Pass
            throw error;
        }
    }
}

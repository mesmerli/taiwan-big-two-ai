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
        
        this.engine = null;
        this.worker = null;
        this.isInitializing = false;
        this.isReady = false;
        this.isPaused = false;
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
                        // 處理進度報告 (格式一般為 { progress: 0-1, text: "..." })
                        if (this.initProgressCallback) {
                            const percent = Math.round(report.progress * 100);
                            this.initProgressCallback({
                                percent: percent,
                                text: report.text,
                                raw: report
                            });
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

            const schemaObj = {
                type: "object",
                properties: {
                    selected_index: { type: "number" },
                    confidence_score: { type: "number" },
                    strategy: { type: "string" },
                    trashTalk: { type: "string" }
                },
                required: ["selected_index", "confidence_score", "strategy", "trashTalk"]
            };

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
                stream: false,
                response_format: { 
                    type: "json_object",
                    schema: JSON.stringify(schemaObj)
                }
            });

            const content = response.choices[0].message.content.trim();
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

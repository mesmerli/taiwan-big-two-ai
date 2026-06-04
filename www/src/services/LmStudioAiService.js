/**
 * LmStudioAiService - LM Studio 遠端 HTTP API 請求服務類別
 */

import { SYSTEM_PROMPT } from './sharedPrompt.js';

// 用於快取伺服器是否支援 json_object，避免每次請求都遭遇 400 延遲與重試
let supportsJsonObject = true;

export class LmStudioAiService {
    /**
     * @param {Object} config 配置參數
     * @param {string} config.apiUrl API 節點網址，預設為 http://localhost:1234/v1/chat/completions
     * @param {string} [config.modelId] 模型識別碼，若未指定則自動偵測或使用預設
     * @param {string} [config.apiKey] API 金鑰 (選填)
     * @param {number} [config.temperature] 溫度參數，預設 0.7
     */
    constructor(config = {}) {
        this.apiUrl = config.apiUrl || 'http://localhost:1234/v1/chat/completions';
        this.modelId = config.modelId || 'local-model';
        this.apiKey = config.apiKey || '';
        this.temperature = config.temperature !== undefined ? config.temperature : 0.1;
    }

    /**
     * 向 LM Studio 發送非同步請求以取得 AI 下一步決策
     * @param {Object} gameState 當前遊戲狀態局勢
     * @returns {Promise<Object>} 包含 actionType, cardsPlayed, trashTalk 的 JSON 物件
     */
    async fetchAiMove(gameState) {
        try {
            const userPrompt = JSON.stringify(gameState, null, 2);
            const headers = {
                'Content-Type': 'application/json'
            };

            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            // 實施模型名稱自動偵測，避免因為傳入空字串或不正確的 local-model 導致 400 錯誤
            let activeModel = this.modelId;
            if (!activeModel || activeModel === 'local-model') {
                try {
                    const urlObj = new URL(this.apiUrl);
                    const modelsUrl = `${urlObj.protocol}//${urlObj.host}/v1/models`;
                    const detectHeaders = {};
                    if (this.apiKey) {
                        detectHeaders['Authorization'] = `Bearer ${this.apiKey}`;
                    }
                    const modelRes = await fetch(modelsUrl, { headers: detectHeaders });
                    if (modelRes.ok) {
                        const modelData = await modelRes.json();
                        if (modelData && modelData.data && modelData.data.length > 0) {
                            activeModel = modelData.data[0].id;
                            console.log(`[LmStudioAiService] 自動偵測到伺服器載入的模型為: ${activeModel}`);
                        }
                    }
                } catch (e) {
                    console.warn("[LmStudioAiService] 模型自動偵測失敗:", e);
                }
            }
            if (!activeModel) activeModel = "local-model";

            let finalSystemPrompt = SYSTEM_PROMPT;
            let finalUserPrompt = `當前的遊戲局勢如下，請做出決策：\n${userPrompt}`;

            // 如果帶有預先生成的 Prompt（舊方法相容，節省 Token 並傳遞完整戰術）
            if (gameState.systemPrompt && gameState.userPrompt) {
                finalSystemPrompt = gameState.systemPrompt;
                finalUserPrompt = gameState.userPrompt;
            }

            const reqBody = {
                model: activeModel,
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
            };

            // 只有在支援 json_object 的情況下才帶入參數
            if (supportsJsonObject) {
                reqBody.response_format = { type: "json_object" };
            }

            let response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(reqBody)
            });

            // 智能降級：如果回傳 400 Bad Request，可能是因為本地模型/伺服器不支援 response_format
            if (response.status === 400 && supportsJsonObject) {
                const errBody = await response.text();
                console.warn(`[LmStudioAiService] API 回傳 400，詳細錯誤訊息: ${errBody}`);
                console.warn('自動將後續請求降級，關閉 response_format 重新發送請求...');
                supportsJsonObject = false;
                delete reqBody.response_format;
                response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(reqBody)
                });
            }

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`LM Studio API 回傳錯誤狀態碼: ${response.status}. 錯誤詳情: ${errBody}`);
            }

            const result = await response.json();
            let content = result.choices[0].message.content.trim();
            
            // 當未使用 response_format 時，AI 有可能回傳包含 ```json 的 Markdown 標記，在此進行清理與兼容解析
            if (content.startsWith('```')) {
                content = content.replace(/```json/g, '').replace(/```/g, '').trim();
            }

            let parsedResult;
            try {
                parsedResult = JSON.parse(content);
            } catch (jsonErr) {
                console.warn('[LmStudioAiService] JSON 解析失敗，原始回傳內容為:', content);
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
            console.error('[LmStudioAiService] 決策請求失敗:', error);
            // 丟出錯誤交由呼叫端 (ai.js) 降級為電腦玩家決策方法處理，避免強制 Pass
            throw error;
        }
    }
}

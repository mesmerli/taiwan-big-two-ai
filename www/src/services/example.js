/**
 * example.js - 示範如何初始化 AiServiceFactory 與調用 AI 服務的範例程式碼
 */

import { AiServiceFactory } from './AiServiceFactory.js';

// 模擬遊戲狀態 (gameState)
const mockGameState = {
    playerIndex: 1,
    playerNames: ["玩家1 (你)", "AI阿德 (本機)", "AI小莉", "AI阿豪"],
    hand: ["3C", "4D", "8H", "10S", "JD", "QS", "KS", "AS", "2H"], // 當前手牌
    lastPlay: ["3S"], // 桌面上一手玩家出的牌
    lastPlayerIndex: 0, // 上一手出牌者的索引
    players: [
        { length: 8 }, // 玩家1剩餘張數
        { length: 9 }, // AI阿德剩餘張數
        { length: 13 },
        { length: 13 }
    ]
};

/**
 * 範例函式：啟動並測試 AI 服務
 * @param {boolean} useLocal 是否要強制使用本地 WebGPU WebLLM 模式
 */
async function runExample(useLocal = true) {
    console.log(`\n--- 開始運行大老二 AI 服務示範 (模式: ${useLocal ? "本地 WebGPU" : "LM Studio"}) ---`);

    // 1. 透過 Factory 建立服務實例
    const aiService = AiServiceFactory.createService({
        useLocalWebGPU: useLocal,
        modelId: useLocal ? 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC' : 'local-model',
        apiUrl: 'http://localhost:1234/v1/chat/completions', // 當降級或非 WebGPU 模式時的連線端點
        workerPath: '../aiWorker.js', // 指向相對於本檔案或 HTML 的 Worker 路徑
        
        // 2. 實作進度監聽
        initProgressCallback: (progressInfo) => {
            console.log(`[模型載入進度] ${progressInfo.percent}% - ${progressInfo.text}`);
            
            // 在實際 UI 中，您可以這樣更新畫面：
            // const progressBar = document.getElementById('progress-bar');
            // if (progressBar) progressBar.style.width = `${progressInfo.percent}%`;
            // const statusText = document.getElementById('status-text');
            // if (statusText) statusText.textContent = progressInfo.text;
        }
    });

    // 說明目前確切運作的服務類型
    console.log(`目前啟用的服務類別: ${aiService.constructor.name}`);

    // 如果是 WebLLM 服務，先手動初始化以觸發下載/載入並觀察 progress callback
    if (aiService.constructor.name === 'WebLlmAiService') {
        console.log('偵測到 WebLlmAiService，開始下載與載入本地 AI 模型（首次載入需時較長）...');
        await aiService.init();
    }

    // 3. 呼叫 fetchAiMove 取得出牌決策
    console.log('正在為當前局勢取得 AI 決策...');
    console.log('GameState:', JSON.stringify(mockGameState, null, 2));
    
    const decision = await aiService.fetchAiMove(mockGameState);

    console.log('\n========= AI 決策結果 =========');
    console.log(`動作類型 (actionType): ${decision.actionType}`);
    console.log(`出牌內容 (cardsPlayed): [${decision.cardsPlayed.join(', ')}]`);
    console.log(`台味垃圾話 (trashTalk): "${decision.trashTalk}"`);
    console.log('================================');
}

// 執行示範：
// 1. 優先嘗試 WebGPU (若系統不支援會安全降級為 LM Studio)
runExample(true).catch(err => {
    console.error("範例執行過程中出錯:", err);
});

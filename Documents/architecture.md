# 程式碼架構說明 (Architecture)

本專案「Taiwan Big2 AI」採用跨平台架構，核心為基於 Web 技術 (HTML/CSS/JS) 所開發的前端應用，並透過不同的封裝技術發佈至多個平台（包含 Electron、Tauri 以及 Android Capacitor）。

## 專案目錄結構

```text
TwBig2/
├── main.js                  # Electron 主進程 (Main Process) 進入點
├── index.html               # 遊戲前端主要畫面
├── about.html               # 「關於」原生獨立子視窗 HTML
├── src/ / www/src/          # 前端核心邏輯與樣式
│   ├── renderer.js          # UI 互動、DOM 操作、事件綁定與跨平台橋接
│   ├── gameLogic.js         # 台灣大老二核心遊戲邏輯 (發牌、牌型判定、勝負計算)
│   ├── ai/                  # [MODULAR] AI 決策與大模型玩家邏輯目錄
│   │   ├── AICharacter.js   # 基礎 AI 角色與決策框架
│   │   ├── HeuristicAI.js   # 傳統規則型電腦玩家 (Alex, Bella, Chris)
│   │   ├── BaseLLMAI.js     # 大模型 (LLM) 玩家基底與 Prompt/記憶模組
│   │   ├── LLMCharacters.js # 具體大模型對手 (Diana, Ares)
│   │   └── BigTwoAI.js      # AI 引擎管理器與全域 window.AI 註冊
│   ├── controllers/         # [MODULAR] 控制器層 (Game, Settings, Keyboard, AISummary)
│   │   ├── GameController.js
│   │   ├── KeyboardController.js
│   │   ├── SettingsController.js
│   │   └── AISummaryController.js
│   ├── views/               # [MODULAR] 視圖渲染層 (Game, WebLlmCache, AISummary)
│   │   ├── GameView.js
│   │   ├── WebLlmCacheView.js
│   │   └── AISummaryView.js
│   ├── audio.js             # 遊戲音效播放與管理
│   ├── env.js               # 環境變數與跨平台狀態封裝
│   ├── i18n.js              # 多國語系 (國際化) 支援
│   ├── services/            # 外部服務或特定功能模組化 (WebLlmCacheManager, SystemService 等)
│   └── styles.css           # 遊戲前端版面樣式 (支援 RWD，含行動端特製版面)
├── src-tauri/               # Tauri 原生後端層 (Rust)，提供輕量級桌面應用封裝
│   ├── src/lib.rs           # Rust 進入點、跨平台 API 命令、原生 Windows Jump List 與單例生命週期控制
│   ├── capabilities/        # Tauri v2 細粒度權限定義檔 (如 `default.json` 設定視窗管理與對話盒權限)
│   └── tauri.conf.json      # Tauri 專屬設定檔
├── android/                 # Capacitor Android 專案，用於打包手機版 APP
├── StoreBridge/             # 原生 C++ 擴充模組，用於整合 Windows Store 的授權與購買
├── tests/                   # 測試模組
│   ├── logic.test.js        # 針對 gameLogic.js 的核心單元測試
│   └── ui.test.js           # 基於 Playwright 的 E2E UI 測試
├── package.json             # Node.js 專案設定檔與依賴管理
└── tauri.conf.json          # Tauri 專屬設定檔
```

## 系統層級與模組說明

### 1. 跨平台封裝層 (Wrappers)
為了讓同一套前端網頁可以在多個平台上原生運行，專案使用了以下封裝技術：
*   **Electron** (`main.js`): 主要的桌面版引擎。負責視窗建立、系統選單、與 `StoreBridge` 原生模組溝通，並將其透過 IPC (Inter-Process Communication) 暴露給前端 `renderer.js` 使用。支援打包發佈至 Microsoft Store。
*   **Tauri** (`src-tauri`): 提供一個更輕量化、佔用記憶體更小的桌面端替代方案，底層依賴作業系統自帶的 WebView (如 WebView2、WebKit) 來渲染網頁。後端在 Windows 上透過 Rust 調用 Win32 COM APIs 註冊工作列右鍵任務（Jump List / User Tasks），並利用 `capabilities` 結構對對話盒、視窗等特定接口進行細粒度權限控制。
*   **Capacitor** (`android/`): 將前端網頁包裝成 Android 原生 APP。它透過 `capacitor.config.json` 設定，將 `www` 資料夾內的資源直接作為 APP 介面，並可調用原生 API (例如全螢幕、震動等)。

### 2. 前端展示與控制層 (UI / Presentation)
本專案前端採用了 MVC (Model-View-Controller) 架構，將 UI 互動與對局流程拆分為控制層 (Controllers) 與視圖層 (Views)：

*   **全域入口與事件綁定**：
    *   `index.html` 與 `styles.css`：構成整個遊戲介面。CSS 內包含針對桌面端與行動端直式版面 (`.mobile-layout`) 的 RWD 排版設計。
    *   `renderer.js`：前端的主要進入點與事件監聽綁定器，負責協調各子控制器（例如初始化各控制器、向視圖傳遞資料以及動態載入 WebLlmCacheView）。

*   **控制器層 (Controllers)**：
    *   `src/controllers/GameController.js`：
        *   **職責**：主控遊戲的生命週期與狀態機（如發牌、出牌、過牌、勝負判定與計分）。
        *   **關鍵功能**：
            *   `initGame()`：初始化牌局，洗牌並分發手牌，判定首輪出牌玩家（持有梅花3），並檢查起手是否為「一條龍」。
            *   `playCards()` & `executePlay()`：處理玩家與 AI 出牌的執行、合法性檢查（透過 `GameLogic`）與出牌後的狀態轉移。
            *   `passTurn()` & `nextTurn()`：協調玩家與 AI 的過牌與回合切換。
            *   `calculateScores()`：在牌局結束時根據剩餘張數、怪物牌型（如鐵支、同花順）與大牌倍率計算各玩家的得分。
            *   `shoutLa()` & `updateShoutButton()`：控制大老二特有的「喊拉」規則。
    *   `src/controllers/KeyboardController.js`：
        *   **職責**：管理與實作遊戲內的鍵盤熱鍵操作，提供無滑鼠輔助的流暢體驗。
        *   **關鍵功能**：
            *   左右方向鍵（`ArrowLeft` / `ArrowRight`）：在玩家手牌中進行循環選牌。
            *   上方向鍵（`ArrowUp`）：彈起/出牌或執行拉牌判定。
            *   下方向鍵（`ArrowDown`）：降下/清除目前選取的卡牌；快速連按三次下鍵可快速重開新局。
            *   空白鍵（`Space`）：快速執行過牌（Pass）。
    *   `src/controllers/SettingsController.js`：
        *   **職責**：管理遊戲設定，包括多國語系切換、音效與靜音設定，以及大語言模型 (LLM) 的 API 配置。
        *   **關鍵功能**：
            *   語系與音效管理：串接 `i18n.js` 與 `AudioPlayer`，讀寫本地儲存空間 (`AppStorage`) 狀態，即時切換介面語系與控制靜音。
            *   LLM 設定面板：處理 API 金鑰、自訂主機網址（Endpoint）與模型選擇的變更儲存，並觸發介面重新渲染。
    *   `src/controllers/AISummaryController.js`：
        *   **職責**：負責牌局結束後 AI 戰術復盤（AI Review）的核心業務邏輯與 API 互動。
        *   **關鍵功能**：
            *   `showSummary()`：於對局結束時收集 `gameState` 與完整出牌歷程 (`gameLog`)，準備復盤資料。
            *   連線與拉取：自動檢測本地 WebLLM 或雲端 OpenAI API 連線狀態，動態拉取可用模型清單。
            *   Prompt 生成與問答：建構包含出牌行為、勝負原因與改進建議的 Prompt，發送至 LLM 服務；同時提供聊天室介面，管理玩家與 AI 的串流 Q&A 即時問答對話歷程。

*   **視圖渲染層 (Views)**：
    *   `src/views/GameView.js`：
        *   **職責**：專責遊戲桌面的 DOM 元素繪製與動畫呈現，將 `gameState` 的資料視覺化。
        *   **關鍵功能**：
            *   `renderAll()`：重繪所有玩家的手牌、桌面已出牌插槽、玩家狀態與頭像。
            *   手牌動畫：處理卡牌選取時的彈起/降下效果，並依照出牌狀態調整縮放與旋轉。
            *   狀態提示：繪製出牌者的對話泡泡、過牌（Pass）指示器、拉牌特效，以及更新出牌與喊拉按鈕的顯示狀態。
    *   `src/views/AISummaryView.js`：
        *   **職責**：渲染賽後 AI 戰術復盤面板、統計數據與即時聊天互動介面。
        *   **關鍵功能**：
            *   `renderSummaryPanel()` & `showSummary()`：繪製復盤彈出視窗、統計卡片（剩餘張數、總得分倍率）。
            *   打字機逐字特效（Typewriter Effect）：以平滑的逐字動畫渲染 AI 的戰術總結，增強視覺質感。
            *   對話聊天室：繪製 AI 聊天室的對話紀錄，並提供 CORS 跨網域警告提示、連線進度條與輸入框捲動定位。
    *   `src/views/WebLlmCacheView.js`：
        *   **職責**：負責將本地 WebLLM (WebGPU) 下載的模型快取清單與下載進度呈現在管理面板中。
        *   **關鍵功能**：
            *   下載進度條：動態更新下載進度百分比與快取大小。
            *   模型快取管理：列出已下載的 WebGPU 模型檔案，並提供「清除快取」按鈕與二次確認對話盒，幫助使用者釋放硬碟空間。

### 3. 核心邏輯層 (Core Logic)
*   `gameLogic.js`: 完全獨立於 UI 的純邏輯模組 (Pure JS)。負責台灣大老二核心規則之實作與判定：
    *   **卡牌解析與比較**：藉由卡牌 ID 解析點數 (3 最小，2 最大) 與花色 (梅花 < 方塊 < 紅心 < 黑桃)，並提供手牌排序。
    *   **牌型識別與比牌**：判定單張、對子、順子、同花順、鐵支、葫蘆以及特有的一條龍。實作了特殊順子 (如最大的 2-3-4-5-6 與最小的 A-2-3-4-5) 與怪物牌 (Bombs) 越級比牌邏輯。
    *   **合法出牌選單計算**：提供 `getLegalMoves()` 計算當前合法出牌組合，並處理「喊拉（Shout LA）」玩家一次出完最後一手或被迫過牌之限制。
    *   **自動過牌判定**：提供 `hasValidMoves()` 檢查玩家是否可接牌，以便輔助 UI 自動 Pass。
    *   *獨立設計使其可由單一腳本獨立進行單元測試 (`logic.test.js`)。*
*   `src/ai/`：電腦玩家與大模型 AI 的決策引擎核心。
    *   `src/ai/AICharacter.js`：
        *   **職責**：定義電腦玩家角色的基礎屬性與個性配置（包括頭像、大頭貼、開局招呼語、勝利與失敗宣示、及專屬 Prompt 指引）。
        *   **關鍵功能**：內建多個不同性格的電腦對手（例如 Heuristic 陣營的艾力克斯、貝拉，以及 LLM 陣營的戴安娜與阿瑞斯），提供不同難度與台味垃圾話風格的對話指令。
    *   `src/ai/HeuristicAI.js`：
        *   **職責**：基於傳統啟發式規則的出牌決策器。
        *   **關鍵功能**：實作快速判定出牌策略的演算法。當需要跟牌時，會從當前合法牌組中挑選最小且合適的牌組出牌；當主動出牌時，會優先出最小的單張、對子或五張牌型，以實現經典的快速電腦玩家。
    *   `src/ai/BaseLLMAI.js`：
        *   **職責**：連接大語言模型的基礎類別，負責遊戲局勢編碼與 Prompt 模組建構。
        *   **關鍵功能**：
            *   狀態序列化：將目前的手牌、桌面上一手牌、所有玩家的剩餘張數、歷史出牌紀錄（`gameLog`）編碼成結構化且易於模型理解的 JSON Prompt。
            *   記憶管理：維護一定的對局記憶視窗，以實現模型在垃圾話中展現「記仇」或「挑釁」等動態反應。
            *   降級機制：當模型輸出格式錯誤、逾時或無法給出合法出牌時，自動調用 `HeuristicAI` 進行安全出牌。
    *   `src/ai/LLMCharacters.js`：
        *   **職責**：客製化大型語言模型電腦角色的細部 Prompt 指引與決策參數。
    *   `src/ai/BigTwoAI.js`：
        *   **職責**：AI 決策的統一協調器與管理器（註冊於全域 `window.AI`）。
        *   **關鍵功能**：
            *   `findPlay(playerIndex, context)`：根據玩家索引判斷該玩家是使用傳統規則（Heuristic）還是大模型（LLM），並調用對應的決策模組。
            *   `postGameReflection()`：在牌局結束時，發送整局的歷史紀錄給 LLM 進行戰術自我檢討與反思。

### 4. 服務與基礎設施層 (Services & Infrastructure)
此層面集中管理專案所依賴的外部 API、本地 AI 推理、硬體加速快取及跨平台系統底層 API 橋接：

*   `src/services/AiServiceFactory.js`：
    *   **職責**：AI 服務實例的工廠類別。
    *   **關鍵功能**：依據設定參數（如 `useLocalWebGPU`）與系統硬體相容性，動態實例化並返回 `WebLlmAiService` (本地 WebGPU) 或 `LmStudioAiService` (相容 OpenAI 接口的本地/雲端 API 服務)。
*   `src/services/WebLlmAiService.js`：
    *   **職責**：基於 WebLLM 框架，利用 WebGPU 在網頁瀏覽器內實現純本地的 AI 推理服務。
    *   **關鍵功能**：
        *   `init()`：啟動並載入大語言模型，並透過 Web Worker (`aiWorker.js`) 將高負載的推理運算移出主要渲染線程，確保遊戲畫面流暢不卡頓。
        *   出牌決策與戰術分析：向模型發送結構化 System Prompt，獲取 JSON 格式的出牌判定與語意垃圾話。
*   `src/services/LmStudioAiService.js`：
    *   **職責**：負責對接外部 OpenAI 相容介面（如本地運行的 LM Studio、Ollama，或雲端 OpenAI 服務）。
    *   **關鍵功能**：將對局狀態包裝成 Chat Completion 請求，處理遠端串流（Streaming）回應或結構化輸出 JSON 回傳。
*   `src/services/WebLlmCacheManager.js`：
    *   **職責**：管理本地 WebGPU 模型的快取檔案。
    *   **關鍵功能**：透過瀏覽器的 Cache Storage API 查詢已下載的模型檔案清單、估算所佔用的硬碟容量，並提供一鍵刪除與清空快取的清理工具，防止瀏覽器快取爆滿。
*   `src/services/aiWorker.js`：
    *   **職責**：WebLLM 的背景工作線程（Web Worker）。
    *   **關鍵功能**：接收來自主線程的載入與推理請求，在背景獨立執行重度 WebGPU 計算，完成後將結果回傳主線程。
*   `src/services/licenseService.js`：
    *   **職責**：處理 Electron 版本之軟體授權、試用期管理與付費升級驗證。
    *   **關鍵功能**：讀寫加密的本地授權資訊，計算 15 天試用期剩餘天數，並與原生 Windows Store Bridge 模組交互驗證應用程式之真實購買狀態。
*   `src/services/systemService.js`：
    *   **職責**：封裝底層平台（Electron、Tauri、Android Capacitor、網頁版）的系統級 API 差異。
    *   **關鍵功能**：封裝視窗關閉、跳轉、關於視窗開啟、跳轉外部瀏覽器、檔案目錄存取等原生指令，確保上層代碼無需關心運行於何種封裝容器中。
*   `src/services/sharedPrompt.js`：
    *   **職責**：存放所有 AI 角色共用的系統 Prompt 樣板、賽後復盤分析引導語以及 API 模型對局資料規範。
*   `src/services/example.js`：
    *   **職責**：整合範例代碼，展示如何獨立初始化 `AiServiceFactory`、綁定載入進度回呼，並向 AI 發送模擬對局資料進行決策。

### 5. 原生互動模組 (Native Addon)
*   `StoreBridge`: 使用 C++ 開發並透過 `node-addon-api` 包裝成 Node.js 模組。主要用途是在 Electron 版上架到 Windows Store 時，可以直接與 Windows 原生 API 溝通，判斷玩家目前使用的是「試用版」還是已經購買的「正式版」，並可以觸發內購 (In-App Purchase) 的對話框。

## 運行流程概述
1.  **啟動**: 依賴所選平台 (Electron、Tauri 或 Capacitor)，對應的宿主環境會啟動並載入 `index.html`。在 Tauri Windows 環境下，會動態註冊原生 Jump List 右鍵選單，若由該選單（帶 `--about` 參數）喚起，則直接靜默引導至無閃爍的獨立「關於」視窗。
2.  **初始化**: `renderer.js` 會被載入，初始化 `gameLogic.js` 與 `src/ai/` 引擎（註冊 `window.AI`），並綁定所有按鈕與鍵盤事件，載入多國語系 (`i18n.js`)。
3.  **遊戲循環**: 使用者點擊出牌 -> `renderer.js` 呼叫 `gameLogic.js` 驗證 -> 若合法則更新 UI -> 通知 `window.AI` 讓下一位電腦玩家出牌 -> 輪迴直到有人脫手。
4.  **牌局結束**: 當產生贏家後，`AISummaryController` 會自動彈出復盤視窗，配合 `AISummaryView` 調用大模型 API 渲染 AI 戰術講評。
5.  **跨平台功能**: 若點選「升級完整版」，`renderer.js` 透過 `env.js` 或 IPC 向宿主請求處理，如果是 Electron 則觸發 `StoreBridge` 呼叫 Windows API；若是其他平台則觸發對應的原生機制。此外，主視窗被關閉時，後端會主動監聽銷毀事件並呼叫程序退出程序，防止殘留子視窗。

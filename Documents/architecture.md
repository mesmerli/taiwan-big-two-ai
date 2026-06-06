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
*   `index.html` 與 `styles.css`: 構成整個遊戲的桌面。CSS 內包含針對桌面端 (寬度大於 900px) 與行動端 (手機直式) 的不同排版設計 (`.mobile-layout`)。
*   `renderer.js`: 這是前端的靈魂，負責傾聽使用者的點擊、拖曳、選牌等行為，並與 `gameLogic.js` 溝通以取得目前牌局狀態，隨後操作 DOM 元素更新畫面。同時，`renderer.js` 也要負責偵測當前的執行環境 (Electron、Tauri 或網頁)，決定如何呼叫系統級別 API (例如跳出 Windows Store 的購買視窗)。
*   `AISummaryController.js` & `AISummaryView.js`: 局後 AI 戰術復盤模組。當遊戲結束後，負責向本機/雲端 LLM 接口發送串流文字請求（Streaming），動態顯示戰術回饋與評分，並支援即時對談問答。

### 3. 核心邏輯層 (Core Logic)
*   `gameLogic.js`: 完全獨立於 UI 的純邏輯模組 (Pure JS)。負責台灣大老二核心規則之實作與判定：
    *   **卡牌解析與比較**：藉由卡牌 ID 解析點數 (3 最小，2 最大) 與花色 (梅花 < 方塊 < 紅心 < 黑桃)，並提供手牌排序。
    *   **牌型識別與比牌**：判定單張、對子、順子、同花順、鐵支、葫蘆以及特有的一條龍。實作了特殊順子 (如最大的 2-3-4-5-6 與最小的 A-2-3-4-5) 與怪物牌 (Bombs) 越級比牌邏輯。
    *   **合法出牌選單計算**：提供 `getLegalMoves()` 計算當前合法出牌組合，並處理「喊拉（Shout LA）」玩家一次出完最後一手或被迫過牌之限制。
    *   **自動過牌判定**：提供 `hasValidMoves()` 檢查玩家是否可接牌，以便輔助 UI 自動 Pass。
    *   *獨立設計使其可由單一腳本獨立進行單元測試 (`logic.test.js`)。*
*   `src/ai/`: 處理電腦玩家 (NPC/LLM) 的出牌策略。專案主打「LLM-powered AI integration」，此目錄拆分為基礎類別 (`AICharacter`)、傳統規則 NPC (`HeuristicAI`)、大模型 AI 基礎 (`BaseLLMAI`)、具體大模型角色 (`LLMCharacters`) 以及引擎管理器 (`BigTwoAI`)。

### 4. 原生互動模組 (Native Addon)
*   `StoreBridge`: 使用 C++ 開發並透過 `node-addon-api` 包裝成 Node.js 模組。主要用途是在 Electron 版上架到 Windows Store 時，可以直接與 Windows 原生 API 溝通，判斷玩家目前使用的是「試用版」還是已經購買的「正式版」，並可以觸發內購 (In-App Purchase) 的對話框。

## 運行流程概述
1.  **啟動**: 依賴所選平台 (Electron、Tauri 或 Capacitor)，對應的宿主環境會啟動並載入 `index.html`。在 Tauri Windows 環境下，會動態註冊原生 Jump List 右鍵選單，若由該選單（帶 `--about` 參數）喚起，則直接靜默引導至無閃爍的獨立「關於」視窗。
2.  **初始化**: `renderer.js` 會被載入，初始化 `gameLogic.js` 與 `src/ai/` 引擎（註冊 `window.AI`），並綁定所有按鈕與鍵盤事件，載入多國語系 (`i18n.js`)。
3.  **遊戲循環**: 使用者點擊出牌 -> `renderer.js` 呼叫 `gameLogic.js` 驗證 -> 若合法則更新 UI -> 通知 `window.AI` 讓下一位電腦玩家出牌 -> 輪迴直到有人脫手。
4.  **牌局結束**: 當產生贏家後，`AISummaryController` 會自動彈出復盤視窗，配合 `AISummaryView` 調用大模型 API 渲染 AI 戰術講評。
5.  **跨平台功能**: 若點選「升級完整版」，`renderer.js` 透過 `env.js` 或 IPC 向宿主請求處理，如果是 Electron 則觸發 `StoreBridge` 呼叫 Windows API；若是其他平台則觸發對應的原生機制。此外，主視窗被關閉時，後端會主動監聽銷毀事件並呼叫程序退出程序，防止殘留子視窗。

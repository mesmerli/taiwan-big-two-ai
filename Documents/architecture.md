# 程式碼架構說明 (Architecture)

本專案「Taiwan Big Two AI」採用跨平台架構，核心為基於 Web 技術 (HTML/CSS/JS) 所開發的前端應用，並透過不同的封裝技術發佈至多個平台（包含 Electron、Tauri 以及 Android Capacitor）。

## 專案目錄結構

```text
TwBig2/
├── main.js                  # Electron 主進程 (Main Process) 進入點
├── index.html               # 遊戲前端主要畫面
├── src/ / www/src/          # 前端核心邏輯與樣式
│   ├── renderer.js          # UI 互動、DOM 操作、事件綁定與跨平台橋接
│   ├── gameLogic.js         # 台灣大老二核心遊戲邏輯 (發牌、牌型判定、勝負計算)
│   ├── ai.js                # AI 決策邏輯 (包含整合 LLM API 進行出牌推演)
│   ├── audio.js             # 遊戲音效播放與管理
│   ├── env.js               # 環境變數與跨平台狀態封裝
│   ├── i18n.js              # 多國語系 (國際化) 支援
│   ├── services/            # 外部服務或特定功能模組化
│   └── styles.css           # 遊戲前端版面樣式 (支援 RWD，含行動端特製版面)
├── src-tauri/               # Tauri 原生後端層 (Rust)，提供輕量級桌面應用封裝
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
*   **Tauri** (`src-tauri`): 提供一個更輕量化、佔用記憶體更小的桌面端替代方案，底層依賴作業系統自帶的 WebView (如 WebView2、WebKit) 來渲染網頁。
*   **Capacitor** (`android/`): 將前端網頁包裝成 Android 原生 APP。它透過 `capacitor.config.json` 設定，將 `www` 資料夾內的資源直接作為 APP 介面，並可調用原生 API (例如全螢幕、震動等)。

### 2. 前端展示與控制層 (UI / Presentation)
*   `index.html` 與 `styles.css`: 構成整個遊戲的桌面。CSS 內包含針對桌面端 (寬度大於 900px) 與行動端 (手機直式) 的不同排版設計 (`.mobile-layout`)。
*   `renderer.js`: 這是前端的靈魂，負責傾聽使用者的點擊、拖曳、選牌等行為，並與 `gameLogic.js` 溝通以取得目前牌局狀態，隨後操作 DOM 元素更新畫面。同時，`renderer.js` 也要負責偵測當前的執行環境 (Electron、Tauri 或網頁)，決定如何呼叫系統級別 API (例如跳出 Windows Store 的購買視窗)。

### 3. 核心邏輯層 (Core Logic)
*   `gameLogic.js`: 完全獨立於 UI 的純邏輯模組 (Pure JS)。裡面包含了洗牌、發牌、台灣大老二特有的牌型判斷 (單張、對子、順子、同花順、鐵支等) 以及決定下一位玩家等功能。獨立的設計使其可以被輕易地撰寫自動化單元測試 (`logic.test.js`)。
*   `ai.js`: 處理電腦玩家 (NPC) 的出牌策略。本專案主打「LLM-powered AI integration」，此檔案中包含了將目前牌局狀態結構化、發送至大語言模型 API 以取得出牌決策，或是使用傳統演算法作為備用方案的實作。

### 4. 原生互動模組 (Native Addon)
*   `StoreBridge`: 使用 C++ 開發並透過 `node-addon-api` 包裝成 Node.js 模組。主要用途是在 Electron 版上架到 Windows Store 時，可以直接與 Windows 原生 API 溝通，判斷玩家目前使用的是「試用版」還是已經購買的「正式版」，並可以觸發內購 (In-App Purchase) 的對話框。

## 運行流程概述
1.  **啟動**: 依賴所選平台 (Electron、Tauri 或 Capacitor)，對應的宿主環境會啟動並載入 `index.html`。
2.  **初始化**: `renderer.js` 會被載入，初始化 `gameLogic.js` 與 `ai.js`，並綁定所有按鈕與鍵盤事件，載入多國語系 (`i18n.js`)。
3.  **遊戲循環**: 使用者點擊出牌 -> `renderer.js` 呼叫 `gameLogic.js` 驗證 -> 若合法則更新 UI -> 通知 `ai.js` 讓下一位電腦玩家出牌 -> 輪迴直到有人脫手。
4.  **跨平台功能**: 若點選「升級完整版」，`renderer.js` 透過 `env.js` 或 IPC 向宿主請求處理，如果是 Electron 則觸發 `StoreBridge` 呼叫 Windows API；若是其他平台則觸發對應的原生機制。

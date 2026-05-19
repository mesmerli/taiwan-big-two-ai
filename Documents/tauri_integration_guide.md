# Tauri 跨平台整合與環境適配層 (Adapter Layer) 架構設計

本指南專為 **Taiwan Big Two AI** 專案設計，旨在建立一套優雅、低耦合的「環境偵測與功能適配層 (Adapter Layer)」。確保單一前端程式碼庫能同時在 **Web 瀏覽器**、**Electron 桌面端**、**Tauri 桌面端** 以及 **Capacitor 行動端 (Android)** 完美運行，並維持既有 API 的相容性與無痛轉換。

---

## 1. 建議目錄結構 (Directory Structure)

在引入 Tauri 後，專案的推薦目錄結構如下。我們將既有的環境邏輯與新設計的適配層模組化，並將 Tauri 的 Rust 核心配置放置於根目錄的 `src-tauri` 中：

```text
taiwan-big-two-ai/
├── .gemini/                    # AI 助理設定
├── src-tauri/                  # [NEW] Tauri 桌面端 Native 核心 (Rust)
│   ├── src/                    # Rust 主程式與 IPC Commands
│   ├── tauri.conf.json         # [NEW] Tauri 設定檔
│   └── Cargo.toml              # Rust 依賴管理
├── src/                        # 前端核心程式碼 (Vanilla JS / Assets)
│   ├── assets/                 # 靜態資源 (images, audio)
│   ├── services/               # [NEW] 服務適配層目錄
│   │   └── systemService.js    # [NEW] 關鍵適配器：處理檔案、外部連結等
│   ├── env.js                  # 環境偵測與統一 Storage
│   ├── ai.js                   # AI 決策大腦
│   ├── gameLogic.js            # 遊戲核心規則
│   ├── i18n.js                 # 多國語系支援
│   └── renderer.js             # UI 渲染與事件處理
├── www/                        # 用於 Capacitor/Cordova 的建置輸出或靜態目錄
├── index.html                  # 單頁應用入口
├── package.json                # NPM 依賴管理 (新增 Tauri CLI 與 API 支援)
└── vite.config.js              # [OPTIONAL] 未來若引入 Vite 的打包設定
```

---

## 2. 環境偵測機制增強 (Environment Detection)

我們需要擴充專案現有的 `src/env.js`，加入精準的 **Tauri** 偵測。Tauri 於前端環境的注入特徵包括：
* **不使用打包工具 (Vanilla + Global API)**：在 `tauri.conf.json` 開啟 `withGlobalTauri: true`，會在 `window` 注入 `__TAURI__` 與 `__TAURI_METADATA__`。
* **使用打包工具 (Vite + ESM)**：可透過 `window.__TAURI_INTERNALS__` 或 `window.__TAURI__` 來進行環境辨識。

請配合現有的 `src/env.js` 架構，將偵測邏輯升級如下：

### 🛠️ 修改 `src/env.js` (部分片段展示)

```javascript
/**
 * Taiwan Big Two AI - Environment & Storage Module
 * Supports Electron, Tauri, Android (Capacitor), and general web browsers.
 */

(function (global) {
    // 1. 偵測各平台環境
    const isElectron = typeof window !== 'undefined' && 
                       ((window.process && window.process.versions && !!window.process.versions.electron) || 
                        (navigator && navigator.userAgent && navigator.userAgent.includes('Electron')));

    const isTauri = typeof window !== 'undefined' && 
                    (window.__TAURI_METADATA__ !== undefined || 
                     window.__TAURI__ !== undefined || 
                     window.__TAURI_INTERNALS__ !== undefined);

    const isAndroid = typeof window !== 'undefined' && 
                      window.Capacitor && 
                      ((window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android') || 
                       window.Capacitor.platform === 'android');

    // 若皆非上述原生容器，則為標準純網頁瀏覽器
    const isBrowser = !isElectron && !isTauri && !isAndroid;

    const AppEnv = {
        isElectron,
        isTauri,
        isAndroid,
        isBrowser,
        getPlatformName() {
            if (isElectron) return 'Electron';
            if (isTauri) return 'Tauri';
            if (isAndroid) return 'Android (Capacitor)';
            return 'Browser';
        }
    };

    // 暴露全域變數
    global.AppEnv = AppEnv;
    
    // ... 原本的 AppStorage 邏輯保持 100% 不變，完美相容 ...
})(typeof window !== 'undefined' ? window : this);
```

---

## 3. 功能適配器設計 (`src/services/systemService.js`)

適配器層 (Adapter Layer) 旨在提供一個**介面一致、底層各自適配**的 API。對於 UI 而言，不論是在哪個環境下，呼叫方式都保持一致。

以下為關鍵適配器 `systemService.js` 的完整實現。本適配器支援 **ES Modules (Vite)** 與 **全域瀏覽器 Script 標籤** 雙模式載入，以無縫貼合專案現有架構：

```javascript
/**
 * System Service Adapter Layer
 * 統一封裝：檔案讀取 (ReadFile)、檔案寫入 (WriteFile)、外部連結開啟 (OpenExternal)
 * 相容：Tauri (v1/v2)、Electron、Capacitor、Web 瀏覽器
 */

(function (global) {
    
    /**
     * 輔助工具：安全獲取 Electron 的 ipcRenderer
     */
    function getElectronIpc() {
        if (typeof require !== 'undefined') {
            try {
                return require('electron').ipcRenderer;
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    const SystemService = {
        /**
         * 1. 外部連結開啟 (Open External Links)
         * @param {string} url - 目標 URL
         */
        async openExternal(url) {
            console.log(`[SystemService] Opening external link: ${url} on ${AppEnv.getPlatformName()}`);
            
            // A. Tauri 環境
            if (AppEnv.isTauri) {
                try {
                    // Tauri v1 API: window.__TAURI__.shell
                    // Tauri v2 API: window.__TAURI__.core / plugin-shell
                    if (window.__TAURI__ && window.__TAURI__.shell) {
                        await window.__TAURI__.shell.open(url);
                    } else if (window.__TAURI__ && window.__TAURI__.path) { // 預防 v2 全域注入結構
                        // v2 可使用全域 plugin 映射，或於 Rust 端處理
                        const { open } = window.__TAURI__.shell;
                        await open(url);
                    } else {
                        // 若無全域 API，嘗試使用標準前端 fallback
                        window.open(url, '_blank', 'noopener,noreferrer');
                    }
                } catch (e) {
                    console.error("[Tauri] Shell open failed, falling back to window.open", e);
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
                return;
            }

            // B. Electron 環境
            if (AppEnv.isElectron) {
                try {
                    const { shell } = require('electron');
                    shell.openExternal(url);
                } catch (e) {
                    console.error("[Electron] Shell open failed", e);
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
                return;
            }

            // C. Capacitor (Android) 環境
            if (AppEnv.isAndroid && window.Capacitor && window.Capacitor.Plugins.Browser) {
                try {
                    await window.Capacitor.Plugins.Browser.open({ url });
                } catch (e) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
                return;
            }

            // D. 標準瀏覽器環境 (Web)
            window.open(url, '_blank', 'noopener,noreferrer');
        },

        /**
         * 2. 統一檔案寫入/匯出 (Write & Export File)
         * @param {string} defaultFilename - 預設檔案名稱
         * @param {object|string} data - 要寫入的資料 (對象或字串)
         */
        async writeFile(defaultFilename, data) {
            const contentString = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
            
            // A. Tauri 環境：直接開啟 Native「儲存檔案」對話框寫入硬碟
            if (AppEnv.isTauri) {
                try {
                    const { dialog, fs } = window.__TAURI__;
                    // 開啟儲存路徑選擇器
                    const savePath = await dialog.save({
                        defaultPath: defaultFilename,
                        filters: [{ name: 'JSON Data', extensions: ['json'] }]
                    });

                    if (savePath) {
                        // 支援 Tauri v1/v2 的寫檔 API
                        if (typeof fs.writeFile === 'function') {
                            await fs.writeFile({ path: savePath, contents: contentString });
                        } else if (typeof fs.writeTextFile === 'function') {
                            await fs.writeTextFile(savePath, contentString);
                        }
                        return { success: true, path: savePath };
                    }
                    return { success: false, reason: 'cancelled' };
                } catch (e) {
                    console.error("[Tauri] WriteFile failed, falling back to Web download", e);
                }
            }

            // B. Electron 環境：經由 IPC 傳送至 Main Process 寫入 (配合安全實踐)
            if (AppEnv.isElectron) {
                const ipc = getElectronIpc();
                if (ipc) {
                    try {
                        const result = await ipc.invoke('save-file-dialog', {
                            defaultFilename,
                            content: contentString
                        });
                        return result; // 預期回傳 { success: true, path } 或 { success: false }
                    } catch (e) {
                        console.error("[Electron] IPC WriteFile failed, using fallback", e);
                    }
                }
            }

            // C. 網頁端/行動端相容 (Browser / Capacitor Web)
            // 透過 Blob 觸發瀏覽器下載
            try {
                const blob = new Blob([contentString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = defaultFilename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                return { success: true, type: 'download' };
            } catch (e) {
                console.error("[Browser] File download failed", e);
                throw e;
            }
        },

        /**
         * 3. 統一檔案讀取/匯入 (Read & Import File)
         * @param {object} options - 讀取選項 (例如 { accept: '.json' })
         * @returns {Promise<object>} - 解析後的文件內容 JSON 物件或字串
         */
        async readFile(options = { accept: '.json' }) {
            // A. Tauri 環境：直接開啟 Native「選取檔案」對話框並讀取
            if (AppEnv.isTauri) {
                try {
                    const { dialog, fs } = window.__TAURI__;
                    const selectedPath = await dialog.open({
                        multiple: false,
                        filters: [{ name: 'JSON Data', extensions: ['json'] }]
                    });

                    if (selectedPath && !Array.isArray(selectedPath)) {
                        let content = '';
                        if (typeof fs.readTextFile === 'function') {
                            content = await fs.readTextFile(selectedPath);
                        } else if (typeof fs.readFile === 'function') {
                            // 部分 Tauri 配置會讀取為 Uint8Array，需進行轉換
                            const bytes = await fs.readFile(selectedPath);
                            content = new TextDecoder().decode(bytes);
                        }
                        
                        return { 
                            success: true, 
                            data: JSON.parse(content), 
                            filename: selectedPath 
                        };
                    }
                    return { success: false, reason: 'cancelled' };
                } catch (e) {
                    console.error("[Tauri] ReadFile failed, falling back to browser selector", e);
                }
            }

            // B. Electron 環境：使用 IPC 呼叫 Main Process 開啟檔案並讀取
            if (AppEnv.isElectron) {
                const ipc = getElectronIpc();
                if (ipc) {
                    try {
                        const result = await ipc.invoke('open-file-dialog', options);
                        if (result && result.success) {
                            return {
                                success: true,
                                data: JSON.parse(result.content),
                                filename: result.filename
                            };
                        }
                        return { success: false, reason: 'cancelled' };
                    } catch (e) {
                        console.error("[Electron] IPC ReadFile failed", e);
                    }
                }
            }

            // C. 網頁端/行動端相容 (Browser / Capacitor Web)
            // 動態創建 <input type="file">，引導用戶進行瀏覽器檔案選取
            return new Promise((resolve, reject) => {
                try {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = options.accept || '*';
                    input.style.display = 'none';

                    input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (!file) {
                            resolve({ success: false, reason: 'cancelled' });
                            return;
                        }

                        const reader = new FileReader();
                        reader.onload = (event) => {
                            try {
                                const parsedData = JSON.parse(event.target.result);
                                resolve({
                                    success: true,
                                    data: parsedData,
                                    filename: file.name
                                });
                            } catch (err) {
                                reject(new Error("Invalid JSON file format"));
                            }
                        };
                        reader.onerror = () => reject(new Error("File read error"));
                        reader.readAsText(file);
                    };

                    document.body.appendChild(input);
                    input.click();
                    document.body.removeChild(input);
                } catch (e) {
                    reject(e);
                }
            });
        }
    };

    // 暴露為全域變數 (相容非編譯 Vanilla JS 架構)
    global.SystemService = SystemService;

    // 若未來整合 ESM，同時支援 ES Module 的匯出
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SystemService;
    }
})(typeof window !== 'undefined' ? window : this);
```

---

## 4. UI 元件無感調用 (UI Integration)

引入適配層後，您的 UI 元件 (如 `src/renderer.js`) **不需要知道當前處在哪個作業系統、哪個平台**。它只需要統一呼叫 `SystemService` 的介面，就能自動在不同的環境觸發最合適的交互體驗。

### 🔄 重構範例 1：外部連結點擊

原本在 `src/renderer.js` 中，為了相容 Electron 與一般瀏覽器，寫了冗長的分支判斷。使用 `SystemService` 後，可精簡並優化為：

```javascript
// 重構前：分支混雜
const openLink = (url) => {
    if (typeof require !== 'undefined' && ipcRenderer) {
        try {
            const { shell } = require('electron');
            shell.openExternal(url);
        } catch (e) {
            window.open(url, '_blank');
        }
    } else {
        window.open(url, '_blank');
    }
};

// 重構後：無感呼叫，一行程式碼搞定所有環境！
const openLink = (url) => {
    window.SystemService.openExternal(url);
};
```

---

### 🔄 重構範例 2：AI 記憶 (Memory) 的匯出與匯入

原本的寫法會直接在 DOM 中追加 `<a>` 標籤下載，這在 Electron 和 Tauri 桌面端上體驗極差 (它會直接把檔案塞進預設下載資料夾，而不是彈出對話框讓用戶選擇儲存位置，且在 Tauri 沙盒中可能會受限)。

重構後程式碼如下，介面直觀且功能完美：

```javascript
// ==================== 1. 記憶匯出 (Export) ====================
exportLearningsBtn.onclick = async () => {
    if (currentEditingIndex !== -1 && window.AI) {
        const char = window.AI.getCharacter(currentEditingIndex);
        if (char && char.isLLM) {
            const exportData = {
                character: char.name,
                timestamp: new Date().toISOString(),
                learnings: char.learnings,
                stats: char.stats
            };

            const defaultFilename = `${char.name}_Memory_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
            
            try {
                // 調用適配器：Tauri/Electron 會跳出原生存檔視窗；Web 版會自動下載
                const result = await window.SystemService.writeFile(defaultFilename, exportData);
                
                if (result.success) {
                    AudioPlayer.playCardSelect();
                    console.log("[Export] Saved to: ", result.path || 'Web Download');
                }
            } catch (err) {
                showAlert(currentLang === 'zh' ? '匯出失敗' : 'Export failed');
                console.error(err);
            }
        }
    }
};

// ==================== 2. 記憶匯入 (Import) ====================
importLearningsBtn.onclick = async () => {
    if (currentEditingIndex !== -1 && window.AI) {
        const char = window.AI.getCharacter(currentEditingIndex);
        if (char && char.isLLM) {
            try {
                // 調用適配器：Tauri/Electron 會跳出原生開檔視窗；Web 版會跳出瀏覽器檔案選取器
                const result = await window.SystemService.readFile({ accept: '.json' });
                
                if (result.success && result.data) {
                    const data = result.data;
                    
                    // 驗證 JSON 資料結構
                    if (Array.isArray(data.learnings)) {
                        char.learnings = data.learnings;
                        if (data.stats) char.stats = data.stats;
                        
                        if (typeof char.saveMemory === 'function') char.saveMemory();
                        
                        updateLearningsUI(char);
                        showAlert(currentLang === 'zh' ? '記憶匯入成功！' : 'Memory imported successfully!');
                        AudioPlayer.playCardSelect();
                    } else {
                        throw new Error("Invalid format");
                    }
                }
            } catch (err) {
                showAlert(currentLang === 'zh' ? '匯入失敗：格式不正確' : 'Import failed: Invalid format');
                console.error(err);
            }
        }
    }
};
```

---

## 5. 無痛整合指南 (Vite / Tauri 整合配置)

為了確保在新增 Tauri 的同時，**不破壞原本的純前端 Web 運行模式**，請遵循以下配置方案：

### 🎯 A. 設定 `tauri.conf.json`

在 Tauri 初始化後 (`npm run tauri init` 或 `npx tauri init`)，你需要將 `tauri.conf.json` 中的 `withGlobalTauri` 設為 `true`。這樣 Tauri 就會將 API 注入到 `window.__TAURI__` 中，允許你在沒有 bundler 的情況下依然能在純前端直接調用。

```json
{
  "build": {
    "distDir": "../",           // 靜態網頁資源的輸出路徑 (指向你 index.html 所在的目錄)
    "devPath": "http://localhost:8080", // 或者是你本機運行的除錯伺服器
    "beforeDevCommand": "",     // 純前端暫時不需要
    "beforeBuildCommand": ""    // 純前端暫時不需要
  },
  "tauri": {
    "bundle": {
      "active": true,
      "identifier": "com.mesmerli.taiwan-big-two-ai",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    },
    "allowlist": {
      "all": false,
      "dialog": {
        "all": true,
        "open": true,
        "save": true
      },
      "fs": {
        "all": true,
        "readFile": true,
        "writeFile": true,
        "readTextFile": true,
        "writeTextFile": true
      },
      "shell": {
        "all": true,
        "open": true
      }
    },
    "security": {
      "csp": null
    },
    "windows": [
      {
        "fullscreen": false,
        "height": 768,
        "resizable": true,
        "title": "Taiwan Big Two AI",
        "width": 1024
      }
    ]
  }
}
```

> [!IMPORTANT]
> **全域注入設定**
> 請確保在 `"tauri": { ... }` 區段中加上：
> ```json
> "features": {
>   "withGlobalTauri": true
> }
> ```
> *(這會指示 Tauri 在 WebView 初始化時，將全域 `__TAURI__` 注入到 window 對象中)*

---

### 🎯 B. 靜態資源 base 路徑配置 (`vite.config.js` 方案)

若您未來決定將專案升級為 **Vite** 編譯的 SPA 以提升效能與支援載入 NPM 套件，您必須特別處理「資源載入路徑 (`base`)」：
1. **瀏覽器 (Web) / 託管環境**：通常需要 `base: '/'` (絕對路徑)。
2. **Capacitor / Electron / Tauri**：這類本機執行環境在打包後，是透過 `file://` 或 Tauri 的本機通訊協定 `tauri://localhost` 載入靜態檔案。因此路徑必須為相對路徑 `base: './'`，否則會出現白畫面。

我們可以使用動態環境變數在 `vite.config.js` 中實現一套配置，自動支援所有打包目標：

```javascript
import { defineConfig } from 'vite';

// 判斷是否為行動端 (Capacitor) 或桌面端 (Tauri/Electron) 的建置
const isNativeApp = process.env.TAURI_ENV || process.env.CAPACITOR_ENV || process.env.ELECTRON_ENV;

export default defineConfig({
  // 如果是 Native App (Tauri, Capacitor, Electron)，必須使用相對路徑 './' 避免載入失敗；
  // 如果是標準 Web 環境，可使用絕對路徑 '/' 或專案子路徑。
  base: isNativeApp ? './' : '/',
  
  server: {
    port: 8080,
    strictPort: true, // Tauri 專用：若埠號被佔用則報錯，避免 Tauri 連錯伺服器
  },
  
  // 優化 Tauri 的除錯 Rust 輸出 console logs
  clearScreen: false,
});
```

當您要在本地編譯為 Tauri 時，僅需以如下命令帶入環境變數建置：
```bash
# 啟動 Tauri 偵錯
TAURI_ENV=true npm run tauri dev

# 打包 Tauri 安裝檔
TAURI_ENV=true npm run tauri build
```

---

## 🎯 總結

此適配器架構在 **環境偵測隔離 (Environment Isolation)** 與 **功能適應抽象 (Function Abstraction)** 上提供了極佳的平衡：
1. **低侵入性**：不需要重寫核心遊戲邏輯或 AI 系統，只需在 UI 互動的最外層改用 `SystemService`。
2. **三端相容**：維持原有的 Electron 與 Android Capacitor 特性，又完整解鎖了 Tauri 高效、安全的 Native API 優勢。
3. **無痛升級**：既能完美工作在專案現有的 Vanilla JS 全域載入架構下，又具備了隨時遷移至 Vite + ESM 現代化編譯架構的靈活性。

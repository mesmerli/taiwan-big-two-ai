# Microsoft Store 試用版集成指南 (MSIX)

本文件說明如何為 **Taiwan Big Two AI** 集成 Microsoft Store 的試用版 (Time-limited Trial) 功能。我們採用了微軟官方推薦的 `@microsoft/winappcli` 工具鏈配合 C++ 原生插件橋接方案。

---

## 1. 核心技術架構

*   **工具鏈**: `@microsoft/winappcli` (用於管理 App Identity 與 MSIX 打包)。
*   **原生插件 (Native Addon)**: `StoreBridge` (使用 C++/WinRT 撰寫，直接呼叫 Windows 商店 API)。
*   **主程序邏輯**: `main.js` (透過 Electron 主進程與原生插件通訊，判斷授權狀態)。

---

## 2. 開發環境需求

1.  **Visual Studio 2022**: 必須安裝「使用 C++ 的桌面開發」工作負載。
2.  **Node.js**: 建議使用 v20+ 版本。
3.  **Windows SDK**: 建議版本為 10.0.19041.0 或更高。

---

## 3. 建置流程

### 第一步：初始化與建立插件
如果您是從頭開始，請執行以下指令：
```powershell
# 初始化 WinApp 環境
npx winapp init

# 建立 C++ 原生插件
npx winapp node create-addon --name StoreBridge --template cpp
```

### 第二步：編寫原生代碼
將 `StoreBridge/StoreBridge.cc` 替換為支援 `StoreContext` 的程式碼。關鍵點在於使用 `IInitializeWithWindow` 將插件與 Electron 視窗控制代碼 (HWND) 綁定。

### 第三步：編譯插件
在 `StoreBridge` 目錄下執行：
```powershell
npx node-gyp rebuild
```
這會生成 `build/Release/StoreBridge.node` 檔案。

---

## 4. 調試與測試 (Debug Identity)

由於商店 API 需要應用程式具備「身份 (Identity)」，在開發階段必須執行：

```powershell
# 1. 注入開發者調試身份 (Sparse Package)
npx -p @microsoft/winappcli winapp node add-electron-debug-identity

# 2. 啟動遊戲
npm start
```

*註：如果工作列圖標消失，請執行 `npx winapp manifest update-assets <圖片路徑>` 並重啟電腦。*

---

## 5. 試用期到期處理邏輯

在 `main.js` 中，系統會檢查以下欄位：
*   **isActive**: 授權是否有效。
*   **isTrial**: 是否為試用版。
*   **expirationDate**: 試用期到期時間。

**當過期時：**
1. 系統彈出 `dialog.showMessageBoxSync` 警告。
2. 提供「立即購買」按鈕，導向 `ms-windows-store://pdp/?ProductId=9N2NBJLSCSN9`。
3. 程式自動關閉 (`app.quit()`)。

---

## 6. 正式打包 (MSIX)

準備發布到 Microsoft Store 時，執行：

```powershell
# 打包為正式 MSIX 文件
npx winapp pack ./dist
```

這會生成一個符合 Windows 商店上架規範的安裝包，其中包含所有圖標資源與原生插件。

---

## 7. 測試與模擬 (Testing & Simulation)

在開發階段，如果您需要測試「試用期過期」的 UI 流程，可以修改 `main.js` 中的 `processLicense` 函數進行人工模擬：

```javascript
async function processLicense(license) {
  // 強制覆蓋授權狀態進行模擬
  license.isActive = true;           // 模擬已取得授權
  license.isTrial = true;            // 模擬為試用版
  license.expirationDate = '2020-01-01T00:00:00Z'; // 模擬過期日期
  
  // ... 後續邏輯
}
```

這能觸發 `handleTrialExpired()` 並顯示購買提示視窗。

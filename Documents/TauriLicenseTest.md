# Tauri 商店版授權與試用期測試指南 (Tauri License & Trial Testing Guide)

本文件說明如何測試與模擬 **Taiwan Big2 AI** 在 Tauri 架構下的 Windows Store 授權、試用版剩餘天數判定及過期引導購買邏輯。

---

## 1. 核心測試機制 (Debug Mock)

為了避免在本地開發階段因缺乏微軟商店的正式 MSIX 封裝身分而導致 API 呼叫崩潰，我們在 Rust 後端 `src-tauri/src/lib.rs` 的 `check_windows_store_license` 函數中設計了測試擋板（Debug Mock）。

當程式在**本地開發模式 (`npm run tauri:dev`)** 運行，或**編譯為非商店版（沒有帶入 `store` feature）** 時，會自動跳過真實的 Windows WinRT API 查詢，改為回傳代碼中寫死的模擬狀態。

---

## 2. 模擬各種授權狀態

您可以直接編輯 `src-tauri/src/lib.rs` 中 `check_windows_store_license` 函數的開發分支（約第 11-21 行）來模擬各種試用與授權狀態：

### A. 模擬試用期運作中（例如：剩餘 5 天）
在代碼中將 `is_trial` 設為 `true`，並指定 `trial_days_remaining` 的天數：
```rust
    if cfg!(debug_assertions) || !cfg!(feature = "store") {
        let _ = window;
        return Ok(LicenseStatus {
            is_active: true,
            is_trial: true,          // 啟用試用狀態
            trial_days_remaining: 5,  // 模擬剩餘 5 天
        });
    }
```
*   **預期 UI 行為**：右上角與關於頁面會顯示黃色的「試用版剩餘 5 天」提示。

### B. 模擬試用期過期（天數為 0 或負數）
將 `is_trial` 設為 `true`，天數設為 `0`：
```rust
    if cfg!(debug_assertions) || !cfg!(feature = "store") {
        let _ = window;
        return Ok(LicenseStatus {
            is_active: true,
            is_trial: true,
            trial_days_remaining: 0,  // 模擬已過期
        });
    }
```
*   **預期 UI 行為**：系統會彈出「試用期已屆滿」的微軟商店購買提示對話框，點選「立即購買」會開啟瀏覽器並導向您的微軟商店商品頁面，關閉或點選取消則會自動退出遊戲 (`app.quit()`)。

### C. 模擬商店完整版（已購買）
將 `is_trial` 設為 `false`：
```rust
    if cfg!(debug_assertions) || !cfg!(feature = "store") {
        let _ = window;
        return Ok(LicenseStatus {
            is_active: true,
            is_trial: false,         // 已購買完整版
            trial_days_remaining: 0,
        });
    }
```
*   **預期 UI 行為**：右上角不會顯示任何試用期提示，關於頁面授權狀態會顯示綠色的「商店完整版」。

---

## 3. 開始執行測試

完成代碼模擬數值的修改後，執行以下指令啟動 Tauri 偵錯視窗進行測試：
```bash
npm run tauri:dev
```
*注意：請確保您啟動的是 `tauri:dev` 而非普通的發佈版建置，否則會進入真實的商店授權查詢通道。*

---

## 4. 真實環境測試（正式打包）

如果您想要測試包含真實 Windows Store WinRT API 查詢的正式版本：

1. **建置商店版**：
   ```bash
   npm run tauri:build:store
   ```
2. **安裝 MSIX 包**：
   在產出的 `dist/tauri-store-msix/` 資料夾下雙擊安裝 `.msix` 檔案。
3. **授權行為**：
   * 由於此時為正式發佈版，應用程式將具有 Package Identity，會向您的 Windows 系統及微軟帳戶查詢本機是否擁有該軟體的試用期或完整授權。
   * 如果登入的微軟帳戶**沒有購買過該商品**，將會直接觸發過期對話框。
   * 如果已經購買，則會自動解鎖進入完整版。

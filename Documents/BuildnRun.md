# 執行與建置指南 (Build & Run Guide)

本專案支援多個執行平台（Electron, Tauri, Capacitor Android），以下整理各個平台的**執行 (Run)**、**測試 (Test)** 與**建置 (Build)** 的命令行指令。

---

## 1. Electron (主要桌面版)
這是本專案最主要的開發與測試平台，並支援打包至 Microsoft Store。

*   **執行開發模式**：
    ```bash
    npm start
    ```
*   **測試**：
    執行所有測試 (包含遊戲邏輯測試與 Playwright UI 測試)：
    ```bash
    npm test
    ```
    僅執行 UI 測試：
    ```bash
    npm run test:ui
    ```
*   **建置**：
    打包成免安裝目錄（用於開發除錯）：
    ```bash
    npm run pack
    ```
    打包成一般 Windows 安裝檔（NSIS / Portable 等）：
    ```bash
    npm run dist
    ```
    打包成 **GitHub 側載版 (Sideloaded)** (會包含 GitHub Sponsors 贊助連結與側載授權提示)：
    ```bash
    npm run dist:github
    ```
    打包成 **Microsoft Store 商店版** (會隱藏贊助連結，並整合微軟商店試用版天數及授權檢查)：
    ```bash
    npm run dist:store
    ```
    打包成 **Microsoft Store** 專用的 MSIX 格式：
    ```bash
    npm run dist:msix
    ```
    > 💡 **輸出位置**：所有 Electron 建置產生的檔案（包含免安裝目錄、安裝檔與 MSIX）都會集中存放在專案根目錄的 `dist/` 資料夾下。
    >
    > 💡 **商店版與側載版之免安裝目錄測試 (win-unpacked)**：
    > 打包後的獨立執行檔在運行時，會讀取建置時寫入 `package.json` 的 `"buildTarget"` 欄位以區分版本。若要在打包後測試不同版本的免安裝目錄：
    > - **測試商店版**：請執行 `npx cross-env BUILD_TARGET=STORE npm run pack`，再開啟 `dist/win-unpacked/Taiwan Big Two AI.exe`。
    > - **測試側載版**：請執行 `npx cross-env BUILD_TARGET=GITHUB npm run pack`，再開啟 `dist/win-unpacked/Taiwan Big Two AI.exe`。

---

## 2. Tauri (輕量級桌面版)
Tauri 提供比 Electron 更輕巧、記憶體佔用更低的桌面應用版本。

*   **執行開發模式**：
    ```bash
    npx tauri dev
    ```
*   **建置 (打包出安裝檔)**：
    ```bash
    npx tauri build
    ```
    > 💡 **輸出位置**：打包完成的安裝程式（如 .msi 或 .nsis）會存放在 `src-tauri/target/release/bundle/` 資料夾下；單純編譯出的可執行檔則在 `src-tauri/target/release/` 內。

---

## 3. Capacitor (Android 行動版)
Capacitor 用來將網頁遊戲畫面打包為原生的 Android 應用程式。

*   **同步網頁資源至 Android 專案**：
    每次修改前端程式碼後，需執行此指令將更新同步到原生層。
    ```bash
    npx cap sync
    ```
*   **產生並更新應用程式圖示 (Logo) 與啟動畫面 (Splash)**：
    若要更新圖示或啟動畫面，請確保 `Assets/` 目錄中已有 `icon.png`（與 `icon-only.png`）做為來源圖檔，然後執行：
    ```bash
    npx @capacitor/assets generate --android --iconBackgroundColor "#1e293b" --iconBackgroundColorDark "#0f172a"
    ```
*   **在命令列編譯安裝檔 (.apk)**：
    若想直接透過命令列編譯 APK，可使用專案內置的 Gradle Wrapper 工具（會自動借用 Android Studio 內置的 Java 運行環境）：
    *   **編譯偵錯版 (Debug APK)**：
        ```powershell
        $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
        cd android
        ./gradlew assembleDebug
        ```
    *   **編譯發佈版 (Release APK)**：
        ```powershell
        $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
        cd android
        ./gradlew assembleRelease
        ```
        > 💡 **輸出位置**：編譯出的 APK 會存放在 `android/app/build/outputs/apk/debug/app-debug.apk` 或 `android/app/build/outputs/apk/release/app-release-unsigned.apk`。
*   **執行並部署到 Android 設備 / 模擬器**：
    ```bash
    npx cap run android
    ```
*   **開啟 Android Studio**：
    用於進階的 Java/Kotlin 除錯、憑證設定或輸出發佈版 APK/AAB。
    ```bash
    npx cap open android
    ```

---

## 4. C++ 原生擴充模組 (StoreBridge)
這是專門處理 Windows Store 授權、試用版判定與購買跳轉的原生模組。

*   **編譯 StoreBridge 模組**：
    若修改了 `StoreBridge.cc` 等 C++ 檔案，請執行以下指令重新編譯。
    ```bash
    npm run build-StoreBridge
    ```
    > 💡 **輸出位置**：編譯成功後，產生的 Node 原生擴充模組會存放在 `StoreBridge/build/Release/StoreBridge.node`。

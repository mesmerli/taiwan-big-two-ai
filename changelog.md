# Changelog

All notable changes to this project will be documented in this file.

## [1.5.17] - 2026-05-20

### Changed
- **Pair Combination Logic**: Updated `findPairs` logic to generate all valid pair combinations of the same rank (e.g., three J's now yield all three possible pair combinations instead of just the single strongest pair).

### Fixed
- **Keyboard Card Selection**: Enabled selecting and cycling through alternative pair combinations of the same rank using Arrow keys, preventing the selection from being locked to only the strongest pair.
- **AI Card Preservation**: Improved AI decision-making by allowing it to select the weakest valid pair to beat the table play, preserving higher-suit cards (like the Spade) for subsequent single card plays.

## [1.5.16] - 2026-05-19

### Added
- **Interactive Trial Status in Rules Modal**: Enabled clicking on the "Days left in trial" status inside the Rules Modal's "License & Sponsor" tab to redirect users directly to the Microsoft Store to purchase the full version.
- **Clickable UI Styling**: Applied pointer cursor, underline styling, and hover title hints to the trial status text inside the Rules Modal for better discoverability.
- **Android App Icon Generation**: Created a source `assets` directory and generated 86 Android launcher icons and splash screens using `@capacitor/assets`. Updated the adaptive icon background color to `#1e293b` to match the dark slate game theme.

### Fixed
- **License Status Sync Bug**: Fixed a bug where the license status text in the Rules Modal remained stuck on "Verifying Windows Store license..." on startup. The renderer now calls `updateLanguage()` to refresh the license display when it receives the asynchronously fetched license status from the main process.

## [1.5.13] - 2026-05-19

### Added
- **Build Target Differentiation**: Added build scripts (`dist:store`, `dist:github`) and dynamic runtime target detection to differentiate between Microsoft Store (`STORE`) and GitHub sideloaded (`GITHUB`) builds.
- **Security Compliance (Context Bridge)**: Refactored the About dialog window to use secure preload configuration (`aboutPreload.js`) with `contextIsolation: true` and `nodeIntegration: false`.
- **UI Integration**: Added dynamic license status displays (such as trial expiration countdowns, activation status, and sideload warning messages) in both the About window and the Rules/License modal tab.
- **Persistent Configuration**: Enabled storing `buildTarget` inside `package.json` during the build phase so packaged executables correctly read their target environment at runtime.
- **Localization**: Added corresponding bilingual translations (Traditional Chinese and English) in `src/i18n.js` and `www/src/i18n.js`.

### Fixed
- **About Page Translation Crash**: Fixed a Javascript error where translations could not be read from `window.I18N` because `I18N` was declared as a block-scoped `const`.

## [1.5.8] - 2026-05-19

### Added
- **Tauri Support**: Added support for building the application via Tauri as a lightweight desktop alternative to Electron.
- **Documentation**: Created `Documents/BuildnRun.md` to organize and document run, test, and build commands across all supported platforms (Electron, Tauri, Capacitor, StoreBridge).
- **Documentation**: Created `Documents/architecture.md` detailing the project's code structure and cross-platform architecture.

### Changed
- **Tauri Configuration**: 
  - Increased the initial window size to `1024x768` to ensure the desktop layout is triggered by default.
  - Updated the bundle identifier to match the new package identity (`com.mesmerli.taiwanbig2ai`).
  - Synced Tauri build version with the Electron `package.json` version (`1.5.8`).
  - Isolated web assets by pointing the Tauri `frontendDist` directly to the `www` directory, preventing backend files from being bundled with the frontend.
  - **Single Instance Support**: Integrated `tauri-plugin-single-instance` to prevent multiple instances from opening from the taskbar, automatically focusing the existing window instead.
- **Electron Build Optimization**: Heavily optimized `electron-builder` configuration in `package.json` to exclude heavy unused assets (`src-tauri`, `android`, C++ `.pdb` debug symbols, etc.), drastically reducing the final installer size from ~1.5GB to ~119MB.
- **MSIX & Store Identity**: Updated Windows Store Product ID, MSIX `IdentityName` (`TaiwanBig2AI`), and `AppUserModelId` to ensure correct Microsoft Store deployment and taskbar jump list behavior.
- **README Updates**: Updated the version badges and download links to `1.5.8`, added Tauri to the platform badge, and included links to the new architectural and build documentation.

## [1.5.0]

- Base release with full support for Electron, Capacitor (Android), and LLM-powered AI (Diana & Ares).
- Added Microsoft Store Trial mechanism (`StoreBridge` C++ Addon).
- Support for AFK self-play and AI memory evolution.

# Changelog

All notable changes to this project will be documented in this file.

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

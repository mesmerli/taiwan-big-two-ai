# Changelog

All notable changes to this project will be documented in this file.

## [1.5.28] - 2026-05-31

### Fixed
- **Responsive Toggle Handle Arrow Directions**: Synchronized the toggle handle arrow directions with viewport layout modes. Added dynamic detection of the mobile-layout classes on window resize to ensure correct arrow orientations (◀/▶ for desktop, ▲/▼ for mobile) when minimizing or expanding the post-game review panel.
- **Mobile Card Selection Lift**: Fixed a CSS bug on mobile touch devices where selecting a card would highlight it with a blue border but fail to lift it upward (`translateY`). Modified the mobile hover media overrides to use `:not(.selected):hover` so persistent mobile touch hover states do not override the selected transformation.

## [1.5.27] - 2026-05-31

### Fixed
- **Collapsible Review Panel Behavior**: Refined the collapsible behavior of the review panel. Minimizing the panel (via the edge toggle handle) now slides it off-screen but keeps the LLM generation active in the background. Dismissing the panel (via the "X" button) completely hides both the panel and the handle and aborts the LLM generation.
- **Played Cards Stacking & Overlaps**: Resolved visual overlaps where pass slots and empty slots covered other players' played cards. Empty slots are now styled as transparent, and the active played cards slot's z-index is dynamically boosted to render on top of adjacent overlapping slots.

## [1.5.26] - 2026-05-31

### Fixed
- **Card Selection Stacking & Transitions**: Fixed an issue where deselecting a card would cover the card to its right. Removed z-index from hovered cards to preserve natural DOM stacking order, and updated the selection click handler to toggle the `.selected` class directly instead of rebuilding the hand DOM to enable smooth sliding transitions.

## [1.5.25] - 2026-05-30

### Added
- **Fair Tactical AI Heuristics**: Rewrote legacy PalmOS computer-player cheats into fair, table-wide tactical AI heuristics that apply to all players (human and CPU) equally.
  - When any opponent has exactly 1 card left, follow-singles logic throws the biggest valid single card to defend.
  - When no opponent is near winning (<= 3 cards left), follow-singles logic avoids breaking pairs and 5-card combinations.
  - The single-card holding control logic (passing on rank > 9 table plays) now checks all opponents.
  - Updated AlexAI's lead logic to avoid playing pairs if any opponent has exactly 2 cards remaining.
- **Special Beating Rules (Bombs/Monsters)**: Implemented traditional Taiwanese Big Two rule where a Four of a Kind (鐵支) or Straight Flush (同花順) can beat any single card or pair at any time.
- **AI Character Documentation**: Created `Documents/ai_characters.md` documenting profiles and strategies of traditional AIs (Alex, Bella, Chris) and LLM-powered AIs (Diana, Ares).

## [1.5.20] - 2026-05-25

### Added
- **Interactive Post-Game AI Q&A**: Replaced the "Re-analyze" (重新分析) button in the AI review panel with an interactive Q&A input and submit button, enabling players to ask follow-up questions about the match analysis.
- **Context-Rich LLM Analysis**: Reconstructed starting hands of all four players from play history (`gameLog`) and passed complete chronological play logs for the LLM to analyze, providing much more accurate and deep tactical commentary.
- **Default Persona Strategy Adjustment**: Configured default `extraPrompt` (客製化提示詞) for Diana (`DianaAI`) and Ares (`AresAI`) containing their respective match-improvement recommendations from the reviews.

### Changed
- **Response Length Optimization**: Configured `max_tokens: 4096` in LLM API calls to prevent responses from being cut off.
- **Fallback Safety**: Improved fallback/reset logic for settings so that clearing customized prompts reverts to character-specific built-in defaults.

## [1.5.19] - 2026-05-24

### Added
- **Secure Cloud LLM Authentication**: Integrated secure API Key configuration input fields (with hidden password masks) into both AI Player settings and Post-Game Review settings. Injected dynamic `Authorization: Bearer <ApiKey>` header to outgoing REST API calls, enabling seamless authentication with cloud-based provider endpoints while keeping local servers compatible.
- **Auto-Detection Placeholders**: Improved Model ID settings by dynamically querying the connection URL for available models and displaying the first detected model ID as a placeholder suggestion if the selection is left blank.

### Changed
- **Traditional Select Dropdowns**: Refactored Model ID and Review Model fields from custom HTML5 text inputs + datalists to native `<select>` dropdowns. This resolves visual overlaps with browser auto-fill history and filters.
- **Custom Model Compatibility**: Configured standard select menus to automatically append and highlight the user's previously saved custom model ID if it is absent from the API-returned models list.
- **Race Condition Prevention**: Integrated `AbortController` cancellation to abort and discard in-flight model list queries whenever a new API URL is inputted, preventing concurrent requests from appending duplicate options.
- **Styling Unification**: Tailored drop-down styles to fit the dark slate game theme.

## [1.5.18] - 2026-05-24

### Added
- **AI Tactical Review Customization**: Added dynamic wait screen titles displaying the configured model name (`reviewLlmModel` from `AppStorage`) instead of hardcoded strings.
- **Constructive AI Feedback**: Configured the AI prompt to evaluate tactical plays using positive and educational feedback tags (`[檢討]` / `[Review]` and `[分析]` / `[Analysis]`) instead of sarcastic roasting comments.

### Changed
- **Optimized UI Flow**: Suppressed the standard victory alert pop-up (`showAlert`) when the AI review panel is initialized, directly sliding the review panel into view to avoid double prompts. The popup still functions as a fallback if the AI module is not loaded.
- **Improved Wait Screen UX**: Tightened wait screen padding and removed the static progress bar to prevent screen overflow and scrollbars.
- **Non-Streaming JSON Responses**: Swapped the typewriter SSE stream logic with a non-blocking asynchronous JSON response pipeline for faster rendering.
- **Paragraph Fade-In Rendering**: Applied staggered CSS-based animations to fade in paragraphs sequentially within a 1-second total window.

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

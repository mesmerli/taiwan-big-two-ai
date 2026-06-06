# Changelog

All notable changes to this project will be documented in this file.

## [1.5.49] - 2026-06-07

### Added
- **Dynamic Rules Mode Selection**: Integrated dynamic switching between Taiwanese and Hong Kong game rules within Settings. Configures starting card rules, scoring structures, and hand combinations (supporting stand-alone Triples and Flushes under Hong Kong rules).

### Fixed
- **Score Calculation Reference Error**: Fixed a runtime `ReferenceError: ruleMode is not defined` in `GameController.js` when calculating game-over scores.

## [1.5.48] - 2026-06-06

### Added
- **AI Engine Modularization**: Refactored the massive single-file `ai.js` into five single-responsibility class scripts under a new `src/ai/` directory (`AICharacter.js`, `HeuristicAI.js`, `BaseLLMAI.js`, `LLMCharacters.js`, and `BigTwoAI.js`) to follow clean layered architecture design.
- **Post-Game Tactical Review Decoupling**: Decoupled the obsolete `aiSummary.js` and migrated its initialization logic into `renderer.js`. Separated DOM/view elements into `AISummaryView.js` and business logic into `AISummaryController.js`.
- **Worker Relocation**: Moved the background worker script `aiWorker.js` to `src/services/aiWorker.js` for cleaner encapsulation and updated all dependent worker path resolutions.

### Fixed
- **Robust UI Test Pipeline**: Solved flakiness in the Playwright E2E UI test suite related to persisted local storage mute configurations by programmatically resetting `AudioPlayer.soundMode = 0` during audio transition test phases.

## [1.5.47] - 2026-06-05

### Added
- **LLM Progress Localization**: Implemented dynamic text localization for WebLLM initialization and file-fetching progress reports. Raw English parameters and Cache API writing statuses are parsed via regular expressions and instantly translated to Traditional Chinese based on the active game locale.
- **Top Player Speech Bubble Relocation**: Relocated player 3's (P3/top player) dialog bubble to the right side of the panel. Ensuring both expanded and shrunken dialog bubbles never vertically overlap with played cards.
- **Topmost Dialog Bubble Rendering**: Applied `z-index: 500` to `.speech-bubble` and integrated a CSS `:has()` selector to raise the parent `.player` panel's z-index to `150` when a bubble is visible. This guarantees speaking overlays sit above cards and the table center.
- **Avatar-Aligned Progress Bar**: Refactored the thinking progress bar to render within a newly introduced `.avatar-container` block directly below each player's avatar, enforcing a strict width of 60px matching the avatar width.

### Fixed
- **Bypassed WebLLM JSON Schema Generation Loop**: Completely removed schema-guided JSON options from WebLLM parameters to stop generation loops and fff/uFFFF character repetition bugs.
- **Resolved WebLLM WASM BindingError**: Removed the `response_format` configuration to prevent WebAssembly Emscripten `std::string` type crashes, and added a robust brace-matching parser (`{` to `}`) to extract valid JSON blocks from raw LLM responses.

## [1.5.46] - 2026-06-05

### Added
- **WebLLM Thinking Time Rolling Average (EMA)**: Re-engineered the LLM thinking progress bar time estimation to use an Exponential Moving Average (EMA) with $\alpha = 0.25$. The progress bar now dynamically adapts and matches the actual recent inference speed of the AI model.

### Fixed
- **WebGPU Model Selection Fallback**: Resolved a bug where having an empty or `local-model` model ID with WebGPU active would cause a silent fallback to LM Studio and trigger a 400 Bad Request error. The system now automatically scans and resolves the ID to the first fully cached WebGPU model.
- **WebGPU f16/f32 Cache Completion Detection**: Fixed compatibility checks where devices without `shader-f16` support would fail the cache check and fall back to LM Studio. The completion check now correctly intercepts and checks the `q4f32_1` fallback variant matching the actually cached f32 files.

## [1.5.45] - 2026-06-04

### Added
- **WebGPU shader-f16 Electron Support**: Added Chromium startup command line switches `enable-unsafe-webgpu` and `enable-webgpu-developer-features` to Electron's main process initialization.
- **Automatic shader-f16 Device Request Interceptor**: Implemented a prototype patch on `GPUAdapter.prototype.requestDevice` in both the window environment module (`env.js`) and background worker context (`aiWorker.js`). If the hardware GPU adapter reports support for the `shader-f16` feature, the interceptor automatically appends `'shader-f16'` to the logical device's `requiredFeatures` list to enable FP16 execution in WGSL shaders.

### Fixed
- **Local Storage Management Localization Sync**: Implemented a robust `updateLanguage()` method in `AISummarySystem` to refresh dynamic model list labels when toggling between English and Chinese. Added dynamic triggers on tab button click and info modal open to ensure language variables are consistently checked, fixing the bug where WebLLM fallback messages and download buttons mistakenly displayed in Chinese when the app language was set to English.

## [1.5.44] - 2026-06-04

### Fixed
- **Speech Bubble Viewport Bounds**: Adjusted CSS positioning of speech bubbles for all players (P1–P4) and restricted their maximum width to prevent bubbles from overflowing screen/desktop boundaries.
- **WebLLM Cache Isolation**: Swapped out fuzzy matching for exact Model ID matching in `WebLlmCacheManager` to ensure separate, accurate cache size rendering and safe deletion for models with similar prefixes (like Gemma f16 and f32).

## [1.5.43] - 2026-06-03

### Added
- **Model-Specific Local Storage & Cache Resolution**: Re-architected `WebLlmCacheManager` to scan the shared `webllm/model` Cache Storage index and associate weight files dynamically with their matching Model IDs. Enabling precise model name rendering, accurate size calculations, and individual model deletion without affecting other cached models.
- **Unified Settings Manage Tab**: Created a new `Manage` (管理) tab inside the Rules Info modal. Consolidated all WebLLM local storage lists and preloading progress bars into this tab for a clean and unified dashboard experience.
- **Download Mutex Lock (下載互斥安全鎖)**: Integrated mutual exclusion checks when starting WebLLM preloading. Launching a new download (from NPC Settings or Review Panel Settings) while another download is already active will trigger a warning alert and block the new download, protecting memory and network bandwidth.

### Fixed
- **Enter Key Icon Height Alignment**: Adjusted SVG and container dimensions for the Enter key shortcut icon in the Keyboard tab to align perfectly in height (25px) and spacing with adjacent keys like the Space bar.

## [1.5.42] - 2026-06-02

### Added
- **Enter Key Shortcut for Shouting La**: Added a keyboard shortcut mapping the `Enter` key. When the human player has selected cards that allow them to shout "La" (leave exactly 1 remaining card/combination), pressing `Enter` will play the selected hand and declare "La".
- **Keyboard Guide Update**: Added the new `Enter` key shortcut representation to the Keyboard Controls (按鍵操作) tab in the Game Rules modal. Used a custom-designed, thin inline SVG Carriage Return symbol (`↵`) with dedicated styling to ensure proper spacing and width.

### Fixed
- **Match Review WebGPU Connection Indicator**: Resolved a UI status message bug where the post-game review panel would display "LM Studio 連線正常" instead of showing local WebGPU status when `reviewUseWebGPU` was active. The indicator now correctly displays "WebLLM (WebGPU) 已啟用" (or "WebLLM (WebGPU) Active" in English).

## [1.5.41] - 2026-06-02

### Added
- **Local WebGPU AI Service (WebLLM)**: Integrated `@mlc-ai/web-llm` via background Web Workers to support fully local, high-performance WebGPU-accelerated inference.
- **AiServiceFactory & Singleton Caching**: Implemented a global service factory and caching layer (`AiServiceFactory.js`) to reuse the WebLLM engine singleton. This prevents reloading models across gameplay decisions, review summaries, and reflections.
- **Offline Post-Game Reflection**: Refactored `BaseLLMAI.reflect()` to utilize the cached WebLLM instance for post-game reflections when local WebGPU is enabled.
- **System Prompt KV Cache Optimization**: Restructured the system prompt in `ai.js` to place static rules, game mechanics, and schemas first, and dynamic/persona variables last, maximizing prefix cache hits and minimizing response latency.

### Fixed
- **Local Engine Verification and Abort Prevention**: Resolved TypeErrors (reading `chat` of null) during offline reflection by adding robust checks on `service.engine` existence, enabling safe runtime verification.
- **Graceful Fallback Pipeline**: Established automatic fallback to remote API endpoints when the local WebGPU engine fails to initialize or load, ensuring game continuity.

## [1.5.30] - 2026-06-01

### Added
- **Match Replay Score Display**: Displayed individual round scores (e.g., +30 in green, -12 in red) on player stats cards inside the AI Tactical Review panel.

### Fixed
- **Replay Remaining Card Duplication**: Removed the duplicate/redundant remaining card count from the footer of player card in the review screen, resolving the issue where both English and Chinese card count versions displayed simultaneously.
- **Immediate Review Panel Language Syncing**: Added immediate rendering and localization logic for the entire review panel (including match review title, player stats, connection status indicator, input placeholders, and API connecting/loading labels) to translate seamlessly as soon as language is toggled.
- **Loading Slideshow Closure Bug**: Fixed a closure caching bug where the loading text slideshow during AI analysis would revert to the previous language after the first message on language toggle.

## [1.5.29] - 2026-05-31

### Added
- **PWA Home Screen Support**: Generated standard PWA app icon `apple-touch-icon.png` (180x180 resolution) in the web root (`www/` and root directories) generated from `logo.png`. Added the corresponding `<link rel="apple-touch-icon">` tag in the `<head>` of both `index.html` and `www/index.html`.

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
- **Fair Tactical AI Heuristics**: Rewrote computer-player cheats into fair, table-wide tactical AI heuristics that apply to all players (human and CPU) equally.
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

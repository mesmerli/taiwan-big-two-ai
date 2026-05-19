# Changelog

All notable changes to the **Taiwan Big Two AI** project will be documented in this file.

### [1.5.16] - 2026-05-19

### Added
- **Interactive Trial Status in Rules Modal**: Enabled clicking on the "Days left in trial" status inside the Rules Modal's "License & Sponsor" tab to redirect users directly to the Microsoft Store to purchase the full version.
- **Clickable UI Styling**: Applied pointer cursor, underline styling, and hover title hints to the trial status text inside the Rules Modal for better discoverability.
- **Android App Icon Generation**: Created a source `assets` directory and generated 86 Android launcher icons and splash screens using `@capacitor/assets`. Updated the adaptive icon background color to `#1e293b` to match the dark slate game theme.

### Fixed
- **License Status Sync Bug**: Fixed a bug where the license status text in the Rules Modal remained stuck on "Verifying Windows Store license..." on startup. The renderer now calls `updateLanguage()` to refresh the license display when it receives the asynchronously fetched license status from the main process.

### [1.5.7] - 2026-05-19

### Added
- **Transition to GNU AGPL-3.0 License**:
  - Transitioned the repository and project licensing from MIT to **GNU AGPL-3.0** to ensure strong copyleft preservation for all modern strategic AI components.
  - Fully updated the root `LICENSE`, `package.json`, and dynamic translation badge definitions.
- **Dynamic Desktop Window Resizing (Responsive Layout)**:
  - Added a window `resize` event listener that automatically toggles the `.mobile-layout` class on `<body>` and `<html>` elements when the viewport width is resized below `900px`.
  - Enables smooth automatic layout switching when running on desktop or sizing down a browser window.
- **Rules Modal "License & Sponsor" Tab**:
  - Implemented a premium, dedicated **"License & Sponsor" (版權與贊助)** tab inside the Rules modal across all platforms (Electron, Web, Android).
  - Designed the tab content to blend seamlessly and cleanly with the Rules Modal's native semi-transparent glass background.
  - Setup secure, cross-platform link action delegators supporting Electron's native `shell.openExternal` API, traditional browser tabs, and Capacitor mobile environments.
- **Branding and Heading Refinement**:
  - Unified all Traditional Chinese brand headings to **"台灣大老二 AI"** inside the Rules Modal and About Window.
  - Positioned the high-resolution logo next to the modal header with centered flexbox layout and ambient glowing shadow styles.
- **Electron About Page Enhancements**:
  - Integrated localized open-source and sponsorship callouts inside `about.html` mapped with native desktop browser external link delegators.
- **Sponsorship Callout Generalization**:
  - Polished text in README.md, README.zh-TW.md, and code components by substituting specific "Electron" references with "AI logic" for accurate copy.
- **Android APK Release Distribution**:
  - Created the official `release/Android` distribution folder and deployed the production package `twbig2ai-1.5.0.apk` to Git tracking.
  - Standardized the download link references in `README.md` and `README.zh-TW.md` to target the release folder directory directly to bypass GitHub CDN caching latency.

### [1.5.0] - 2026-05-18

### Added
- **Mobile Stack Layout & Capacitor Adaptations**:
  - Redesigned the gameplay view into an ergonomic vertical flex layout on mobile.
  - Set clock-wise player ordering: Player 1 (You) ➔ Alex (Player 2) ➔ Bella (Player 3) ➔ Diana (Player 4).
  - Micro-scaled cards (52px wide hand, 42px wide played slots) to perfectly fit 320px–480px displays.
  - Added 0-ms startup head script layout injection to completely prevent desktop-to-mobile visual flicker.
- **Ergonomic Usability & Touch Optimizations**:
  - Expanded close button (`.close-btn` / "×") hit target to `48px` to ensure highly reliable thumb taps.
  - Added instant `touchstart` bindings to all close buttons to bypass mobile's 300ms delay.
  - Wrapped control icon hover transitions in `@media (hover: hover)` queries to prevent sticky blue backgrounds on touchscreens.
  - Implemented tactile `:active` shrink scaling (`scale(0.95)`) for quick click feedback.
- **Audio & Compatibility Fixes**:
  - Added multi-touch gesture hooks (`touchstart` and `click`) to unlock HTML5 background music and play tones in mobile WebViews.
  - Added auto-resume triggers to instantly wake up suspended web AudioContext on first tap.
  - Mapped hardware keyboard Spacebar code (`'Space'` & `32`) to ensure reliable "Pass Turn" actions in emulators and physical decks.
- **Native Android Configuration & GPU Acceleration**:
  - Integrated Capacitor Android wrapper and synchronized resource files to `www/` and native assets.
  - Explicitly re-enabled hardware graphic acceleration (`android:hardwareAccelerated="true"`) in AndroidManifest.xml for butter-smooth CSS card translations.
  - Synchronized build parameters to `versionCode 6` and `versionName "1.5.0"` in Gradle build properties.

### [1.4.3] - 2026-05-16

### Added
- **Tabbed Information UI**:
    - Reorganized the Game Rules modal into a tabbed interface with "Rules" and "Keyboard" sections.
    - Integrated high-fidelity keyboard operation guides directly into the UI for better accessibility.
- **Premium Trial Experience**:
    - Added a persistent amber status label at the top-left corner showing remaining trial days.
    - Implemented interactive trial status: users can now click the trial label to jump directly to the Microsoft Store purchase page.
- **Visual Polish**:
    - Replaced "Space" text hints with a visual `ㄩ` shaped spacebar icon.
    - Enhanced contrast and visibility for keyboard icons on action buttons (Up/Down/Space).
    - Swapped keyboard icon positions to the left of button text for better scanning.

### [1.4.2] - 2026-05-16

### Added
- **Microsoft Store Trial Integration**: 
    - Full support for Time-limited Trials using the official `@microsoft/winappcli` toolchain.
    - Implemented a native C++ addon (`StoreBridge`) to securely interface with `Windows.Services.Store`.
    - Added automated redirection to the Microsoft Store upon trial expiration.
    - Implemented `add-electron-debug-identity` support for seamless local development with store identity.
- **Enhanced Rules UI**:
    - Added dynamic version number and author display to the Game Rules modal.
    - Information is automatically synced from `package.json`.
- **Packaging Documentation**:
    - Created `installmsix.md` with complete architecture and build instructions for the Store version.

### Fixed
- **Jump List Reliability**: Optimized Taskbar Jump List (Right-click menu) logic to work reliably under sparse package identity.

### [1.4.0] - 2026-05-15

### Added
- **Comprehensive Testing Suite**:
    - **Sequential Numbering**: All test outputs are now numbered (#1, #2, etc.) for easier debugging.
    - **Asset Verification**: Automated checks for presence of all image avatars, logo, and 15 character voice/BGM files.
    - **System Resilience**: Verified the game remains stable even when assets are missing (automatic fallback to synthetic tones).
    - **AI Fallback Test**: Verified LLM characters automatically switch to Local NPC logic on API connection failure.
    - **Scoring Validation**: In-depth tests for 10+ cards, "2" penalty, and winner multipliers.
- **Advanced Keyboard Controls**: 
  - **Cyclic Selection**: Use Arrow Left/Right to cycle through all legal move combinations.
  - **Quick Play**: Use Arrow Up to play selected cards (auto-shouts "La" if applicable).
  - **Reset/Deselect**: Use Arrow Down to clear selection.
  - **Spacebar Pass**: Press Space to quickly pass your turn.
- **Triple-Down Restart**: Rapidly press the Down arrow key three times after a game ends to instantly start a new match.
- **Modal Accessibility**: Any key press now closes the "Winner" alert modal for faster navigation.

### Fixed
- **AI Logic Restoration**: Fixed a critical syntax error in `GameLogic` that caused AI players to pass indefinitely.
- **Improved Combination Generation**: Fixed bugs in Full House and Four of a Kind generation where duplicate cards were being used.
- **Optimized Move Search**: AI now prioritizes picking the strongest suit for straights and pairs to ensure optimal play.
- **Scoring Engine Stability**: Re-added missing calculation methods required for post-game score penalties.
- **BGM State Management**: Fixed BGM transitions for Shout-La and Victory events.

## [1.3.0] - 2026-05-15

### Added
- **Dynamic BGM Transitions**: Background music now dynamically shifts based on game state—switching to "Iron_in_the_Gale" when a player is on their last hand ("La") and to "Sovereign_Ascent" upon victory.
- **Character Voice Integration**: Implemented character-specific "Pass" and "La" voice lines (`pass_人名.mp3`, `la_人名.mp3`).
- **Audio Mode Separation**: Refactored the audio engine to separate synthesized SFX (tones) from persona voices. Tones now play even in "SFX Only" mode to ensure gameplay feedback.

### Changed
- **Taiwanese Rule Alignment**: Removed standalone "Triple" (three-of-a-kind) as a valid hand type to strictly follow traditional Taiwanese rules (where triples are only allowed in Full Houses).

### Fixed
- **Shout La Button Logic**: Refined the "Shout La" visibility trigger to correctly ignore standalone triples and properly reset the BGM to the default track when a new game starts.

## [1.2.0] - 2026-05-15

### Added
- **Connectivity Monitoring**: Real-time "Connection Failed" feedback in AI settings.
- **Native Experience**: A new, frameless "About" window with a dedicated close button.
- **Localized Error Feedback**: Connection alerts now respect the current language setting.

### Changed
- **UI Layout Refresh**: Relocated "New Game" button to the top-right corner to maximize the game table area.
- **Modernized Iconography**: 
  - Language toggle now uses a universal globe icon (🌐).
  - Rules icon now features an artistic serif italic "i".
- **Enhanced AI Reflection**: Optimized the reflection extraction regex to better handle diverse LLM outputs.

### Fixed
- **UI Reference Error**: Resolved a crash when attempting to fetch models before the error indicator was initialized.
- **Frameless Navigation**: Added a functional "X" close button to the About window to improve usability in frameless mode.



## [1.1.0] - 2026-05-14

### Added
- **MSIX/AppX Packaging**: Full support for Microsoft Store distribution with official identity integration.
- **Automated Icon Generation**: Added a PowerShell script to generate all 6 required Windows Store icon sizes from a single base logo.
- **Auto-Save Settings**: Replaced manual Save/Cancel buttons in AI Settings with an intuitive auto-save flow.
- **Smart Modal Closure**: All modals (Rules, Settings, Alerts, About) now support closing by clicking outside the window.
- **Mandatory Shout UI**: The interface now intelligently hides the regular "Play" button when a "Shout LA!" action is required, guiding the player to follow the rules.

### Changed
- **Premium UI Polish**: Removed redundant "OK" buttons from victory/alert popups to create a cleaner, more modern interface.
- **About Window Update**: Simplified the About window UI and enabled "auto-close on blur" for a more native Windows feel.
- **Build Automation**: Enhanced the build script to automatically hardcode the 4-part version number into the output filename.

### Fixed
- **Full House Logic Bug**: Fixed a critical comparison error where a higher Full House (e.g., K-high) would erroneously lose to a lower one (e.g., Q-high) due to internal ID conflicts.
- **Shout Restriction Enforcement**: Corrected a UI bug where players could illegally split their hand after shouting "La".
- **Test Coverage**: Added new logic and UI tests specifically for Full House comparisons and mandatory shouting scenarios.

## [1.0.1] - 2026-05-14


### Added
- **Multi-Persona AI Engine**: Refactored the core AI logic into a reusable `BaseLLMAI` class.
- **New Character: Ares**: Introduced "Ares" (The God of War), a high-aggression persona with a distinct strategy.
- **Custom About Window**: Replaced system dialogs with a premium, borderless HTML About window with multi-language support.
- **Automated Versioning**: Implemented a script to auto-increment build numbers during the packaging process.
- **UI Automation Suite**: Integrated Playwright-powered UI tests (`tests/ui.test.js`) covering gameplay, modals, and character swapping.
- **Combined Testing**: Unified logic and UI tests into a single `npm test` command for full-stack verification.
- **Escape Key Support**: Added global `ESC` key functionality to dismiss all UI modals (Rules, About, Settings).
- **Model Auto-Detection**: The AI now automatically identifies the loaded model ID from LM Studio or other OpenAI-compatible local servers.

### Changed
- **Rule Alignment**: Disabled "Flush" hand types to strictly follow traditional Taiwanese Big Two rules.
- **Memory Optimization**: Improved strategic reflection logic to prevent redundant learning and ensure higher quality rule extraction.
- **UI Refinement**: Moved version information to the About window and cleaned up the main gameplay interface.
- **Stability Fixes**: Resolved issues where AI would continue to "Pass" indefinitely after a game concluded.

### Fixed
- **Reflection Error (400)**: Fixed a bug where post-game analysis failed due to missing or incorrect model identifiers.
- **Learning Contamination**: Isolated memory and settings between different AI characters (Diana vs. Ares).

## [1.0.0] - 2026-05-13
### Added
- Initial release of Taiwan Big Two AI.
- Core game engine with full card comparison and hand ranking logic.
- **DianaAI**: The first LLM-powered persona capable of learning from its losses.
- Persistent settings and memory storage via LocalStorage.
- Bilingual support (English and Traditional Chinese).
- LM Studio integration guide.

# Changelog

All notable changes to the **Taiwan Big Two AI** project will be documented in this file.

## [1.4.0] - 2026-05-15

### Added
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

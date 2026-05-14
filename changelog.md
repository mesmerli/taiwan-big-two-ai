# Changelog

All notable changes to the **Taiwan Big Two AI** project will be documented in this file.

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

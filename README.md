# Taiwan Big Two AI

This project presents a modernized Big Two card game built with Electron. It combines a sophisticated heuristic AI with an advanced multi-persona research engine powered by Large Language Models (LLM), designed for autonomous strategic gameplay analysis.

## Core Features

### 1. Multi-Persona Research Architecture
The project supports isolated AI personalities, each with its own memory and strategic bias:
- **Diana (Adaptive Learning)**: Focuses on balanced gameplay and tactical evolution.
- **Ares (The God of War)**: A high-aggression persona that prioritizes power dominance and pressure.
- **BaseLLMAI Engine**: A unified class that handles card counting, board state evaluation, and post-game reflection (Post-Game Reflection).

### 2. Autonomous "Self-Play" Testing
- **AFK Mode**: The game can run in a continuous loop, allowing AI agents to play against each other 24/7.
- **Memory Evolution**: Agents analyze their losses to generate structured "Learning Notes" (Rule Extraction), which are stored in persistent JSON memory.
- **Keyword Matching**: A refined keyword similarity engine ensures that strategic rules are accumulated without redundancy or fragmentation.

### 3. Strict Taiwanese Ruleset
The engine is strictly aligned with traditional **Taiwanese Big Two** rules:
- **No Flush**: Five cards of the same suit are NOT a valid hand (unlike the Hong Kong version).
- **Hand Ranks**: Straight Flush > Four of a Kind > Full House > Straight.
- **Suit Strength**: Spade ♠ > Heart ♥ > Diamond ♦ > Club ♣.
- **Dragon**: 13-card sequence (3-2) wins immediately.

### 4. Developer & Research Tools
- **Unified Testing**: Run `npm test` for full suite (Logic & UI).
- **Microsoft Store Readiness (MSIX)**: Full compliance with store requirements (Version format A.B.C.0).
- **Auto-Build Pipeline**: 
  - The build version (e.g., `1.2.0.1`) automatically increments.
  - **Artifact Naming**: Generated files automatically include the 4-part version number in the filename.
  - **Icon Factory**: Includes a PowerShell script (`scripts/generate-icons.ps1`) to automatically generate all 6 required Windows Store icon sizes from a single base logo.
- **Escape & Click-Outside Closure**: All modals and the About window support global `ESC` key and "click-outside" dismissal for a seamless experience.

## Installation & Build

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [Git](https://git-scm.com/)

### Setup
1. Clone the repository:
   ```powershell
   git clone https://github.com/mesmerli/taiwan-big-two-ai.git
   ```
2. Install dependencies:
   ```powershell
   npm install
   ```

### Running Tests
1. **Logic Test**: `npm test`
2. **UI Test**: `npm run test:ui`

### Running Locally
To start the application in development mode:
```powershell
npm start
```

### Building for Distribution
1. **Standard EXE**: `npm run dist`
2. **Microsoft Store (MSIX)**: `npm run dist:msix`
*Note: These commands will automatically increment the build number and update the artifact filename.*

## UI Operation Guide

### Gameplay
- **New Game**: Click the **New Game** button in the top-right corner to restart.
- **Selecting Cards**: Click on cards in your hand to select/deselect them.
- **Play / Pass**: Use the primary buttons to make your move. 
- **Mandatory Shout LA!**: 
  - If your move would leave you with exactly **one card**, the standard "Play" button will be hidden, and you must click the **"Shout LA!"** button to proceed.
  - If you have already shouted "La", you are restricted to playing your remaining cards as a single hand or passing.

### Character & AI Management
- **Switching Characters**: Click on any player's **Avatar** to cycle through the available personalities (Alex, Bella, Chris, Diana, Ares). 
- **AI Settings**: Click the **Gear Icon (⚙️)** next to an LLM character to:
  - Configure the **API URL** and **Model ID** (auto-detected).
  - **Inline Feedback**: Shows **(Connection Failed)** in vivid red if the API is unreachable.
  - **Export/Import Memory**: Save or load their learned strategic rules as JSON files.

### System Controls
- **Language**: Click the **Globe icon (🌐)** in the top-right to switch the entire UI.
- **Rules & Info**: Click the **italic "i" icon** to access game rules or the About window.
- **Closing Windows**: Use the **"X" button** in the top-right corner of any window, or press `ESC`.

## Using LLM with LM Studio

The "Deep Learning" AI characters (Diana & Ares) require an OpenAI-compatible API to function. [LM Studio](https://lmstudio.ai/) is the recommended tool for running models locally.

### Setup Instructions
1. **Download LM Studio**: Visit [lmstudio.ai](https://lmstudio.ai/).
2. **Download a Model**: Search for `google/gemma-4-e2b`.
3. **Start Local Server**: Go to the **Local Server** tab and click **Start Server**.
4. **Connect to Game**: Open **AI Settings (⚙️)**, paste the URL, and it's ready.

## Changelog
For a detailed history, please see [changelog.md](./changelog.md).

---

## License
This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---
*Created with ❤️ by mesmerli for AI Strategic Research*
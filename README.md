# Taiwan Big Two AI (台灣大老二 AI 版)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-1.4.0-blue.svg)](./changelog.md)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Electron-brightgreen.svg)](https://www.electronjs.org/)

A modernized **Taiwanese Big Two** card game built with Electron. This project integrates sophisticated heuristic algorithms with an advanced multi-persona research engine powered by **Large Language Models (LLM)**, designed for autonomous strategic gameplay analysis and evolutionary learning.

---

## 🚀 Core Features

### 1. Multi-Persona Research Architecture
The project supports isolated AI personalities, each with its own memory, strategic bias, and distinct character:
- **Diana (Adaptive Learning)**: Focuses on balanced gameplay and tactical evolution.
- **Ares (The God of War)**: A high-aggression persona that prioritizes power dominance and pressure.
- **BaseLLMAI Engine**: A unified class handling card counting, board state evaluation, and **Post-Game Reflection**.

### 2. Autonomous "Self-Play" & Evolution
- **AFK Mode**: The game can run in a continuous loop, allowing AI agents to play against each other 24/7.
- **Memory Evolution**: Agents analyze losses to generate structured **"Learning Notes"** (Rule Extraction) stored in persistent JSON memory.
- **Keyword Matching**: A refined keyword similarity engine ensures strategic rules accumulate without redundancy.

### 3. Strict Taiwanese Ruleset
The engine is strictly aligned with traditional **Taiwanese Big Two** rules:
- **No Flush**: Five cards of the same suit are NOT a valid hand (unlike the HK version).
- **No Standalone Triples**: Three-of-a-kind cannot be played alone; they are only valid in Full House or Four of a Kind.
- **Hand Ranks**: Straight Flush > Four of a Kind > Full House > Straight.
- **Suit Strength**: Spade ♠ > Heart ♥ > Diamond ♦ > Club ♣.
- **Dragon**: 13-card sequence (3-2) wins immediately.

---

## 🎮 Controls & Interaction

### 🖱️ Mouse Interface
- **New Game**: Click the **New Game** button in the top-right corner.
- **Selecting Cards**: Click on cards in your hand to select/deselect them.
- **Play / Pass**: Use the primary buttons on the human player area.
- **Mandatory Shout LA!**: If a move leaves you with exactly **one card**, you must use the **"Shout LA!"** button.

### ⌨️ Keyboard Mastery (Pro Mode)
For a more efficient and professional experience, use the following shortcuts:
- **Arrow Left / Right**: Cycle through all **legal move combinations** currently in your hand.
- **Arrow Up**: Play selected cards (automatically triggers "Shout LA!" if needed).
- **Arrow Down**: 
  - **In-Game**: Deselect all currently selected cards.
  - **Post-Game**: Rapidly press **three times** to immediately start a new match.
- **Spacebar**: Pass your turn (valid only when you are not the leader).
- **Any Key**: Close the "Winner" alert modal after a match.
- **ESC**: Close any open modal (Rules, Settings, About).

---

## 🛠️ Developer & Research Tools

### Character & AI Management
- **Avatar Swap**: Click any player's **Avatar** to cycle through personalities.
- **AI Settings (⚙️)**: Configure API URL and Model ID with real-time **Connection Monitoring**.
- **Memory Management**: Export or Import learned strategic rules as JSON files.

### Build & Test Pipeline
- **Unified Testing**: Run `npm test` for full suite (Logic & UI).
- **Microsoft Store Readiness**: Full MSIX/AppX compliance (A.B.C.0 versioning).
- **Auto-Build**: Build version and artifact filenames increment automatically.
- **Icon Factory**: PowerShell script generates all 6 Windows Store icon sizes from one logo.

---

## ⚙️ Using LLM with LM Studio

The "Deep Learning" AI characters (Diana & Ares) require an OpenAI-compatible API. [LM Studio](https://lmstudio.ai/) is the recommended tool for local execution.

1. **Download LM Studio**: Visit [lmstudio.ai](https://lmstudio.ai/).
2. **Download a Model**: Search for `google/gemma-4-e2b`.
3. **Start Local Server**: Go to the **Local Server** tab and click **Start Server**.
4. **Connect to Game**: Open **AI Settings (⚙️)**, paste the URL, and it will auto-detect the model.

---

## 📜 Changelog & License
- For a detailed history, see [changelog.md](./changelog.md).
- This project is licensed under the **MIT License**.

---
*Created with ❤️ by mesmerli for AI Strategic Research*
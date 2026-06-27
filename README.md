# Chess
A fully offline chess application built with pure HTML, CSS, and vanilla JavaScript. 
No frameworks, no external dependencies, and no internet required.

This project is a complete, feature-rich chess environment designed with authentic styling, smooth interactions, and robust game logic.

---

## 🚀 Getting Started

Open `index.html` in any modern browser. There are no build steps or servers needed!

> **Note on Persistence:** On some browsers, `localStorage` requires a server context to save your game state. You can use any simple HTTP server (like `npx serve .` or VS Code Live Server) to enable full save/load support.

### 🌐 Easy Deployment
Because this is a pure static application, it can be hosted anywhere for free. We highly recommend [Netlify Drop](https://app.netlify.com/drop) — just drag and drop this entire folder to deploy it live to the web instantly!

---

## ✨ Features

### 🎮 Core Gameplay & Rules
- **Full FIDE Rules:** Includes castling, en passant, pawn promotion, the 50-move rule, and insufficient material draws.
- **Intuitive Movement:** Full support for both **click-to-move** and **drag-and-drop** interactions.
- **Visual Feedback:** 
  - Legal-move highlighting (dots for empty squares, rings for captures).
  - Last-move highlights and selected-piece highlights.
  - Red pulsing animation when a King is in check.
- **Game State Management:** Full Undo support, Board flipping, and New Game creation.
- **Session Persistence:** Your game state, history, and settings are saved automatically to `localStorage` (if supported).

### 🎨 Authentic Styling & Customization
- **Chess.com Inspired Default Theme:** Beautiful default Dark Mode UI with the iconic Green/White board.
- **Multiple Board Themes:** Switch between Classic, Green, Blue, and Purple themes.
- **Pure Unicode Pieces:** Relies on standard Unicode chess characters styled with CSS for lightweight, zero-dependency piece rendering.
- **Dark/Light Mode UI:** The entire interface adapts seamlessly to light or dark preferences.
- **Smooth Animations:** Buttery smooth DOM reconciliation ensures pieces glide naturally during drag-and-drop operations, and board flips are animated.
- **Settings Persistence:** Your audio, visual, and theme preferences are saved locally.

### 📊 Advanced UI & History
- **Interactive Move History:** Click any algebraic move in the log to jump back in time to that specific board position.
- **Playback Controls:** Use Previous/Next buttons (or arrow keys) to review the game step-by-step.
- **Live Statistics:**
  - Material advantage tracker (P=1, N=3, B=3, R=5, Q=9).
  - Accurate captured-pieces display directly on the player profile bars.
  - Total move count and game duration tracker.
- **Immersive Audio:** Web Audio API sound effects for standard moves, captures, checks, castling, promotions, and checkmates.

### ⌨️ Keyboard Shortcuts
- `F` — Flip board
- `C` — Toggle coordinates
- `S` — Open settings
- `←` / `→` — Previous/Next move
- `Home` / `End` — Jump to start / Jump to latest position
- `Ctrl+Z` — Undo last move
- `?` — Show keyboard shortcuts help
- `Esc` — Close dialogs

---

## 📱 Responsive Design
The app is meticulously styled to look great on any device:
- **Desktop (>740px):** Full layout with side-by-side board and sidebar panels.
- **Tablet (480–740px):** Grid layout stacking the sidebar below the board.
- **Mobile (<480px):** Optimized for touch with compact controls and highly readable UI.
- **Dynamic Board Scaling:** The chess board automatically calculates viewport height and width to guarantee it fits entirely on a single screen without vertical scrolling.
- **Small phones (<375px):** Minimal header and edge-to-edge board utilization.

---

## 🏗️ Project Architecture

```text
chess/
├── index.html          # App shell & semantic markup
├── css/
│   └── style.css       # Design system, layout, animations, responsive rules
├── js/
│   ├── game.js         # Chess engine (pure logic, no DOM, FEN/Algebraic generation)
│   ├── board.js        # DOM renderer and Drag & Drop handler
│   ├── ui.js           # UI components (player bars, status, sounds, promotion)
│   └── main.js         # App controller, event wire-up & state management
```

### Module Responsibilities
| File       | Responsibility |
| ---------- | -------------- |
| `game.js`  | Pure game logic. Move generation, check/checkmate detection, FEN processing, algebraic notation, material calculation. |
| `board.js` | Fast DOM rendering. Reuses nodes during render cycles for zero-glitch drag-and-drop, draws board squares and coordinate labels. |
| `ui.js`    | Auxiliary UI generation. Player profiles, status readouts, interactive move history, statistics, promotion picker modals, Web Audio management, and toast notifications. |
| `main.js`  | The central orchestrator. Maintains application state, handles move navigation, orchestrates Settings & Themes, sets up keyboard shortcuts, and persists data to `localStorage`. |

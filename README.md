# 🎮 GameHub

A production-grade React + Vite + TypeScript game hub with 11 classic and traditional Indian board games.

## Games Included

| Game | Category | Bot | Players |
|------|----------|-----|---------|
| ♟️ Chess | Classic | ✅ Minimax AI | 2 |
| 🎯 Carrom | Classic | ✅ Physics AI | 2 |
| ❌ Tic-Tac-Toe | Classic | ✅ Unbeatable | 2 |
| 🔢 Sudoku | Puzzle | — | 1 |
| 🎲 Chowka Bara | Indian | ✅ | 2–4 |
| 🪨 Katta Mane (Pallanguzhi) | Indian | ✅ | 2 |
| 🎲 Taayam | Indian | ✅ | 2–4 |
| 💫 Kaangi Challa | Indian | ✅ | 2 |
| 🎰 Kaana Dua | Indian | ✅ | 2–4 |
| 🎮 Ludo | Classic | ✅ | 2–4 |
| 🐍 Snake & Ladders | Classic | — | 2–4 |

## Features
- 🎯 3 difficulty levels (Easy / Medium / Hard) for all bot games
- 👥 Local multiplayer mode for all games
- 🤖 Bot AI for 9 out of 11 games
- 🎆 Confetti win screen, particle background, Web Audio sound effects
- 🏆 Leaderboard (stored in localStorage)
- 📱 Fully responsive — works on mobile too

## How to run

### Development server
```powershell
# Set Node path (portable install on D:)
$env:PATH = "D:\nodejs;" + $env:PATH

# Install dependencies (only needed once)
npm install

# Start dev server
npx vite
```
Then open **http://localhost:5173** in your browser.

### Production build
```powershell
$env:PATH = "D:\nodejs;" + $env:PATH
npx vite build
# Output is in dist/ — open dist/index.html directly or serve with:
npx vite preview
```

### Add Node to PATH permanently
Run this in PowerShell as Administrator so `npm` / `node` work everywhere:
```powershell
[System.Environment]::SetEnvironmentVariable(
  "PATH",
  "D:\nodejs;" + [System.Environment]::GetEnvironmentVariable("PATH","Machine"),
  "Machine"
)
```
Then restart your terminal.

## Tech Stack
- **React 18** + **TypeScript** + **Vite 5**
- **Tailwind CSS 3** for styling
- **Web Audio API** for sound effects (no external deps)
- **Canvas API** for Carrom physics & Kaangi Challa board
- **localStorage** for leaderboard persistence

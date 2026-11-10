# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No `package.json`, no build, no linter, no tests. The README and UI text are in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`) and visit `http://localhost:8000`. Verify changes manually in the browser.

## Architecture

Three files; all game logic lives in `game.js` (single script, global state, no modules):

- `index.html` defines `#board` (300×600 canvas), `#next-canvas` (120×120), HUD elements (`#score`, `#lines`, `#level`) and `#overlay` (used for both PAUSA and GAME OVER). `game.js` fetches these by id at load, so renaming ids breaks it.
- `game.js` state is a set of top-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, ...) reset in `init()`, which is also the restart-button handler.
- Board is a `ROWS×COLS` matrix of 0 or a piece type index 1–7, which indexes both `COLORS` and `PIECES`. Piece cells hold their own type index, so shapes are matrices of 0/type.
- Flow: `loop` (requestAnimationFrame, accumulates `dropAccum` against `dropInterval`) → `lockPiece` = `merge` → `clearLines` → `spawn`. `spawn` ends the game via `endGame` if the new piece collides.
- Input is a single `keydown` listener; pausing and game over are guarded by the `paused`/`gameOver` flags, and the rAF loop is cancelled (not just skipped) on pause and game over.

## Gotchas

- Changing `COLS`, `ROWS` or `BLOCK` requires updating the `width`/`height` attributes of `<canvas id="board">` in `index.html` manually.
- Level and speed are recomputed in `clearLines` (level = lines/10 + 1; `dropInterval = max(100, 1000 - (level-1)*90)`). `init` hardcodes the initial `1000`.
- Rotation uses `rotateCW` plus simple horizontal kicks `[0,-1,1,-2,2]` in `tryRotate`, not SRS.
- Piece selection is uniform random (`randomPiece`), with no 7-bag.
- README.md describes the game in more detail and lists tunable constants.

'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS_DARK = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

// Paleta más saturada para buen contraste sobre fondo claro
const COLORS_LIGHT = [
  null,
  '#00acc1', // I
  '#f9a825', // O
  '#8e24aa', // T
  '#43a047', // S
  '#e53935', // Z
  '#1e88e5', // J
  '#fb8c00', // L
];

let COLORS = COLORS_DARK;
let gridColor = '#22222e';
let highlightColor = 'rgba(255,255,255,0.12)';
let currentTheme = 'dark';

// ---- Skins ----
// Cada skin: colors[8] (índice 0 null), background (null = usa el tema CSS),
// grid (null = usa el tema CSS) y drawBlock(ctx, px, py, size, color, alpha).
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, v + amt));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    label: 'Retro',
    get colors() { return currentTheme === 'light' ? COLORS_LIGHT : COLORS_DARK; },
    background: null,
    grid: null,
    drawBlock(context, px, py, size, color, alpha) {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = highlightColor;
      context.fillRect(px + 1, py + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },
  neon: {
    label: 'Neón',
    colors: [null, '#00f0ff', '#ffee00', '#d500f9', '#39ff14', '#ff1744', '#4d7cff', '#ff9100'],
    background: '#000000',
    grid: '#14141f',
    drawBlock(context, px, py, size, color, alpha) {
      context.globalAlpha = alpha;
      context.shadowBlur = 12;
      context.shadowColor = color;
      context.fillStyle = color;
      context.fillRect(px + 3, py + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(px + 5, py + 5, size - 10, 3);
      context.globalAlpha = 1;
    },
  },
  pastel: {
    label: 'Pastel',
    colors: [null, '#a8e6ef', '#fff1a8', '#d7b8f3', '#b5e8c0', '#f7b6b6', '#b3cdf5', '#fdd0a2'],
    background: '#fdf6f0',
    grid: '#efe4da',
    drawBlock(context, px, py, size, color, alpha) {
      context.globalAlpha = alpha;
      roundedRectPath(context, px + 1.5, py + 1.5, size - 3, size - 3, 7);
      context.fillStyle = color;
      context.fill();
      context.lineWidth = 1;
      context.strokeStyle = 'rgba(120,100,100,0.25)';
      context.stroke();
      // brillo suave con curva cuadrática
      context.beginPath();
      context.moveTo(px + 6, py + size * 0.4);
      context.quadraticCurveTo(px + 6, py + 6, px + size * 0.45, py + 6);
      context.strokeStyle = 'rgba(255,255,255,0.8)';
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.stroke();
      context.lineCap = 'butt';
      context.globalAlpha = 1;
    },
  },
  pixel: {
    label: 'Pixel art',
    colors: [null, '#29b6f6', '#fdd835', '#ab47bc', '#66bb6a', '#ef5350', '#5c6bc0', '#ff9800'],
    background: '#1b1b2b',
    grid: '#262638',
    drawBlock(context, px, py, size, color, alpha) {
      context.globalAlpha = alpha;
      const x = px + 1, y = py + 1, s = size - 2, t = 3;
      context.fillStyle = color;
      context.fillRect(x, y, s, s);
      // bordes claros arriba/izquierda, oscuros abajo/derecha
      context.fillStyle = shade(color, 60);
      context.fillRect(x, y, s, t);
      context.fillRect(x, y, t, s);
      context.fillStyle = shade(color, -70);
      context.fillRect(x, y + s - t, s, t);
      context.fillRect(x + s - t, y, t, s);
      // sub-cuadrados de textura
      context.fillStyle = shade(color, 35);
      context.fillRect(x + 6, y + 6, 3, 3);
      context.fillRect(x + 12, y + 12, 3, 3);
      context.fillStyle = shade(color, -35);
      context.fillRect(x + 12, y + 6, 3, 3);
      context.fillRect(x + 6, y + 12, 3, 3);
      context.globalAlpha = 1;
    },
  },
};

const DEFAULT_SKIN = 'retro';
let currentSkin = SKINS[DEFAULT_SKIN];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  currentSkin.drawBlock(context, x * size, y * size, size, COLORS[colorIndex], alpha ?? 1);
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === skinSelect) return; // el select maneja sus propias teclas
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function applyVisuals() {
  COLORS = currentSkin.colors;
  const styles = getComputedStyle(document.documentElement);
  gridColor = currentSkin.grid || styles.getPropertyValue('--grid').trim();
  highlightColor = styles.getPropertyValue('--block-highlight').trim();
  // Fondo de los canvas: el del skin, o el del tema CSS en retro.
  const bg = currentSkin.background || '';
  canvas.style.background = bg;
  nextCanvas.style.background = bg;
  // El bucle rAF está cancelado en pausa/game over: redibujar manualmente.
  if (current && next) { draw(); drawNext(); }
}

function applyTheme(theme) {
  const light = theme === 'light';
  currentTheme = light ? 'light' : 'dark';
  document.documentElement.dataset.theme = currentTheme;
  themeToggle.textContent = light ? '☾ Modo oscuro' : '☀ Modo claro';
  themeToggle.setAttribute('aria-pressed', String(light));
  applyVisuals();
}

function applySkin(name) {
  const key = Object.prototype.hasOwnProperty.call(SKINS, name) ? name : DEFAULT_SKIN;
  currentSkin = SKINS[key];
  skinSelect.value = key;
  applyVisuals();
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  try { localStorage.setItem('tetris.skin', skinSelect.value); } catch (e) {}
  skinSelect.blur(); // evita que las flechas cambien el skin durante el juego
});

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(theme);
  try { localStorage.setItem('theme', theme); } catch (e) {}
  themeToggle.blur(); // evita que Space active el botón
});

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; } catch (e) {}
let savedSkin = DEFAULT_SKIN;
try { savedSkin = localStorage.getItem('tetris.skin') || DEFAULT_SKIN; } catch (e) {}
applySkin(savedSkin);
applyTheme(savedTheme);

init();

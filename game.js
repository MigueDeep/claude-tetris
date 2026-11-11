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
const overlayMsg = document.getElementById('overlay-msg');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const recordsBox = document.getElementById('records');
const recordsBody = document.getElementById('records-body');
const recordsExtra = document.getElementById('records-extra');
const clearRecordsBtn = document.getElementById('clear-records-btn');

const HS_KEY = 'tetris.highscores';
const COMBO_KEY = 'tetris.bestCombo';
const MAXLINES_KEY = 'tetris.maxLines';
const MAX_SCORES = 5;

let started = false, combo = 0, bestCombo = 0, pendingEntry = null;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

// ---- Records (localStorage) ----
function loadScores() {
  try {
    const data = JSON.parse(localStorage.getItem(HS_KEY));
    if (!Array.isArray(data)) return [];
    return data
      .filter(e => e && typeof e.name === 'string' && Number.isFinite(e.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SCORES);
  } catch (e) { return []; }
}

function saveScores(list) {
  try { localStorage.setItem(HS_KEY, JSON.stringify(list)); } catch (e) {}
}

function loadNumber(key) {
  try {
    const n = parseInt(localStorage.getItem(key), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (e) { return 0; }
}

function saveNumber(key, n) {
  try { localStorage.setItem(key, String(n)); } catch (e) {}
}

function qualifies(s) {
  if (s <= 0) return false;
  const list = loadScores();
  return list.length < MAX_SCORES || s > list[list.length - 1].score;
}

function renderRecords(highlight) {
  const list = loadScores();
  recordsBody.textContent = '';
  if (!list.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = 'Aún no hay records';
    tr.appendChild(td);
    recordsBody.appendChild(tr);
  }
  list.forEach((e, i) => {
    const tr = document.createElement('tr');
    if (highlight && e.date === highlight.date && e.name === highlight.name && e.score === highlight.score) {
      tr.className = 'new-record';
    }
    const date = new Date(e.date);
    const cells = [i + 1, e.name, e.score.toLocaleString(), e.lines || 0, e.level || 1,
      isNaN(date) ? '' : date.toLocaleDateString()];
    cells.forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    recordsBody.appendChild(tr);
  });
  recordsExtra.textContent =
    `Mejor combo: ${loadNumber(COMBO_KEY)} · Máx. líneas: ${loadNumber(MAXLINES_KEY)}`;
  recordsBox.classList.remove('hidden');
  clearRecordsBtn.classList.remove('hidden');
}

function showStartScreen() {
  overlayTitle.textContent = 'TETRIS';
  overlayTitle.style.color = 'var(--accent)';
  overlayScore.textContent = '';
  overlayMsg.textContent = '';
  nameForm.classList.add('hidden');
  restartBtn.textContent = 'Jugar';
  renderRecords();
  overlay.classList.remove('hidden');
}

function submitName() {
  if (!pendingEntry) return;
  const name = nameInput.value.trim().slice(0, 12) || 'Anónimo';
  const entry = Object.assign({ name }, pendingEntry);
  pendingEntry = null;
  const list = loadScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  saveScores(list.slice(0, MAX_SCORES));
  nameForm.classList.add('hidden');
  overlayMsg.textContent = '¡Record guardado!';
  nameInput.blur();
  renderRecords(entry);
}

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
    combo++;
    if (combo >= 2 && combo > bestCombo) bestCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
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
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = highlightColor;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
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
  overlayTitle.style.color = '';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  restartBtn.textContent = 'Reiniciar';
  if (bestCombo > loadNumber(COMBO_KEY)) saveNumber(COMBO_KEY, bestCombo);
  if (lines > loadNumber(MAXLINES_KEY)) saveNumber(MAXLINES_KEY, lines);
  if (qualifies(score)) {
    pendingEntry = { score, lines, level, date: new Date().toISOString() };
    overlayMsg.textContent = `¡Entraste al top ${MAX_SCORES}! Combo de la partida: ${bestCombo}`;
    nameInput.value = '';
    nameForm.classList.remove('hidden');
    recordsBox.classList.add('hidden');
    clearRecordsBtn.classList.add('hidden');
    overlay.classList.remove('hidden');
    setTimeout(() => { if (pendingEntry) nameInput.focus(); }, 600); // evita capturar teclas de la partida
  } else {
    pendingEntry = null;
    nameForm.classList.add('hidden');
    overlayMsg.textContent = `No entraste al top ${MAX_SCORES}. Combo de la partida: ${bestCombo}`;
    renderRecords();
    overlay.classList.remove('hidden');
  }
}

function togglePause() {
  if (!started || gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlayMsg.textContent = '';
    overlayTitle.style.color = '';
    nameForm.classList.add('hidden');
    recordsBox.classList.add('hidden');
    clearRecordsBtn.classList.add('hidden');
    restartBtn.textContent = 'Reiniciar';
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
  started = true;
  pendingEntry = null;
  combo = 0;
  bestCombo = 0;
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
  nameForm.classList.add('hidden');
  recordsBox.classList.add('hidden');
  clearRecordsBtn.classList.add('hidden');
  overlayTitle.style.color = '';
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === nameInput) return; // escribiendo el nombre: ignorar teclas de juego
  if (!started) return;
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

restartBtn.addEventListener('click', () => {
  restartBtn.blur();
  if (pendingEntry) submitName(); // no perder un record pendiente
  init();
});

nameForm.addEventListener('submit', e => { e.preventDefault(); submitName(); });

clearRecordsBtn.addEventListener('click', () => {
  clearRecordsBtn.blur();
  if (!confirm('¿Borrar todos los records?')) return;
  try {
    localStorage.removeItem(HS_KEY);
    localStorage.removeItem(COMBO_KEY);
    localStorage.removeItem(MAXLINES_KEY);
  } catch (e) {}
  renderRecords();
});

function applyTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  COLORS = light ? COLORS_LIGHT : COLORS_DARK;
  const styles = getComputedStyle(document.documentElement);
  gridColor = styles.getPropertyValue('--grid').trim();
  highlightColor = styles.getPropertyValue('--block-highlight').trim();
  themeToggle.textContent = light ? '☾ Modo oscuro' : '☀ Modo claro';
  themeToggle.setAttribute('aria-pressed', String(light));
  // El bucle rAF está cancelado en pausa/game over: redibujar manualmente.
  if (current && next) { draw(); drawNext(); }
}

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(theme);
  try { localStorage.setItem('theme', theme); } catch (e) {}
  themeToggle.blur(); // evita que Space active el botón
});

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; } catch (e) {}
applyTheme(savedTheme);

// El juego no arranca solo: pantalla de inicio con records.
board = createBoard();
showStartScreen();

const SIZE_OPTIONS = [
  "3x3",
  "4x4",
  "5x5",
  "9x8",
  "13x13",
  "15x15",
  "20x20",
  "15x30",
  "25x25",
  "30x30"
];

const menuScreen = document.getElementById("menuScreen");
const gameScreen = document.getElementById("gameScreen");
const sizeLabel = document.getElementById("sizeLabel");
const sizePrev = document.getElementById("sizePrev");
const sizeNext = document.getElementById("sizeNext");
const newGameButton = document.getElementById("newGameButton");
const resumeButton = document.getElementById("resumeButton");
const themeControl = document.getElementById("themeControl");
const themeToggleButton = document.getElementById("themeToggleButton");
const themePopover = document.getElementById("themePopover");
const backButton = document.getElementById("backButton");
const boardEl = document.getElementById("board");
const viewportShell = document.getElementById("viewportShell");
const gameTitle = document.getElementById("gameTitle");
const statusText = document.getElementById("statusText");
const solvedPanel = document.getElementById("solvedPanel");
const newGameSolvedButton = document.getElementById("newGameSolvedButton");
const menuSolvedButton = document.getElementById("menuSolvedButton");
const solveDialog = document.getElementById("solveDialog");
const solveConfirmButton = document.getElementById("solveConfirmButton");
const solveCloseButton = document.getElementById("solveCloseButton");
const digitPad = document.getElementById("digitPad");
const holdMenu = document.getElementById("holdMenu");
const clearBoardButton = document.getElementById("clearBoardButton");
const clearBoardCloseButton = document.getElementById("clearBoardCloseButton");
const centerButton = document.getElementById("centerButton");
const mapViewport = document.getElementById("mapViewport");
const mapCanvas = document.getElementById("mapCanvas");
const adSlot = document.getElementById("adSlot");
const launchSplash = document.getElementById("launchSplash");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingMessage = document.getElementById("loadingMessage");
const appRoot = document.querySelector(".app");
const themeModeButtons = Array.from(document.querySelectorAll("[data-theme-choice]"));
const themeAccentButtons = Array.from(document.querySelectorAll("[data-accent-choice]"));

const THEME_STORAGE_KEY = "kakuro-theme";
const ACCENT_STORAGE_KEY = "kakuro-accent";
const MENU_SIZE_STORAGE_KEY = "kakuro-menu-size";
const GAME_STATE_STORAGE_KEY = "kakuro-active-game";
const GAME_STATE_VERSION = 2;
const DEFAULT_ACCENT = "purple";
const ACCENT_OPTIONS = Object.freeze({
  purple: { label: "Purple" },
  halflife: { label: "Half-Life orange" },
  gold: { label: "Gold" },
  cyan: { label: "Cyan" },
  teal: { label: "Teal" },
  lime: { label: "#67B500" },
  coral: { label: "Coral" },
  forest: { label: "#254500" },
  crimson: { label: "#960000" }
});

function getStoredMenuSizeIndex() {
  try {
    const storedSize = localStorage.getItem(MENU_SIZE_STORAGE_KEY);
    const storedIndex = SIZE_OPTIONS.indexOf(storedSize);
    return storedIndex >= 0 ? storedIndex : 0;
  } catch (_) {
    return 0;
  }
}

function rememberMenuSize(sizeKey) {
  try {
    localStorage.setItem(MENU_SIZE_STORAGE_KEY, sizeKey);
  } catch (_) {
    return;
  }
}

let menuSizeIndex = getStoredMenuSizeIndex();
let selectedSize = SIZE_OPTIONS[menuSizeIndex];
let game = null;
let selectedCell = null;
let movedOnPointer = false;
const pointerStartCell = new Map();

const view = {
  scale: 1,
  minScale: 0.3,
  maxScale: 2.8,
  x: 0,
  y: 0
};

const pointers = new Map();
let dragState = null;
let pinchState = null;
let clearHoldTimer = null;
let clearLongPressTriggered = false;
let suppressClearClick = false;
let centerHoldTimer = null;
let centerLongPressTriggered = false;
let suppressCenterClick = false;
let adMobInitPromise = null;
let adMobBannerRequested = false;
let adMobBannerVisible = false;
let adMobListenersBound = false;
let adMobResizeTimer = null;
let adMobInterstitialLoadingPromise = null;
let adMobInterstitialReady = false;
let adMobInterstitialShowing = false;
let adMobInterstitialPresenting = false;
let timedInterstitialTimer = null;
let timedInterstitialStartedAt = 0;
let timedInterstitialPending = false;
let startGameRequestId = 0;

const ADMOB_BANNER_ID = "ca-app-pub-5035787704061193/3407280627";
const ADMOB_INTERSTITIAL_ID = "ca-app-pub-5035787704061193/9074384747";
const TIMED_INTERSTITIAL_DELAY_MS = 5 * 60 * 1000;
const INTERSTITIAL_SOLVE_THRESHOLD = 3;
const LAUNCH_SPLASH_READY_DELAY_MS = 620;
const LAUNCH_SPLASH_HIDE_DELAY_MS = 1500;
const LOADING_OVERLAY_EXIT_MS = 180;
const TAP_BURST_DURATION_MS = 420;
const CENTER_SOLVE_HOLD_MS = 560;
const ANIMATED_BUTTON_SELECTOR = ".theme-toggle, .menu-nav-btn, .menu-pill, .icon-btn, .pill, .digit-btn, .mini-btn, .theme-choice-btn, .theme-accent-btn";
let timedInterstitialRemainingMs = TIMED_INTERSTITIAL_DELAY_MS;
let solvedGamesSinceInterstitial = 0;
let activeTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
let activeAccent = Object.prototype.hasOwnProperty.call(ACCENT_OPTIONS, document.documentElement.dataset.accent)
  ? document.documentElement.dataset.accent
  : DEFAULT_ACCENT;
let activePadDigit = null;
let loadingOverlayHideTimer = null;
let transformFrameId = 0;
const buttonBurstTimers = new WeakMap();

function preventBrowserDefault(event) {
  if (event.cancelable) {
    event.preventDefault();
  }
}

function bindShellGuards() {
  ["gesturestart", "gesturechange", "gestureend", "contextmenu", "selectstart", "dragstart", "dblclick"].forEach((eventName) => {
    document.addEventListener(eventName, preventBrowserDefault);
  });

  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length > 1) {
        preventBrowserDefault(event);
      }
    },
    { passive: false }
  );
}

function startLaunchSequence() {
  window.setTimeout(() => {
    document.body.classList.add("app-ready");
  }, LAUNCH_SPLASH_READY_DELAY_MS);

  if (launchSplash) {
    window.setTimeout(() => {
      launchSplash.hidden = true;
    }, LAUNCH_SPLASH_HIDE_DELAY_MS);
  }
}

function waitForUiPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

function showLoadingOverlay(message) {
  if (loadingMessage && typeof message === "string" && message.trim()) {
    loadingMessage.textContent = message;
  }
  if (appRoot) {
    appRoot.setAttribute("aria-busy", "true");
  }
  document.body.classList.add("loading-visible");
  if (!loadingOverlay) {
    return;
  }
  if (loadingOverlayHideTimer) {
    clearTimeout(loadingOverlayHideTimer);
    loadingOverlayHideTimer = null;
  }
  loadingOverlay.hidden = false;
  loadingOverlay.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    loadingOverlay.classList.add("visible");
  });
}

function hideLoadingOverlay() {
  if (appRoot) {
    appRoot.removeAttribute("aria-busy");
  }
  document.body.classList.remove("loading-visible");
  if (!loadingOverlay) {
    return;
  }
  if (loadingOverlayHideTimer) {
    clearTimeout(loadingOverlayHideTimer);
  }
  loadingOverlay.classList.remove("visible");
  loadingOverlay.setAttribute("aria-hidden", "true");
  loadingOverlayHideTimer = window.setTimeout(() => {
    loadingOverlay.hidden = true;
    loadingOverlayHideTimer = null;
  }, LOADING_OVERLAY_EXIT_MS);
}

function triggerButtonTapBurst(button) {
  const existingTimer = buttonBurstTimers.get(button);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  button.classList.remove("tap-burst");
  requestAnimationFrame(() => {
    button.classList.add("tap-burst");
    const timer = window.setTimeout(() => {
      button.classList.remove("tap-burst");
      buttonBurstTimers.delete(button);
    }, TAP_BURST_DURATION_MS);
    buttonBurstTimers.set(button, timer);
  });
}

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch (_) {
    return "dark";
  }
}

function isValidAccent(accent) {
  return Object.prototype.hasOwnProperty.call(ACCENT_OPTIONS, accent);
}

function getStoredAccent() {
  try {
    const storedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
    return isValidAccent(storedAccent) ? storedAccent : DEFAULT_ACCENT;
  } catch (_) {
    return DEFAULT_ACCENT;
  }
}

function getAccentLabel(accent) {
  return isValidAccent(accent) ? ACCENT_OPTIONS[accent].label : ACCENT_OPTIONS[DEFAULT_ACCENT].label;
}

function syncThemeControls() {
  const isPopoverOpen = Boolean(themePopover && !themePopover.hidden);
  const themeLabel = activeTheme === "light" ? "light" : "dark";
  const accentLabel = getAccentLabel(activeAccent).toLowerCase();

  if (themeToggleButton) {
    themeToggleButton.classList.toggle("open", isPopoverOpen);
    themeToggleButton.setAttribute("aria-pressed", String(isPopoverOpen));
    themeToggleButton.setAttribute("aria-expanded", String(isPopoverOpen));
    themeToggleButton.setAttribute(
      "aria-label",
      `${isPopoverOpen ? "Close theme settings" : "Open theme settings"}. Mode: ${themeLabel}. Accent: ${accentLabel}.`
    );
    themeToggleButton.setAttribute(
      "title",
      `${isPopoverOpen ? "Close theme settings" : "Open theme settings"} (${themeLabel}, ${accentLabel})`
    );
  }

  themeModeButtons.forEach((button) => {
    const isActive = button.dataset.themeChoice === activeTheme;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  themeAccentButtons.forEach((button) => {
    const isActive = button.dataset.accentChoice === activeAccent;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setThemePopoverOpen(open) {
  if (!themePopover) {
    syncThemeControls();
    return;
  }

  themePopover.hidden = !open;
  syncThemeControls();
}

function applyTheme(theme, persist = true) {
  activeTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = activeTheme;
  syncThemeControls();
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
    } catch (_) {
      return;
    }
  }
}

function applyAccent(accent, persist = true) {
  activeAccent = isValidAccent(accent) ? accent : DEFAULT_ACCENT;
  document.documentElement.dataset.accent = activeAccent;
  syncThemeControls();
  if (persist) {
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, activeAccent);
    } catch (_) {
      return;
    }
  }
}

function toggleThemePopover() {
  setThemePopoverOpen(themePopover ? themePopover.hidden : false);
}

function parseSize(sizeKey) {
  const [rows, cols] = sizeKey.split("x").map(Number);
  return { rows, cols };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

function isSupportedSizeKey(sizeKey) {
  return SIZE_OPTIONS.includes(sizeKey);
}

function isIntegerMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0]) || matrix[0].length === 0) {
    return false;
  }

  const width = matrix[0].length;
  return matrix.every(
    (row) => Array.isArray(row) && row.length === width && row.every((value) => Number.isInteger(value))
  );
}

function isCompatiblePersistedBoards(board, boardSol) {
  if (!isIntegerMatrix(board) || !isIntegerMatrix(boardSol)) {
    return false;
  }
  if (board.length !== boardSol.length || board[0].length !== boardSol[0].length) {
    return false;
  }

  for (let y = 0; y < board.length; y += 1) {
    for (let x = 0; x < board[0].length; x += 1) {
      const currentValue = board[y][x];
      const solvedValue = boardSol[y][x];
      if (isPlayCell(solvedValue)) {
        if (!isPlayCell(currentValue)) {
          return false;
        }
        continue;
      }
      if (currentValue !== solvedValue) {
        return false;
      }
    }
  }

  return true;
}

function clearPersistedGameState() {
  try {
    localStorage.removeItem(GAME_STATE_STORAGE_KEY);
  } catch (_) {
    return;
  }
}

function readPersistedGameSnapshot() {
  try {
    const rawSnapshot = localStorage.getItem(GAME_STATE_STORAGE_KEY);
    if (!rawSnapshot) {
      return null;
    }

    const snapshot = JSON.parse(rawSnapshot);
    if (!snapshot || snapshot.version !== GAME_STATE_VERSION || !isSupportedSizeKey(snapshot.sizeKey)) {
      clearPersistedGameState();
      return null;
    }

    const { rows, cols } = parseSize(snapshot.sizeKey);
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) {
      clearPersistedGameState();
      return null;
    }

    if (!isCompatiblePersistedBoards(snapshot.board, snapshot.boardSol)) {
      clearPersistedGameState();
      return null;
    }

    if (
      snapshot.board.length !== rows ||
      snapshot.board[0].length !== cols ||
      snapshot.boardSol.length !== rows ||
      snapshot.boardSol[0].length !== cols
    ) {
      clearPersistedGameState();
      return null;
    }

    return snapshot;
  } catch (_) {
    clearPersistedGameState();
    return null;
  }
}

function syncPersistedGameState() {
  if (!game || game.isSolved || !isSupportedSizeKey(game.sizeKey)) {
    clearPersistedGameState();
    return;
  }

  const snapshot = {
    version: GAME_STATE_VERSION,
    sizeKey: game.sizeKey,
    board: cloneMatrix(game.board),
    boardSol: cloneMatrix(game.boardSol)
  };

  try {
    localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (_) {
    return;
  }
}

function getHoriz(code) {
  return Math.floor(code / 1000);
}

function getVert(code) {
  return Math.floor(code / 10) % 100;
}

function encodeClue(horizontal, vertical) {
  return horizontal * 1000 + vertical * 10;
}

function isPlayCell(value) {
  return value >= 0 && value <= 9;
}

function isClueCell(value) {
  return value > 9;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createMatrix(rows, cols, fill) {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

function shuffleList(values) {
  const list = values.slice();
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = randInt(0, index);
    const temp = list[index];
    list[index] = list[swapIndex];
    list[swapIndex] = temp;
  }
  return list;
}

function cloneBoolMask(mask) {
  return mask.map((row) => row.slice());
}

const ALL_DIGIT_MASK = 0b1111111110;
const RUN_COMBINATION_CACHE = new Map();

function digitBit(digit) {
  return 1 << digit;
}

function countBits(mask) {
  let count = 0;
  let value = mask;
  while (value) {
    value &= value - 1;
    count += 1;
  }
  return count;
}

function digitsFromMask(mask) {
  const digits = [];
  for (let digit = 1; digit <= 9; digit += 1) {
    if (mask & digitBit(digit)) {
      digits.push(digit);
    }
  }
  return digits;
}

function singleDigitFromMask(mask) {
  for (let digit = 1; digit <= 9; digit += 1) {
    if (mask === digitBit(digit)) {
      return digit;
    }
  }
  return 0;
}

function getDigitMaskSum(mask) {
  let total = 0;
  for (let digit = 1; digit <= 9; digit += 1) {
    if (mask & digitBit(digit)) {
      total += digit;
    }
  }
  return total;
}

function buildCombinationMasks(length, sum, startDigit = 1, chosen = 0, total = 0, mask = 0, out = []) {
  if (chosen === length) {
    if (total === sum) {
      out.push(mask);
    }
    return out;
  }

  const remaining = length - chosen;
  for (let digit = startDigit; digit <= 10 - remaining; digit += 1) {
    const nextTotal = total + digit;
    if (nextTotal > sum) {
      break;
    }
    buildCombinationMasks(length, sum, digit + 1, chosen + 1, nextTotal, mask | digitBit(digit), out);
  }
  return out;
}

function getCombinationMasks(length, sum) {
  const key = `${length}:${sum}`;
  if (!RUN_COMBINATION_CACHE.has(key)) {
    RUN_COMBINATION_CACHE.set(key, buildCombinationMasks(length, sum));
  }
  return RUN_COMBINATION_CACHE.get(key);
}

function getPreferredCombinationLimit(length) {
  if (length <= 2) {
    return 2;
  }
  if (length === 3) {
    return 3;
  }
  if (length === 4) {
    return 5;
  }
  if (length === 5) {
    return 8;
  }
  return 14;
}

function drawRect(mask, top, left, height, width, value = true) {
  const rows = mask.length;
  const cols = mask[0].length;
  for (let y = Math.max(0, top); y < Math.min(rows, top + height); y += 1) {
    for (let x = Math.max(0, left); x < Math.min(cols, left + width); x += 1) {
      mask[y][x] = value;
    }
  }
}

function paintBrush(mask, y, x, width = 2) {
  drawRect(mask, y, x, width, width, true);
}

function drawWideSegment(mask, startY, startX, endY, endX, width = 2) {
  if (startY === endY) {
    const from = Math.min(startX, endX);
    const to = Math.max(startX, endX);
    for (let x = from; x <= to; x += 1) {
      paintBrush(mask, startY, x, width);
    }
    if (width >= 2 && to - from >= 6) {
      for (let x = from + 3, notchIndex = 0; x <= to - 2; x += 4, notchIndex += 1) {
        const lane = notchIndex % 2;
        if (startY + lane < mask.length) {
          mask[startY + lane][x] = false;
        }
        if (x + 2 <= to - 1 && startY + 1 - lane < mask.length) {
          mask[startY + 1 - lane][x + 2] = false;
        }
      }
    }
    return;
  }

  const from = Math.min(startY, endY);
  const to = Math.max(startY, endY);
  for (let y = from; y <= to; y += 1) {
    paintBrush(mask, y, startX, width);
  }
  if (width >= 2 && to - from >= 6) {
    for (let y = from + 3, notchIndex = 0; y <= to - 2; y += 4, notchIndex += 1) {
      const lane = notchIndex % 2;
      if (startX + lane < mask[0].length) {
        mask[y][startX + lane] = false;
      }
      if (y + 2 <= to - 1 && startX + 1 - lane < mask[0].length) {
        mask[y + 2][startX + 1 - lane] = false;
      }
    }
  }
}

function drawConnector(mask, from, to, width = 3) {
  if (Math.random() < 0.5) {
    drawWideSegment(mask, from.y, from.x, from.y, to.x, width);
    drawWideSegment(mask, from.y, to.x, to.y, to.x, width);
  } else {
    drawWideSegment(mask, from.y, from.x, to.y, from.x, width);
    drawWideSegment(mask, to.y, from.x, to.y, to.x, width);
  }
}

function addCluster(mask, clusters, top, left, size) {
  const rows = mask.length;
  const cols = mask[0].length;
  const y = clamp(top, 0, Math.max(0, rows - size));
  const x = clamp(left, 0, Math.max(0, cols - size));
  drawRect(mask, y, x, size, size, true);
  clusters.push({
    y: clamp(y + Math.floor(size / 2), 0, rows - 1),
    x: clamp(x + Math.floor(size / 2), 0, cols - 1)
  });
}

function addRectCluster(mask, clusters, top, left, height, width) {
  const rows = mask.length;
  const cols = mask[0].length;
  const y = clamp(top, 0, Math.max(0, rows - height));
  const x = clamp(left, 0, Math.max(0, cols - width));
  drawRect(mask, y, x, height, width, true);
  clusters.push({
    y: clamp(y + Math.floor(height / 2), 0, rows - 1),
    x: clamp(x + Math.floor(width / 2), 0, cols - 1)
  });
}

function getRunSpan(mask, y, x, dy, dx) {
  let startY = y;
  let startX = x;
  let endY = y;
  let endX = x;
  while (
    startY - dy >= 0 &&
    startY - dy < mask.length &&
    startX - dx >= 0 &&
    startX - dx < mask[0].length &&
    mask[startY - dy][startX - dx]
  ) {
    startY -= dy;
    startX -= dx;
  }
  while (
    endY + dy >= 0 &&
    endY + dy < mask.length &&
    endX + dx >= 0 &&
    endX + dx < mask[0].length &&
    mask[endY + dy][endX + dx]
  ) {
    endY += dy;
    endX += dx;
  }
  return {
    startY,
    startX,
    endY,
    endX,
    length: Math.max(Math.abs(endY - startY), Math.abs(endX - startX)) + 1
  };
}

function getMaskComponents(mask) {
  const rows = mask.length;
  const cols = mask[0].length;
  const seen = createMatrix(rows, cols, false);
  const components = [];
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!mask[y][x] || seen[y][x]) {
        continue;
      }

      const queue = [{ y, x }];
      const cells = [];
      seen[y][x] = true;
      for (let index = 0; index < queue.length; index += 1) {
        const current = queue[index];
        cells.push(current);
        directions.forEach(([dy, dx]) => {
          const ny = current.y + dy;
          const nx = current.x + dx;
          if (ny < 0 || ny >= rows || nx < 0 || nx >= cols || seen[ny][nx] || !mask[ny][nx]) {
            return;
          }
          seen[ny][nx] = true;
          queue.push({ y: ny, x: nx });
        });
      }
      components.push(cells);
    }
  }

  return components;
}

function getComponentCenter(component) {
  const total = component.reduce((acc, cell) => ({ y: acc.y + cell.y, x: acc.x + cell.x }), { y: 0, x: 0 });
  const centerY = total.y / component.length;
  const centerX = total.x / component.length;
  return component.reduce((best, cell) => {
    const bestDistance = Math.abs(best.y - centerY) + Math.abs(best.x - centerX);
    const distance = Math.abs(cell.y - centerY) + Math.abs(cell.x - centerX);
    return distance < bestDistance ? cell : best;
  }, component[0]);
}

function connectMaskComponents(mask) {
  let components = getMaskComponents(mask).sort((left, right) => right.length - left.length);
  let guard = 0;
  while (components.length > 1 && guard < 20) {
    guard += 1;
    const mainCenter = getComponentCenter(components[0]);
    let bestIndex = 1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 1; index < components.length; index += 1) {
      const center = getComponentCenter(components[index]);
      const distance = Math.abs(center.y - mainCenter.y) + Math.abs(center.x - mainCenter.x);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    drawConnector(mask, mainCenter, getComponentCenter(components[bestIndex]), 3);
    components = getMaskComponents(mask).sort((left, right) => right.length - left.length);
  }
}

function removeInvalidWritableCells(mask) {
  let changed = true;
  let pass = 0;
  while (changed && pass < mask.length + mask[0].length) {
    changed = false;
    pass += 1;
    const remove = [];
    for (let y = 0; y < mask.length; y += 1) {
      for (let x = 0; x < mask[0].length; x += 1) {
        if (!mask[y][x]) {
          continue;
        }
        const horizontal = getRunSpan(mask, y, x, 0, 1).length;
        const vertical = getRunSpan(mask, y, x, 1, 0).length;
        if (horizontal < 2 || vertical < 2) {
          remove.push({ y, x });
        }
      }
    }
    remove.forEach((cell) => {
      if (mask[cell.y][cell.x]) {
        mask[cell.y][cell.x] = false;
        changed = true;
      }
    });
  }
}

function cutLongRuns(mask, maxRunLength = 9) {
  let changed = false;
  for (let y = 0; y < mask.length; y += 1) {
    let x = 0;
    while (x < mask[0].length) {
      if (!mask[y][x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < mask[0].length && mask[y][x]) {
        x += 1;
      }
      const length = x - start;
      if (length > maxRunLength) {
        const cut = start + clamp(Math.floor(length / 2), 2, length - 3);
        mask[y][cut] = false;
        changed = true;
      }
    }
  }

  for (let x = 0; x < mask[0].length; x += 1) {
    let y = 0;
    while (y < mask.length) {
      if (!mask[y][x]) {
        y += 1;
        continue;
      }
      const start = y;
      while (y < mask.length && mask[y][x]) {
        y += 1;
      }
      const length = y - start;
      if (length > maxRunLength) {
        const cut = start + clamp(Math.floor(length / 2), 2, length - 3);
        mask[cut][x] = false;
        changed = true;
      }
    }
  }
  return changed;
}

function splitOversizedRuns(mask, preferredMaxLength = 5) {
  let changed = false;
  for (let y = 0; y < mask.length; y += 1) {
    let x = 0;
    while (x < mask[0].length) {
      if (!mask[y][x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < mask[0].length && mask[y][x]) {
        x += 1;
      }
      const length = x - start;
      if (length > preferredMaxLength) {
        const cutMin = start + 2;
        const cutMax = x - 3;
        if (cutMin <= cutMax) {
          const preferred = start + clamp(Math.round(length / 2), 2, length - 3);
          mask[y][clamp(preferred, cutMin, cutMax)] = false;
          changed = true;
        }
      }
    }
  }

  for (let x = 0; x < mask[0].length; x += 1) {
    let y = 0;
    while (y < mask.length) {
      if (!mask[y][x]) {
        y += 1;
        continue;
      }
      const start = y;
      while (y < mask.length && mask[y][x]) {
        y += 1;
      }
      const length = y - start;
      if (length > preferredMaxLength) {
        const cutMin = start + 2;
        const cutMax = y - 3;
        if (cutMin <= cutMax) {
          const preferred = start + clamp(Math.round(length / 2), 2, length - 3);
          mask[clamp(preferred, cutMin, cutMax)][x] = false;
          changed = true;
        }
      }
    }
  }
  return changed;
}

function getMaskRuns(mask) {
  const rowRuns = [];
  const colRuns = [];
  for (let y = 0; y < mask.length; y += 1) {
    let x = 0;
    while (x < mask[0].length) {
      if (!mask[y][x]) {
        x += 1;
        continue;
      }
      const cells = [];
      while (x < mask[0].length && mask[y][x]) {
        cells.push({ y, x });
        x += 1;
      }
      if (cells.length > 0) {
        rowRuns.push(cells);
      }
    }
  }

  for (let x = 0; x < mask[0].length; x += 1) {
    let y = 0;
    while (y < mask.length) {
      if (!mask[y][x]) {
        y += 1;
        continue;
      }
      const cells = [];
      while (y < mask.length && mask[y][x]) {
        cells.push({ y, x });
        y += 1;
      }
      if (cells.length > 0) {
        colRuns.push(cells);
      }
    }
  }

  return { rowRuns, colRuns };
}

function reduceLongRunPressure(mask) {
  for (let pass = 0; pass < 7; pass += 1) {
    const stats = measureWritableMask(mask);
    const area = mask.length * mask[0].length;
    const targetBucketRatio = area <= 80 ? 0 : area <= 420 ? 0.025 : area <= 700 ? 0.025 : 0.018;
    const maxBucketRatio = area <= 80 ? 0.08 : area <= 420 ? 0.055 : 0.06;
    const balanceTolerance = area <= 80 ? 0.08 : area <= 420 ? 0.025 : 0.04;
    if (
      stats.maxRun <= 8 &&
      stats.fiveSixRunRatio <= maxBucketRatio &&
      stats.sevenEightRunRatio <= maxBucketRatio &&
      Math.abs(stats.fiveSixRunRatio - stats.sevenEightRunRatio) <= balanceTolerance
    ) {
      return;
    }

    const trimSevenEight = stats.sevenEightRunRatio > stats.fiveSixRunRatio + balanceTolerance ||
      stats.sevenEightRunRatio > maxBucketRatio;
    const trimFiveSix = stats.fiveSixRunRatio > stats.sevenEightRunRatio + balanceTolerance ||
      stats.fiveSixRunRatio > maxBucketRatio;
    const runs = getMaskRuns(mask)
      .rowRuns
      .concat(getMaskRuns(mask).colRuns)
      .filter((run) => (
        run.length > 8 ||
        (trimSevenEight && run.length >= 7 && run.length <= 8) ||
        (trimFiveSix && run.length >= 5 && run.length <= 6) ||
        (!trimSevenEight && !trimFiveSix && run.length >= 5 && stats.longRunRatio > targetBucketRatio * 2)
      ))
      .sort((left, right) => right.length - left.length);
    let changed = false;

    for (const run of runs) {
      const middle = Math.floor(run.length / 2);
      const candidateIndexes = run.length <= 6
        ? [middle, middle - 1, middle + 1, 0, run.length - 1, 1, run.length - 2]
        : [];
      if (run.length > 6) {
        for (let offset = 0; offset <= Math.ceil(run.length / 2); offset += 1) {
          candidateIndexes.push(middle - offset, middle + offset);
        }
      }

      for (const index of candidateIndexes) {
        if (index < 0 || index >= run.length) {
          continue;
        }
        const cell = run[index];
        if (!cell || !mask[cell.y] || !mask[cell.y][cell.x]) {
          continue;
        }

        mask[cell.y][cell.x] = false;
        const stats = measureWritableMask(mask);
        if (
          stats.components === 1 &&
          stats.rowsCovered === mask.length &&
          stats.colsCovered === mask[0].length &&
          stats.minRun >= 2 &&
          stats.maxRun <= 8
        ) {
          changed = true;
          break;
        }
        mask[cell.y][cell.x] = true;
      }
    }

    if (!changed) {
      return;
    }
  }
}

function canRemoveWritableCell(mask, cell) {
  if (!cell || !mask[cell.y] || !mask[cell.y][cell.x]) {
    return false;
  }

  mask[cell.y][cell.x] = false;
  const stats = measureWritableMask(mask);
  const isValid =
    stats.components === 1 &&
    stats.rowsCovered === mask.length &&
    stats.colsCovered === mask[0].length &&
    stats.minRun >= 2 &&
    stats.maxRun <= 8;
  if (!isValid) {
    mask[cell.y][cell.x] = true;
  }
  return isValid;
}

function reduceMediumRunPressure(mask) {
  const area = mask.length * mask[0].length;
  if (area <= 25) {
    return;
  }

  const maxPasses = area > 420 ? 5 : 3;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const stats = measureWritableMask(mask);
    const targetTwoThreeRatio = area <= 80 ? 0.58 : area <= 420 ? 0.64 : 0.68;
    const targetMediumRatio = area <= 80 ? 0.34 : area <= 420 ? 0.28 : 0.24;
    if (
      stats.twoThreeRunRatio >= targetTwoThreeRatio &&
      stats.mediumRunRatio <= targetMediumRatio
    ) {
      return;
    }

    const runs = getMaskRuns(mask)
      .rowRuns
      .concat(getMaskRuns(mask).colRuns)
      .filter((run) => run.length === 4)
      .sort((left, right) => {
        if (right.length !== left.length) {
          return right.length - left.length;
        }
        return Math.random() - 0.5;
      });
    const maxCuts = Math.max(1, Math.round(stats.runCount * (area > 420 ? 0.12 : 0.08)));
    let cuts = 0;

    for (const run of runs) {
      if (cuts >= maxCuts) {
        break;
      }

      const candidateIndexes = Math.random() < 0.5 ? [0, 3] : [3, 0];

      for (const index of candidateIndexes) {
        const cell = run[index];
        if (!cell || !mask[cell.y] || !mask[cell.y][cell.x]) {
          continue;
        }

        if (canRemoveWritableCell(mask, cell)) {
          cuts += 1;
          break;
        }
      }
    }

    if (cuts === 0) {
      return;
    }
  }
}

function increaseClueDensity(mask) {
  const area = mask.length * mask[0].length;
  if (area <= 100) {
    return;
  }

  const targetEquationRatio = area > 700 ? 0.8 : area > 420 ? 0.78 : area > 100 ? 0.72 : 0.68;
  const maxPasses = area > 700 ? 14 : area > 420 ? 10 : 6;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const stats = measureWritableMask(mask);
    if (stats.equationRatio >= targetEquationRatio) {
      return;
    }
    const targetLongBucketRatio = area <= 420 ? 0.025 : area <= 700 ? 0.025 : 0.02;

    const runs = getMaskRuns(mask)
      .rowRuns
      .concat(getMaskRuns(mask).colRuns)
      .filter((run) => run.length >= 3)
      .sort((left, right) => {
        const priority = (run) => {
          if (run.length > 8) {
            return 100 + run.length;
          }
          if (run.length >= 7) {
            return stats.sevenEightRunRatio > targetLongBucketRatio ? 70 + run.length : 5;
          }
          if (run.length >= 5) {
            return stats.fiveSixRunRatio > targetLongBucketRatio ? 65 + run.length : 6;
          }
          return 35 + run.length;
        };
        return priority(right) - priority(left) || Math.random() - 0.5;
      });
    const maxCuts = Math.max(2, Math.round(stats.runCount * (area > 700 ? 0.14 : area > 420 ? 0.13 : 0.12)));
    let cuts = 0;

    for (const run of runs) {
      if (cuts >= maxCuts) {
        break;
      }
      const candidateIndexes = run.length === 3
        ? (Math.random() < 0.5 ? [0, 2] : [2, 0])
        : [Math.floor(run.length / 2), 0, run.length - 1, 1, run.length - 2];

      for (const index of candidateIndexes) {
        const cell = run[index];
        if (cell && canRemoveWritableCell(mask, cell)) {
          cuts += 1;
          break;
        }
      }
    }

    if (cuts === 0) {
      return;
    }
  }
}

function measureWritableMask(mask) {
  const rows = mask.length;
  const cols = mask[0].length;
  const runs = getMaskRuns(mask);
  const lengths = runs.rowRuns.concat(runs.colRuns).map((run) => run.length);
  const twoThreeRuns = lengths.filter((length) => length === 2 || length === 3).length;
  const fourRuns = lengths.filter((length) => length === 4).length;
  const fiveRuns = lengths.filter((length) => length === 5).length;
  const mediumRuns = fourRuns;
  const fiveSixRuns = lengths.filter((length) => length === 5 || length === 6).length;
  const sevenEightRuns = lengths.filter((length) => length === 7 || length === 8).length;
  const longRuns = lengths.filter((length) => length >= 5).length;
  const veryLongRuns = lengths.filter((length) => length >= 7).length;
  const playable = mask.reduce((total, row) => total + row.filter(Boolean).length, 0);
  const rowsCovered = mask.filter((row) => row.some(Boolean)).length;
  let colsCovered = 0;
  for (let x = 0; x < cols; x += 1) {
    if (mask.some((row) => row[x])) {
      colsCovered += 1;
    }
  }
  const shortRuns = lengths.filter((length) => length >= 2 && length <= 4).length;
  let edgeCells = 0;
  let edgePlayable = 0;
  for (let x = 0; x < cols; x += 1) {
    edgeCells += 1;
    if (mask[0][x]) {
      edgePlayable += 1;
    }
    if (rows > 1) {
      edgeCells += 1;
      if (mask[rows - 1][x]) {
        edgePlayable += 1;
      }
    }
  }
  for (let y = 1; y < rows - 1; y += 1) {
    edgeCells += 1;
    if (mask[y][0]) {
      edgePlayable += 1;
    }
    if (cols > 1) {
      edgeCells += 1;
      if (mask[y][cols - 1]) {
        edgePlayable += 1;
      }
    }
  }
  const cornerDepth = Math.min(3, rows, cols);
  const cornerStarts = [
    { y: 0, x: 0 },
    { y: 0, x: cols - cornerDepth },
    { y: rows - cornerDepth, x: 0 },
    { y: rows - cornerDepth, x: cols - cornerDepth }
  ];
  let cornerCells = 0;
  let cornerPlayable = 0;
  cornerStarts.forEach((corner) => {
    for (let y = corner.y; y < corner.y + cornerDepth; y += 1) {
      for (let x = corner.x; x < corner.x + cornerDepth; x += 1) {
        cornerCells += 1;
        if (mask[y][x]) {
          cornerPlayable += 1;
        }
      }
    }
  });
  return {
    playable,
    ratio: playable / Math.max(1, rows * cols),
    rowsCovered,
    colsCovered,
    components: getMaskComponents(mask).length,
    minRun: lengths.length ? Math.min(...lengths) : 0,
    maxRun: lengths.length ? Math.max(...lengths) : 0,
    runCount: lengths.length,
    equationRatio: playable ? lengths.length / playable : 0,
    shortRunRatio: lengths.length ? shortRuns / lengths.length : 0,
    twoThreeRunRatio: lengths.length ? twoThreeRuns / lengths.length : 0,
    fourRunRatio: lengths.length ? fourRuns / lengths.length : 0,
    fiveRunRatio: lengths.length ? fiveRuns / lengths.length : 0,
    mediumRunRatio: lengths.length ? mediumRuns / lengths.length : 0,
    fiveSixRunRatio: lengths.length ? fiveSixRuns / lengths.length : 0,
    sevenEightRunRatio: lengths.length ? sevenEightRuns / lengths.length : 0,
    longBalanceDelta: lengths.length ? Math.abs(fiveSixRuns - sevenEightRuns) / lengths.length : 0,
    longRunRatio: lengths.length ? longRuns / lengths.length : 0,
    veryLongRunRatio: lengths.length ? veryLongRuns / lengths.length : 0,
    edgePlayableRatio: edgePlayable / Math.max(1, edgeCells),
    cornerPlayableRatio: cornerPlayable / Math.max(1, cornerCells)
  };
}

function isMaskAcceptable(mask) {
  const stats = measureWritableMask(mask);
  const rows = mask.length;
  const cols = mask[0].length;
  const area = rows * cols;
  const minimumRatio = area <= 16 ? 0.55 : area <= 80 ? 0.38 : area <= 420 ? 0.28 : area <= 700 ? 0.32 : 0.34;
  const maximumRatio = area <= 16 ? 1 : 0.72;
  const minimumEdgePlayableRatio = area <= 80 ? 0.12 : area <= 420 ? 0.18 : area <= 700 ? 0.22 : 0.24;
  const minimumCornerPlayableRatio = area <= 80 ? 0.18 : area <= 420 ? 0.22 : 0.24;
  const minimumShortRunRatio = area <= 80 ? 0.68 : area <= 420 ? 0.6 : 0.58;
  const minimumTwoThreeRunRatio = area <= 80 ? 0.5 : area <= 420 ? 0.68 : area <= 700 ? 0.7 : 0.78;
  const maximumMediumRunRatio = area <= 80 ? 0.44 : area <= 420 ? 0.3 : area <= 700 ? 0.28 : 0.22;
  const maximumLongBucketRatio = area <= 80 ? 0.08 : area <= 420 ? 0.055 : 0.06;
  const maximumLongRunRatio = maximumLongBucketRatio * 2;
  const maximumLongBalanceDelta = area <= 80 ? 0.08 : area <= 420 ? 0.025 : 0.04;
  const minimumLongBucketRatio = area <= 80 ? 0 : area <= 420 ? 0.01 : area <= 700 ? 0.01 : 0.006;
  const minimumEquationRatio = area <= 80 ? 0.58 : area <= 420 ? 0.68 : area <= 700 ? 0.74 : 0.76;
  return (
    stats.components === 1 &&
    stats.rowsCovered === rows &&
    stats.colsCovered === cols &&
    stats.minRun >= 2 &&
    stats.maxRun <= 8 &&
    stats.ratio >= minimumRatio &&
    stats.ratio <= maximumRatio &&
    stats.edgePlayableRatio >= minimumEdgePlayableRatio &&
    stats.cornerPlayableRatio >= minimumCornerPlayableRatio &&
    stats.shortRunRatio >= minimumShortRunRatio &&
    stats.twoThreeRunRatio >= minimumTwoThreeRunRatio &&
    stats.equationRatio >= minimumEquationRatio &&
    stats.mediumRunRatio <= maximumMediumRunRatio &&
    stats.fiveSixRunRatio >= minimumLongBucketRatio &&
    stats.sevenEightRunRatio >= minimumLongBucketRatio &&
    stats.fiveSixRunRatio <= maximumLongBucketRatio &&
    stats.sevenEightRunRatio <= maximumLongBucketRatio &&
    stats.longBalanceDelta <= maximumLongBalanceDelta &&
    stats.longRunRatio <= maximumLongRunRatio &&
    stats.veryLongRunRatio <= maximumLongBucketRatio
  );
}

function scoreWritableMask(mask) {
  const stats = measureWritableMask(mask);
  const rows = mask.length;
  const cols = mask[0].length;
  const area = rows * cols;
  const minimumRatio = area <= 16 ? 0.55 : area <= 80 ? 0.38 : area <= 420 ? 0.28 : area <= 700 ? 0.32 : 0.34;
  const maximumRatio = area <= 16 ? 1 : 0.72;
  const targetRatio = area <= 80 ? 0.52 : area <= 420 ? 0.44 : area <= 700 ? 0.44 : 0.46;
  const minimumEdgePlayableRatio = area <= 80 ? 0.12 : area <= 420 ? 0.18 : area <= 700 ? 0.22 : 0.24;
  const minimumCornerPlayableRatio = area <= 80 ? 0.18 : area <= 420 ? 0.22 : 0.24;
  const targetTwoThreeRatio = area <= 80 ? 0.58 : area <= 420 ? 0.72 : area <= 700 ? 0.74 : 0.8;
  const targetLongBucketRatio = area <= 80 ? 0.02 : area <= 420 ? 0.025 : area <= 700 ? 0.025 : 0.018;
  const minLongBucketRatio = area <= 80 ? 0 : area <= 420 ? 0.01 : area <= 700 ? 0.01 : 0.006;
  const maxLongBucketRatio = area <= 80 ? 0.08 : area <= 420 ? 0.055 : 0.06;
  return (
    (stats.components !== 1 ? 10000 : 0) +
    (rows - stats.rowsCovered + cols - stats.colsCovered) * 5000 +
    (stats.minRun < 2 ? 8000 : 0) +
    Math.max(0, stats.maxRun - 8) * 4000 +
    Math.max(0, minimumRatio - stats.ratio) * 60000 +
    Math.max(0, stats.ratio - maximumRatio) * 30000 +
    Math.max(0, minimumEdgePlayableRatio - stats.edgePlayableRatio) * 24000 +
    Math.max(0, minimumCornerPlayableRatio - stats.cornerPlayableRatio) * 16000 +
    Math.max(0, stats.fiveSixRunRatio - maxLongBucketRatio) * 16000 +
    Math.max(0, stats.sevenEightRunRatio - maxLongBucketRatio) * 16000 +
    Math.max(0, minLongBucketRatio - stats.fiveSixRunRatio) * 30000 +
    Math.max(0, minLongBucketRatio - stats.sevenEightRunRatio) * 30000 +
    Math.abs(stats.fiveSixRunRatio - targetLongBucketRatio) * 4000 +
    Math.abs(stats.sevenEightRunRatio - targetLongBucketRatio) * 4000 +
    stats.longBalanceDelta * 26000 +
    Math.max(0, targetTwoThreeRatio - stats.twoThreeRunRatio) * 4200 +
    Math.max(0, (area > 700 ? 0.8 : area > 420 ? 0.78 : area > 80 ? 0.68 : 0.58) - stats.equationRatio) * 5000 +
    stats.fourRunRatio * 1100 +
    (1 - stats.shortRunRatio) * 700 +
    Math.abs(stats.ratio - targetRatio) * 300
  );
}

function carveBlockedPockets(mask) {
  const rows = mask.length;
  const cols = mask[0].length;
  const area = rows * cols;
  const pocketCount = Math.round(area * 0.03);
  for (let index = 0; index < pocketCount; index += 1) {
    const height = Math.random() < 0.55 ? 1 : 2;
    const width = Math.random() < 0.55 ? 1 : 2;
    const y = randInt(1, Math.max(1, rows - height - 1));
    const x = randInt(1, Math.max(1, cols - width - 1));
    drawRect(mask, y, x, height, width, false);
  }
}

function carveEdgeBlockStacks(mask) {
  const rows = mask.length;
  const cols = mask[0].length;
  if (rows < 5 || cols < 5) {
    return;
  }

  const area = rows * cols;
  const horizontalStep = area > 420
    ? clamp(Math.round(cols / 4), 7, 10)
    : clamp(Math.round(cols / 5), 5, 8);
  for (let x = randInt(2, 4); x < cols - 2; x += horizontalStep + randInt(0, 2)) {
    const depth = Math.random() < 0.9 ? 1 : 2;
    const width = Math.random() < 0.92 ? 1 : 2;
    drawRect(mask, 0, x, depth, width, false);
    if (Math.random() < (area > 420 ? 0.4 : 0.55)) {
      drawRect(mask, rows - depth, clamp(x + randInt(-1, 1), 1, cols - width - 1), depth, width, false);
    }
  }

  const verticalStep = area > 420
    ? clamp(Math.round(rows / 4), 7, 10)
    : clamp(Math.round(rows / 4), 5, 8);
  for (let y = randInt(2, 4); y < rows - 2; y += verticalStep + randInt(0, 2)) {
    const depth = Math.random() < 0.9 ? 1 : 2;
    const height = Math.random() < 0.92 ? 1 : 2;
    drawRect(mask, y, 0, height, depth, false);
    if (Math.random() < (area > 420 ? 0.4 : 0.55)) {
      drawRect(mask, clamp(y + randInt(-1, 1), 1, rows - height - 1), cols - depth, height, depth, false);
    }
  }

  const cornerChance = area > 420 ? 0.28 : 0.42;
  const cornerSize = () => (area > 420 || Math.random() < 0.82 ? 1 : 2);
  if (Math.random() < cornerChance) {
    drawRect(mask, 0, 0, cornerSize(), cornerSize(), false);
  }
  if (Math.random() < cornerChance) {
    const width = cornerSize();
    drawRect(mask, 0, cols - width, cornerSize(), width, false);
  }
  if (Math.random() < cornerChance) {
    const height = cornerSize();
    drawRect(mask, rows - height, 0, height, cornerSize(), false);
  }
  if (Math.random() < cornerChance) {
    const height = cornerSize();
    const width = cornerSize();
    drawRect(mask, rows - height, cols - width, height, width, false);
  }
}

function carveRunLimiters(mask) {
  const rows = mask.length;
  const cols = mask[0].length;
  if (rows < 6 || cols < 6) {
    return;
  }

  const area = rows * cols;
  const spacing = area > 420
    ? (Math.random() < 0.7 ? 4 : 5)
    : (area > 200 ? (Math.random() < 0.65 ? 4 : 5) : (Math.random() < 0.65 ? 6 : 7));
  const slope = Math.random() < 0.5 ? 2 : 3;
  const phase = randInt(0, spacing - 1);
  const skipChance = area > 420 ? 0.12 : area > 200 ? 0.16 : 0.38;
  for (let y = 1; y < rows - 1; y += 1) {
    const offset = (phase + y * slope) % spacing;
    for (let x = offset; x < cols; x += spacing) {
      if (x <= 0 || x >= cols - 1) {
        continue;
      }
      if (Math.random() < skipChance) {
        continue;
      }
      mask[y][x] = false;
    }
  }
}

function connectClusters(mask, clusters) {
  if (clusters.length < 2) {
    return;
  }

  const connected = [clusters[0]];
  const remaining = clusters.slice(1);
  while (remaining.length) {
    let bestConnectedIndex = 0;
    let bestRemainingIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    connected.forEach((source, sourceIndex) => {
      remaining.forEach((target, targetIndex) => {
        const distance = Math.abs(source.y - target.y) + Math.abs(source.x - target.x);
        const score = distance + Math.random() * 5;
        if (score < bestScore) {
          bestScore = score;
          bestConnectedIndex = sourceIndex;
          bestRemainingIndex = targetIndex;
        }
      });
    });

    const target = remaining.splice(bestRemainingIndex, 1)[0];
    drawConnector(mask, connected[bestConnectedIndex], target, 3);
    connected.push(target);
  }
}

function seedEdgeAndCornerClusters(mask, clusters) {
  const rows = mask.length;
  const cols = mask[0].length;
  const cornerSize = rows >= 5 && cols >= 5 && Math.random() < 0.65 ? 3 : 2;
  addCluster(mask, clusters, 0, 0, cornerSize);
  addCluster(mask, clusters, 0, cols - cornerSize, cornerSize);
  addCluster(mask, clusters, rows - cornerSize, 0, cornerSize);
  addCluster(mask, clusters, rows - cornerSize, cols - cornerSize, cornerSize);

  const horizontalStep = clamp(Math.round(cols / 5), 4, 7);
  for (let x = randInt(2, 4); x < cols - 3; x += horizontalStep + randInt(-1, 2)) {
    const size = Math.random() < 0.45 ? 3 : 2;
    addCluster(mask, clusters, 0, x, size);
    if (Math.random() < 0.85) {
      addCluster(mask, clusters, rows - size, clamp(x + randInt(-2, 2), 0, cols - size), size);
    }
  }

  const verticalStep = clamp(Math.round(rows / 4), 4, 7);
  for (let y = randInt(2, 4); y < rows - 3; y += verticalStep + randInt(-1, 2)) {
    const size = Math.random() < 0.45 ? 3 : 2;
    addCluster(mask, clusters, y, 0, size);
    if (Math.random() < 0.85) {
      addCluster(mask, clusters, clamp(y + randInt(-2, 2), 0, rows - size), cols - size, size);
    }
  }
}

function seedInteriorStairClusters(mask, clusters) {
  const rows = mask.length;
  const cols = mask[0].length;
  const area = rows * cols;
  if (rows < 7 || cols < 7) {
    return;
  }

  const stairCount = area > 420 ? 3 : area > 160 ? 2 : 1;
  for (let stairIndex = 0; stairIndex < stairCount; stairIndex += 1) {
    const horizontal = cols >= rows
      ? Math.random() < 0.75
      : Math.random() < 0.35;
    const steps = area > 420 ? randInt(5, 8) : area > 160 ? randInt(4, 6) : randInt(3, 4);
    const directionStart = Math.random() < 0.5 ? -1 : 1;
    let direction = directionStart;
    const minY = Math.max(1, Math.floor(rows * 0.18));
    const maxY = Math.max(minY, Math.ceil(rows * 0.78));
    const minX = Math.max(1, Math.floor(cols * 0.16));
    const maxX = Math.max(minX, Math.ceil(cols * 0.78));
    let y = horizontal
      ? clamp(Math.round(rows * (0.35 + (stairIndex / Math.max(1, stairCount - 1)) * 0.3)) + randInt(-1, 1), minY, maxY)
      : randInt(minY, Math.max(minY, maxY - steps * 2));
    let x = horizontal
      ? randInt(minX, Math.max(minX, maxX - steps * 2))
      : clamp(Math.round(cols * (0.35 + (stairIndex / Math.max(1, stairCount - 1)) * 0.3)) + randInt(-1, 1), minX, maxX);

    for (let step = 0; step < steps; step += 1) {
      const longStep = (step + stairIndex) % 3 !== 1;
      const primary = longStep ? 3 : 2;
      const secondary = Math.random() < 0.8 ? 2 : 3;
      const height = horizontal ? secondary : primary;
      const width = horizontal ? primary : secondary;
      addRectCluster(mask, clusters, y, x, height, width);

      if (horizontal) {
        x += Math.max(1, width - 1);
        y += direction;
        if (y <= minY || y >= maxY - height) {
          direction *= -1;
          y = clamp(y, minY, maxY - height);
        }
      } else {
        y += Math.max(1, height - 1);
        x += direction;
        if (x <= minX || x >= maxX - width) {
          direction *= -1;
          x = clamp(x, minX, maxX - width);
        }
      }
    }
  }
}

function carveInteriorStairBlockers(mask) {
  const rows = mask.length;
  const cols = mask[0].length;
  const area = rows * cols;
  if (rows < 7 || cols < 7) {
    return;
  }

  const stairCount = area > 420 ? 3 : area > 160 ? 2 : 1;
  for (let stairIndex = 0; stairIndex < stairCount; stairIndex += 1) {
    const horizontal = cols >= rows
      ? Math.random() < 0.75
      : Math.random() < 0.35;
    const steps = area > 420 ? randInt(6, 9) : area > 160 ? randInt(4, 7) : randInt(3, 5);
    const minY = Math.max(1, Math.floor(rows * 0.2));
    const maxY = Math.max(minY, Math.ceil(rows * 0.76));
    const minX = Math.max(1, Math.floor(cols * 0.18));
    const maxX = Math.max(minX, Math.ceil(cols * 0.76));
    let direction = Math.random() < 0.5 ? -1 : 1;
    let y = horizontal
      ? clamp(Math.round(rows * (0.35 + (stairIndex / Math.max(1, stairCount - 1)) * 0.3)), minY, maxY)
      : randInt(minY, Math.max(minY, maxY - steps * 2));
    let x = horizontal
      ? randInt(minX, Math.max(minX, maxX - steps * 2))
      : clamp(Math.round(cols * (0.35 + (stairIndex / Math.max(1, stairCount - 1)) * 0.3)), minX, maxX);

    for (let step = 0; step < steps; step += 1) {
      const length = (step + stairIndex) % 3 === 1 ? 2 : 3;
      const height = horizontal ? 1 : length;
      const width = horizontal ? length : 1;
      drawRect(mask, y, x, height, width, false);

      if (horizontal) {
        x += length;
        y += direction;
        if (y <= minY || y >= maxY) {
          direction *= -1;
          y = clamp(y, minY, maxY);
        }
      } else {
        y += length;
        x += direction;
        if (x <= minX || x >= maxX) {
          direction *= -1;
          x = clamp(x, minX, maxX);
        }
      }
    }
  }
}

function seedInteriorClusters(mask, clusters) {
  const rows = mask.length;
  const cols = mask[0].length;
  const rowStep = clamp(Math.round(rows / 4), 4, 6);
  const colStep = clamp(Math.round(cols / 6), 4, 6);
  for (let y = randInt(2, 4); y < rows - 2; y += rowStep) {
    for (let x = randInt(2, 4); x < cols - 2; x += colStep) {
      if (Math.random() > 0.45) {
        continue;
      }
      const size = Math.random() < 0.7 ? 2 : 3;
      addCluster(mask, clusters, y + randInt(-1, 1), x + randInt(-1, 1), size);
    }
  }
}

function buildSmallWritableMask(playRows, playCols) {
  if (playRows === 3 && playCols === 3) {
    if (Math.random() < 0.35) {
      return createMatrix(3, 3, true);
    }

    let mask = Math.random() < 0.5
      ? [
        [false, true, true],
        [true, true, true],
        [true, true, false]
      ]
      : [
        [true, true, false],
        [true, true, true],
        [false, true, true]
      ];
    if (Math.random() < 0.5) {
      mask = mask.slice().reverse();
    }
    if (Math.random() < 0.5) {
      mask = mask.map((row) => row.slice().reverse());
    }
    return mask;
  }

  if (playRows <= 3 || playCols <= 3) {
    return createMatrix(playRows, playCols, true);
  }

  if (playRows !== 4 || playCols !== 4) {
    return null;
  }

  let mask = Math.random() < 0.5
    ? [
      [false, false, true, true],
      [false, true, true, true],
      [true, true, false, false],
      [true, true, false, false]
    ]
    : [
      [false, false, true, true],
      [false, false, true, true],
      [true, true, true, false],
      [true, true, false, false]
    ];

  if (Math.random() < 0.5) {
    mask = mask.slice().reverse();
  }
  if (Math.random() < 0.5) {
    mask = mask.map((row) => row.slice().reverse());
  }
  if (Math.random() < 0.5) {
    mask = mask[0].map((_, x) => mask.map((row) => row[x]));
  }
  return mask;
}

function finalizeWritableMask(mask) {
  for (let pass = 0; pass < 8; pass += 1) {
    splitOversizedRuns(mask, 8);
    cutLongRuns(mask, 8);
    removeInvalidWritableCells(mask);
    connectMaskComponents(mask);
  }
  splitOversizedRuns(mask, 8);
  cutLongRuns(mask, 8);
  removeInvalidWritableCells(mask);
  connectMaskComponents(mask);
  removeInvalidWritableCells(mask);
  connectMaskComponents(mask);
  enforceHardRunLimit(mask);
}

function enforceHardRunLimit(mask) {
  for (let pass = 0; pass < 6; pass += 1) {
    const stats = measureWritableMask(mask);
    if (stats.minRun >= 2 && stats.maxRun <= 8 && stats.components === 1) {
      return;
    }
    cutLongRuns(mask, 8);
    removeInvalidWritableCells(mask);
    connectMaskComponents(mask);
  }
}

function buildWritableMask(playRows, playCols, attemptLimitOverride = null) {
  const smallMask = buildSmallWritableMask(playRows, playCols);
  if (smallMask) {
    return smallMask;
  }

  const area = playRows * playCols;
  let bestMask = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const attemptLimit = attemptLimitOverride || (area > 700 ? 5 : area > 420 ? 5 : area > 200 ? 5 : 10);

  for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
    const mask = createMatrix(playRows, playCols, false);
    const clusters = [];
    seedEdgeAndCornerClusters(mask, clusters);
    seedInteriorStairClusters(mask, clusters);
    seedInteriorClusters(mask, clusters);
    connectClusters(mask, shuffleList(clusters));
    if (area > 100) {
      carveInteriorStairBlockers(mask);
    }
    carveEdgeBlockStacks(mask);
    if (area > 100) {
      carveRunLimiters(mask);
      if (area > 200) {
        carveRunLimiters(mask);
      }
    }
    carveBlockedPockets(mask);
    finalizeWritableMask(mask);
    increaseClueDensity(mask);
    reduceLongRunPressure(mask);
    enforceHardRunLimit(mask);

    if (isMaskAcceptable(mask)) {
      return mask;
    }

    const score = scoreWritableMask(mask);
    if (score < bestScore) {
      bestScore = score;
      bestMask = cloneBoolMask(mask);
    }
  }

  if (bestMask) {
    return bestMask;
  }

  return buildCarvedWritableMask(playRows, playCols);
}

function buildCarvedWritableMask(playRows, playCols) {
  const area = playRows * playCols;
  const mask = createMatrix(playRows, playCols, true);
  carveInteriorStairBlockers(mask);
  carveEdgeBlockStacks(mask);
  if (area > 100) {
    carveRunLimiters(mask);
    if (area > 420) {
      carveRunLimiters(mask);
    }
  }
  carveBlockedPockets(mask);
  finalizeWritableMask(mask);
  return mask;
}

function buildLatinSolutionDigits(playRows, playCols) {
  const steps = [1, 2, 4, 5, 7, 8];
  const rowStep = steps[randInt(0, steps.length - 1)];
  const colStep = steps[randInt(0, steps.length - 1)];
  const offset = randInt(0, 8);
  const digitMap = shuffleList([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const digits = createMatrix(playRows, playCols, 0);

  for (let y = 0; y < playRows; y += 1) {
    for (let x = 0; x < playCols; x += 1) {
      digits[y][x] = digitMap[(offset + y * rowStep + x * colStep) % 9];
    }
  }

  return digits;
}

function buildSolutionDigitsFromMask(mask) {
  const rows = mask.length;
  const cols = mask[0].length;
  const runs = getMaskRuns(mask);
  const maskRuns = runs.rowRuns.concat(runs.colRuns);
  const cells = [];
  const keyToCellIndex = new Map();

  maskRuns.forEach((run, runIndex) => {
    run.forEach((cell) => {
      const key = `${cell.y},${cell.x}`;
      if (!keyToCellIndex.has(key)) {
        keyToCellIndex.set(key, cells.length);
        cells.push({ y: cell.y, x: cell.x, runs: [] });
      }
      cells[keyToCellIndex.get(key)].runs.push(runIndex);
    });
  });

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (mask[y][x] && !keyToCellIndex.has(`${y},${x}`)) {
        return null;
      }
    }
  }

  if (cells.some((cell) => cell.runs.length !== 2)) {
    return null;
  }

  const values = Array(cells.length).fill(0);
  const runUsedMasks = Array(maskRuns.length).fill(0);
  const runAssignedSums = Array(maskRuns.length).fill(0);
  let nodes = 0;
  const nodeLimit = Math.max(2000, rows * cols * 80);

  const placeDigit = (cellIndex, digit) => {
    const bit = digitBit(digit);
    const cell = cells[cellIndex];
    if (cell.runs.some((runIndex) => runUsedMasks[runIndex] & bit)) {
      return false;
    }
    values[cellIndex] = digit;
    cell.runs.forEach((runIndex) => {
      runUsedMasks[runIndex] |= bit;
      runAssignedSums[runIndex] += digit;
    });
    const isPreferred = cell.runs.every((runIndex) => {
      const run = maskRuns[runIndex];
      if (countBits(runUsedMasks[runIndex]) < run.length) {
        return true;
      }
      return getCombinationMasks(run.length, runAssignedSums[runIndex]).length <= getPreferredCombinationLimit(run.length);
    });
    if (!isPreferred) {
      cell.runs.forEach((runIndex) => {
        runUsedMasks[runIndex] &= ~bit;
        runAssignedSums[runIndex] -= digit;
      });
      values[cellIndex] = 0;
      return false;
    }
    return true;
  };

  const removeDigit = (cellIndex, digit) => {
    const bit = digitBit(digit);
    values[cellIndex] = 0;
    cells[cellIndex].runs.forEach((runIndex) => {
      runUsedMasks[runIndex] &= ~bit;
      runAssignedSums[runIndex] -= digit;
    });
  };

  const scoreDigit = (cellIndex, digit) => {
    const cell = cells[cellIndex];
    let score = Math.random();
    cell.runs.forEach((runIndex) => {
      const run = maskRuns[runIndex];
      const nextCount = countBits(runUsedMasks[runIndex]) + 1;
      if (nextCount === run.length) {
        const nextSum = runAssignedSums[runIndex] + digit;
        score += getCombinationMasks(run.length, nextSum).length * 30;
      }
    });
    return score;
  };

  const search = (filled) => {
    nodes += 1;
    if (nodes > nodeLimit) {
      return false;
    }
    if (filled === cells.length) {
      return true;
    }

    let bestIndex = -1;
    let bestDomain = 0;
    let bestCount = 10;
    for (let index = 0; index < cells.length; index += 1) {
      if (values[index] !== 0) {
        continue;
      }
      const cell = cells[index];
      let domain = ALL_DIGIT_MASK;
      cell.runs.forEach((runIndex) => {
        domain &= ~runUsedMasks[runIndex];
      });
      const domainCount = countBits(domain);
      if (domainCount === 0) {
        return false;
      }
      if (domainCount < bestCount) {
        bestIndex = index;
        bestDomain = domain;
        bestCount = domainCount;
        if (domainCount === 1) {
          break;
        }
      }
    }

    const digits = digitsFromMask(bestDomain)
      .sort((left, right) => scoreDigit(bestIndex, left) - scoreDigit(bestIndex, right));
    for (const digit of digits) {
      if (!placeDigit(bestIndex, digit)) {
        continue;
      }
      if (search(filled + 1)) {
        return true;
      }
      removeDigit(bestIndex, digit);
    }
    return false;
  };

  if (!search(0)) {
    return null;
  }

  const digits = createMatrix(rows, cols, 0);
  cells.forEach((cell, index) => {
    digits[cell.y][cell.x] = values[index];
  });
  return digits;
}

function getRunAmbiguityScore(run, digits) {
  const sum = getRunDigitSum(run, digits);
  const combinationCount = getCombinationMasks(run.length, sum).length;
  const preferredLimit = getPreferredCombinationLimit(run.length);
  const targetCount = run.length <= 3 ? 1 : run.length <= 4 ? 2 : 3;
  return combinationCount * combinationCount * 8 +
    Math.max(0, combinationCount - targetCount) * 70 +
    Math.max(0, combinationCount - preferredLimit) * 30;
}

function improveSolutionDigitsForMask(mask, digits, maxPasses = 3) {
  const runs = getMaskRuns(mask).rowRuns.concat(getMaskRuns(mask).colRuns);
  const cellRunIndexes = new Map();
  const cells = [];
  runs.forEach((run, runIndex) => {
    run.forEach((cell) => {
      const key = `${cell.y},${cell.x}`;
      if (!cellRunIndexes.has(key)) {
        cellRunIndexes.set(key, []);
        cells.push({ y: cell.y, x: cell.x });
      }
      cellRunIndexes.get(key).push(runIndex);
    });
  });

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;
    for (const cell of shuffleList(cells)) {
      const runIndexes = cellRunIndexes.get(`${cell.y},${cell.x}`) || [];
      if (runIndexes.length !== 2) {
        continue;
      }
      const currentDigit = digits[cell.y][cell.x];
      let allowed = ALL_DIGIT_MASK & ~digitBit(currentDigit);
      runIndexes.forEach((runIndex) => {
        let used = 0;
        runs[runIndex].forEach((runCell) => {
          if (runCell.y !== cell.y || runCell.x !== cell.x) {
            used |= digitBit(digits[runCell.y][runCell.x]);
          }
        });
        allowed &= ~used;
      });

      const currentScore = runIndexes.reduce((total, runIndex) => (
        total + getRunAmbiguityScore(runs[runIndex], digits)
      ), 0);
      let bestDigit = currentDigit;
      let bestScore = currentScore;

      for (const digit of shuffleList(digitsFromMask(allowed))) {
        digits[cell.y][cell.x] = digit;
        const nextScore = runIndexes.reduce((total, runIndex) => (
          total + getRunAmbiguityScore(runs[runIndex], digits)
        ), 0);
        if (nextScore < bestScore || (nextScore === bestScore && Math.random() < 0.08)) {
          bestScore = nextScore;
          bestDigit = digit;
        }
      }

      digits[cell.y][cell.x] = bestDigit;
      if (bestDigit !== currentDigit) {
        changed = true;
      }
    }
    if (!changed) {
      return;
    }
  }
}

function buildSolutionDigits(playRows, playCols, mask = null) {
  if (mask) {
    const area = playRows * playCols;
    if (area <= 420) {
      const digits = buildSolutionDigitsFromMask(mask);
      if (digits) {
        return digits;
      }
    }
    const latinDigits = buildLatinSolutionDigits(playRows, playCols);
    improveSolutionDigitsForMask(mask, latinDigits, area > 700 ? 5 : area > 420 ? 6 : area > 200 ? 6 : 2);
    return latinDigits;
  }
  return buildLatinSolutionDigits(playRows, playCols);
}

function buildPuzzleFromDigits(sizeKey, mask, digits) {
  const { rows, cols } = parseSize(sizeKey);
  const board = createMatrix(rows, cols, -1);
  const boardSol = createMatrix(rows, cols, -1);

  for (let y = 1; y < rows; y += 1) {
    for (let x = 1; x < cols; x += 1) {
      if (mask[y - 1][x - 1]) {
        board[y][x] = 0;
        boardSol[y][x] = digits[y - 1][x - 1];
      }
    }
  }

  const runs = getMaskRuns(mask);
  const clueParts = new Map();
  const ensureClue = (y, x) => {
    const key = `${y},${x}`;
    if (!clueParts.has(key)) {
      clueParts.set(key, { y, x, h: 0, v: 0 });
    }
    return clueParts.get(key);
  };

  runs.rowRuns.forEach((run) => {
    const total = run.reduce((sum, cell) => sum + digits[cell.y][cell.x], 0);
    ensureClue(run[0].y + 1, run[0].x).h = total;
  });

  runs.colRuns.forEach((run) => {
    const total = run.reduce((sum, cell) => sum + digits[cell.y][cell.x], 0);
    ensureClue(run[0].y, run[0].x + 1).v = total;
  });

  clueParts.forEach((part) => {
    const clue = encodeClue(part.h, part.v);
    board[part.y][part.x] = clue;
    boardSol[part.y][part.x] = clue;
  });

  return { board, boardSol, sizeKey };
}

const FOUR_BY_FOUR_FULL_DIGIT_SEEDS = Object.freeze([
  Object.freeze([
    Object.freeze([9, 2, 8]),
    Object.freeze([4, 1, 6]),
    Object.freeze([7, 4, 9])
  ]),
  Object.freeze([
    Object.freeze([9, 5, 4]),
    Object.freeze([4, 1, 2]),
    Object.freeze([7, 3, 1])
  ]),
  Object.freeze([
    Object.freeze([5, 1, 6]),
    Object.freeze([7, 3, 9]),
    Object.freeze([9, 6, 8])
  ]),
  Object.freeze([
    Object.freeze([6, 2, 9]),
    Object.freeze([8, 1, 5]),
    Object.freeze([9, 4, 7])
  ]),
  Object.freeze([
    Object.freeze([2, 8, 1]),
    Object.freeze([6, 9, 4]),
    Object.freeze([1, 6, 3])
  ]),
  Object.freeze([
    Object.freeze([6, 9, 8]),
    Object.freeze([3, 7, 5]),
    Object.freeze([1, 4, 2])
  ]),
  Object.freeze([
    Object.freeze([9, 7, 4]),
    Object.freeze([8, 9, 1]),
    Object.freeze([6, 8, 2])
  ]),
  Object.freeze([
    Object.freeze([4, 9, 7]),
    Object.freeze([1, 6, 8]),
    Object.freeze([2, 8, 9])
  ]),
  Object.freeze([
    Object.freeze([9, 6, 8]),
    Object.freeze([6, 3, 1]),
    Object.freeze([2, 1, 4])
  ])
]);

function buildFourByFourFullDigits() {
  let digits = FOUR_BY_FOUR_FULL_DIGIT_SEEDS[randInt(0, FOUR_BY_FOUR_FULL_DIGIT_SEEDS.length - 1)]
    .map((row) => row.slice());
  if (Math.random() < 0.5) {
    digits = digits[0].map((_, x) => digits.map((row) => row[x]));
  }
  digits = shuffleList(digits).map((row) => row.slice());
  const columnOrder = shuffleList([0, 1, 2]);
  return digits.map((row) => columnOrder.map((x) => row[x]));
}

function buildFourByFourFullPuzzle(sizeKey) {
  return buildPuzzleFromDigits(sizeKey, createMatrix(3, 3, true), buildFourByFourFullDigits());
}

function buildSolverContext(board) {
  const boardRuns = buildRunsFromBoard(board);
  const runs = boardRuns.map((run) => ({
    sum: run.sum,
    length: run.cells.length,
    cells: [],
    combinations: getCombinationMasks(run.cells.length, run.sum),
    allowedByUsedMask: null,
    viableByUsedMask: null
  }));
  if (runs.some((run) => run.length < 2 || run.length > 9 || run.combinations.length === 0)) {
    return null;
  }

  runs.forEach((run) => {
    const allowedByUsedMask = new Uint16Array(1 << 10);
    const viableByUsedMask = new Uint8Array(1 << 10);
    for (let usedMask = 0; usedMask < allowedByUsedMask.length; usedMask += 1) {
      let allowed = 0;
      for (const combination of run.combinations) {
        if ((combination & usedMask) === usedMask) {
          allowed |= combination & ~usedMask;
          viableByUsedMask[usedMask] = 1;
        }
      }
      allowedByUsedMask[usedMask] = allowed;
    }
    run.allowedByUsedMask = allowedByUsedMask;
    run.viableByUsedMask = viableByUsedMask;
  });

  const cells = [];
  const keyToCellIndex = new Map();
  boardRuns.forEach((run, runIndex) => {
    run.cells.forEach((cell) => {
      const key = `${cell.y},${cell.x}`;
      if (!keyToCellIndex.has(key)) {
        keyToCellIndex.set(key, cells.length);
        cells.push({ y: cell.y, x: cell.x, runs: [] });
      }
      const cellIndex = keyToCellIndex.get(key);
      cells[cellIndex].runs.push(runIndex);
      runs[runIndex].cells.push(cellIndex);
    });
  });

  for (let y = 0; y < board.length; y += 1) {
    for (let x = 0; x < board[0].length; x += 1) {
      if (isPlayCell(board[y][x]) && !keyToCellIndex.has(`${y},${x}`)) {
        return null;
      }
    }
  }

  if (cells.some((cell) => cell.runs.length !== 2)) {
    return null;
  }

  return { cells, runs };
}

function isRunStateViable(run, usedMask, assignedCount) {
  if (countBits(usedMask) !== assignedCount) {
    return false;
  }
  if (run.viableByUsedMask) {
    return run.viableByUsedMask[usedMask] === 1;
  }
  return run.combinations.some((combination) => (combination & usedMask) === usedMask);
}

function getRunAllowedDigitMask(run, usedMask, assignedCount) {
  if (countBits(usedMask) !== assignedCount) {
    return 0;
  }
  if (run.allowedByUsedMask) {
    return run.allowedByUsedMask[usedMask];
  }

  let allowed = 0;
  run.combinations.forEach((combination) => {
    if ((combination & usedMask) === usedMask) {
      allowed |= combination & ~usedMask;
    }
  });
  return allowed;
}

function getSolverCellDomain(context, cellIndex, assignments, runUsedMasks, runAssignedCounts) {
  if (assignments[cellIndex] !== 0) {
    return 0;
  }

  let domain = ALL_DIGIT_MASK;
  context.cells[cellIndex].runs.forEach((runIndex) => {
    domain &= getRunAllowedDigitMask(
      context.runs[runIndex],
      runUsedMasks[runIndex],
      runAssignedCounts[runIndex]
    );
  });
  return domain;
}

function placeSolverDigit(context, assignments, runUsedMasks, runAssignedCounts, cellIndex, digit) {
  const bit = digitBit(digit);
  const cell = context.cells[cellIndex];
  if (assignments[cellIndex] !== 0 || cell.runs.some((runIndex) => runUsedMasks[runIndex] & bit)) {
    return false;
  }

  assignments[cellIndex] = digit;
  cell.runs.forEach((runIndex) => {
    runUsedMasks[runIndex] |= bit;
    runAssignedCounts[runIndex] += 1;
  });

  const viable = cell.runs.every((runIndex) => (
    isRunStateViable(context.runs[runIndex], runUsedMasks[runIndex], runAssignedCounts[runIndex])
  ));
  if (!viable) {
    cell.runs.forEach((runIndex) => {
      runUsedMasks[runIndex] &= ~bit;
      runAssignedCounts[runIndex] -= 1;
    });
    assignments[cellIndex] = 0;
    return false;
  }

  return true;
}

function removeSolverDigit(context, assignments, runUsedMasks, runAssignedCounts, cellIndex, digit) {
  const bit = digitBit(digit);
  assignments[cellIndex] = 0;
  context.cells[cellIndex].runs.forEach((runIndex) => {
    runUsedMasks[runIndex] &= ~bit;
    runAssignedCounts[runIndex] -= 1;
  });
}

function getSolverNodeLimit(cellCount) {
  if (cellCount > 700) {
    return 180000;
  }
  if (cellCount > 420) {
    return 140000;
  }
  if (cellCount > 200) {
    return 90000;
  }
  return 50000;
}

function buildSolutionBoardFromAssignments(board, context, assignments) {
  const solution = cloneMatrix(board);
  context.cells.forEach((cell, index) => {
    solution[cell.y][cell.x] = assignments[index];
  });
  return solution;
}

function countKakuroSolutions(board, limit = 2, options = {}) {
  const context = buildSolverContext(board);
  if (!context) {
    return { solutions: 0, exhausted: true, nodes: 0 };
  }

  const assignments = Array(context.cells.length).fill(0);
  const runUsedMasks = Array(context.runs.length).fill(0);
  const runAssignedCounts = Array(context.runs.length).fill(0);
  let assignedTotal = 0;
  let solutions = 0;
  let nodes = 0;
  let exhausted = true;
  const nodeLimit = options.nodeLimit || getSolverNodeLimit(context.cells.length);
  const capturedSolutions = [];

  for (let cellIndex = 0; cellIndex < context.cells.length; cellIndex += 1) {
    const cell = context.cells[cellIndex];
    const value = board[cell.y][cell.x];
    if (value === 0) {
      continue;
    }
    if (value < 1 || value > 9 || !placeSolverDigit(context, assignments, runUsedMasks, runAssignedCounts, cellIndex, value)) {
      return { solutions: 0, exhausted: true, nodes };
    }
    assignedTotal += 1;
  }

  const search = (filled) => {
    if (solutions >= limit || !exhausted) {
      return;
    }
    nodes += 1;
    if (nodes > nodeLimit) {
      exhausted = false;
      return;
    }

    const forced = [];
    let currentFilled = filled;
    let changed = true;
    while (changed) {
      changed = false;
      for (let cellIndex = 0; cellIndex < context.cells.length; cellIndex += 1) {
        if (assignments[cellIndex] !== 0) {
          continue;
        }
        const domain = getSolverCellDomain(context, cellIndex, assignments, runUsedMasks, runAssignedCounts);
        const domainCount = countBits(domain);
        if (domainCount === 0) {
          for (let index = forced.length - 1; index >= 0; index -= 1) {
            removeSolverDigit(
              context,
              assignments,
              runUsedMasks,
              runAssignedCounts,
              forced[index].cellIndex,
              forced[index].digit
            );
          }
          return;
        }
        if (domainCount === 1) {
          const digit = singleDigitFromMask(domain);
          if (!placeSolverDigit(context, assignments, runUsedMasks, runAssignedCounts, cellIndex, digit)) {
            for (let index = forced.length - 1; index >= 0; index -= 1) {
              removeSolverDigit(
                context,
                assignments,
                runUsedMasks,
                runAssignedCounts,
                forced[index].cellIndex,
                forced[index].digit
              );
            }
            return;
          }
          forced.push({ cellIndex, digit });
          currentFilled += 1;
          changed = true;
        }
      }
    }

    if (currentFilled === context.cells.length) {
      solutions += 1;
      if (options.captureSolutions && capturedSolutions.length < limit) {
        capturedSolutions.push(buildSolutionBoardFromAssignments(board, context, assignments));
      }
      for (let index = forced.length - 1; index >= 0; index -= 1) {
        removeSolverDigit(
          context,
          assignments,
          runUsedMasks,
          runAssignedCounts,
          forced[index].cellIndex,
          forced[index].digit
        );
      }
      return;
    }

    let bestIndex = -1;
    let bestDomain = 0;
    let bestCount = 10;
    let hasDeadCell = false;
    for (let cellIndex = 0; cellIndex < context.cells.length; cellIndex += 1) {
      if (assignments[cellIndex] !== 0) {
        continue;
      }
      const domain = getSolverCellDomain(context, cellIndex, assignments, runUsedMasks, runAssignedCounts);
      const domainCount = countBits(domain);
      if (domainCount === 0) {
        hasDeadCell = true;
        break;
      }
      if (domainCount < bestCount) {
        bestIndex = cellIndex;
        bestDomain = domain;
        bestCount = domainCount;
        if (domainCount === 1) {
          break;
        }
      }
    }

    if (hasDeadCell) {
      for (let index = forced.length - 1; index >= 0; index -= 1) {
        removeSolverDigit(
          context,
          assignments,
          runUsedMasks,
          runAssignedCounts,
          forced[index].cellIndex,
          forced[index].digit
        );
      }
      return;
    }

    if (bestIndex >= 0) {
      const digits = digitsFromMask(bestDomain);
      for (const digit of digits) {
        if (!placeSolverDigit(context, assignments, runUsedMasks, runAssignedCounts, bestIndex, digit)) {
          continue;
        }
        search(currentFilled + 1);
        removeSolverDigit(context, assignments, runUsedMasks, runAssignedCounts, bestIndex, digit);
        if (solutions >= limit || !exhausted) {
          break;
        }
      }
    }

    for (let index = forced.length - 1; index >= 0; index -= 1) {
      removeSolverDigit(
        context,
        assignments,
        runUsedMasks,
        runAssignedCounts,
        forced[index].cellIndex,
        forced[index].digit
      );
    }
  };

  search(assignedTotal);
  return { solutions, exhausted, nodes, capturedSolutions };
}

function findAlternateKakuroSolution(board, solutionBoard, options = {}) {
  const context = buildSolverContext(board);
  if (!context) {
    return { hasAlternate: false, exhausted: true, nodes: 0, alternateSolution: null };
  }

  const assignments = Array(context.cells.length).fill(0);
  const runUsedMasks = Array(context.runs.length).fill(0);
  const runAssignedCounts = Array(context.runs.length).fill(0);
  const targetValues = context.cells.map((cell) => solutionBoard[cell.y][cell.x]);
  let assignedTotal = 0;
  let nodes = 0;
  let exhausted = true;
  let alternateSolution = null;
  const nodeLimit = options.nodeLimit || getSolverNodeLimit(context.cells.length);

  for (let cellIndex = 0; cellIndex < context.cells.length; cellIndex += 1) {
    const cell = context.cells[cellIndex];
    const value = board[cell.y][cell.x];
    if (value === 0) {
      continue;
    }
    if (value < 1 || value > 9 || !placeSolverDigit(context, assignments, runUsedMasks, runAssignedCounts, cellIndex, value)) {
      return { hasAlternate: false, exhausted: true, nodes };
    }
    assignedTotal += 1;
  }

  const hasDifferenceFromTarget = () => context.cells.some((_, index) => assignments[index] !== targetValues[index]);

  const undoForced = (forced) => {
    for (let index = forced.length - 1; index >= 0; index -= 1) {
      removeSolverDigit(
        context,
        assignments,
        runUsedMasks,
        runAssignedCounts,
        forced[index].cellIndex,
        forced[index].digit
      );
    }
  };

  const search = (filled) => {
    if (alternateSolution || !exhausted) {
      return;
    }
    nodes += 1;
    if (nodes > nodeLimit) {
      exhausted = false;
      return;
    }

    const forced = [];
    let currentFilled = filled;
    let changed = true;
    while (changed) {
      changed = false;
      for (let cellIndex = 0; cellIndex < context.cells.length; cellIndex += 1) {
        if (assignments[cellIndex] !== 0) {
          continue;
        }
        const domain = getSolverCellDomain(context, cellIndex, assignments, runUsedMasks, runAssignedCounts);
        const domainCount = countBits(domain);
        if (domainCount === 0) {
          undoForced(forced);
          return;
        }
        if (domainCount === 1) {
          const digit = singleDigitFromMask(domain);
          if (!placeSolverDigit(context, assignments, runUsedMasks, runAssignedCounts, cellIndex, digit)) {
            undoForced(forced);
            return;
          }
          forced.push({ cellIndex, digit });
          currentFilled += 1;
          changed = true;
        }
      }
    }

    if (currentFilled === context.cells.length) {
      if (hasDifferenceFromTarget()) {
        alternateSolution = buildSolutionBoardFromAssignments(board, context, assignments);
      }
      undoForced(forced);
      return;
    }

    let bestIndex = -1;
    let bestDomain = 0;
    let bestCount = 10;
    let bestHasAlternative = false;
    for (let cellIndex = 0; cellIndex < context.cells.length; cellIndex += 1) {
      if (assignments[cellIndex] !== 0) {
        continue;
      }
      const domain = getSolverCellDomain(context, cellIndex, assignments, runUsedMasks, runAssignedCounts);
      const domainCount = countBits(domain);
      if (domainCount === 0) {
        undoForced(forced);
        return;
      }
      const hasAlternative = (domain & ~digitBit(targetValues[cellIndex])) !== 0;
      if (
        domainCount < bestCount ||
        (domainCount === bestCount && hasAlternative && !bestHasAlternative)
      ) {
        bestIndex = cellIndex;
        bestDomain = domain;
        bestCount = domainCount;
        bestHasAlternative = hasAlternative;
      }
    }

    if (bestIndex >= 0) {
      const targetDigit = targetValues[bestIndex];
      const digits = digitsFromMask(bestDomain).sort((left, right) => {
        if (left === targetDigit && right !== targetDigit) {
          return 1;
        }
        if (right === targetDigit && left !== targetDigit) {
          return -1;
        }
        return Math.random() - 0.5;
      });
      for (const digit of digits) {
        if (!placeSolverDigit(context, assignments, runUsedMasks, runAssignedCounts, bestIndex, digit)) {
          continue;
        }
        search(currentFilled + 1);
        removeSolverDigit(context, assignments, runUsedMasks, runAssignedCounts, bestIndex, digit);
        if (alternateSolution || !exhausted) {
          break;
        }
      }
    }

    undoForced(forced);
  };

  search(assignedTotal);
  return {
    hasAlternate: Boolean(alternateSolution),
    exhausted,
    nodes,
    alternateSolution
  };
}

function isPuzzleUniquelySolvable(puzzle) {
  const cellCount = buildSolverContext(puzzle.board)?.cells.length || 0;
  const nodeLimit = cellCount > 420 ? 800 : cellCount > 200 ? 1400 : cellCount > 80 ? 2200 : 50000;
  const result = countKakuroSolutions(puzzle.board, 2, { nodeLimit });
  return result.exhausted && result.solutions === 1;
}

function getDifferingSolutionCells(puzzle, capturedSolutions, mask) {
  const cells = [];
  for (let y = 0; y < mask.length; y += 1) {
    for (let x = 0; x < mask[0].length; x += 1) {
      if (!mask[y][x]) {
        continue;
      }
      const boardY = y + 1;
      const boardX = x + 1;
      if (capturedSolutions.some((solution) => solution[boardY][boardX] !== puzzle.boardSol[boardY][boardX])) {
        cells.push({ y, x });
      }
    }
  }
  return cells;
}

function getRunDigitSum(run, digits) {
  return run.reduce((sum, cell) => sum + digits[cell.y][cell.x], 0);
}

function mutateSolutionDigits(mask, digits, preferredCells = []) {
  const runs = getMaskRuns(mask).rowRuns.concat(getMaskRuns(mask).colRuns);
  const cellRunIndexes = new Map();
  runs.forEach((run, runIndex) => {
    run.forEach((cell) => {
      const key = `${cell.y},${cell.x}`;
      if (!cellRunIndexes.has(key)) {
        cellRunIndexes.set(key, []);
      }
      cellRunIndexes.get(key).push(runIndex);
    });
  });

  const allCells = [];
  for (let y = 0; y < mask.length; y += 1) {
    for (let x = 0; x < mask[0].length; x += 1) {
      if (mask[y][x]) {
        allCells.push({ y, x });
      }
    }
  }

  const candidates = shuffleList(preferredCells.length ? preferredCells : allCells);
  for (const cell of candidates) {
    const runIndexes = cellRunIndexes.get(`${cell.y},${cell.x}`) || [];
    if (runIndexes.length !== 2) {
      continue;
    }

    const currentDigit = digits[cell.y][cell.x];
    let allowed = ALL_DIGIT_MASK & ~digitBit(currentDigit);
    runIndexes.forEach((runIndex) => {
      let used = 0;
      runs[runIndex].forEach((runCell) => {
        if (runCell.y !== cell.y || runCell.x !== cell.x) {
          used |= digitBit(digits[runCell.y][runCell.x]);
        }
      });
      allowed &= ~used;
    });

    const digitCandidates = digitsFromMask(allowed).sort((left, right) => {
      const score = (digit) => runIndexes.reduce((total, runIndex) => {
        const run = runs[runIndex];
        const nextSum = getRunDigitSum(run, digits) - currentDigit + digit;
        return total + getCombinationMasks(run.length, nextSum).length;
      }, Math.random());
      return score(left) - score(right);
    });

    for (const digit of digitCandidates.slice(0, 3)) {
      digits[cell.y][cell.x] = digit;
      return true;
    }
  }

  return false;
}

function removeAmbiguousWritableCell(mask, preferredCells = []) {
  const rows = mask.length;
  const cols = mask[0].length;
  const area = rows * cols;
  const minimumRatio = area <= 16 ? 0.55 : area <= 80 ? 0.38 : area <= 420 ? 0.28 : area <= 700 ? 0.32 : 0.34;
  const minimumEdgePlayableRatio = area <= 80 ? 0.12 : area <= 420 ? 0.18 : area <= 700 ? 0.22 : 0.24;
  const minimumCornerPlayableRatio = area <= 80 ? 0.18 : area <= 420 ? 0.22 : 0.24;
  const isValidAfterRemoval = () => {
    const stats = measureWritableMask(mask);
    return (
      stats.components === 1 &&
      stats.rowsCovered === rows &&
      stats.colsCovered === cols &&
      stats.minRun >= 2 &&
      stats.maxRun <= 8 &&
      stats.ratio >= minimumRatio &&
      stats.edgePlayableRatio >= minimumEdgePlayableRatio &&
      stats.cornerPlayableRatio >= minimumCornerPlayableRatio
    );
  };
  const tryRemoveCells = (cells) => {
    const uniqueCells = [];
    const keys = new Set();
    for (const cell of cells) {
      const key = `${cell.y},${cell.x}`;
      if (
        keys.has(key) ||
        cell.y < 0 ||
        cell.y >= rows ||
        cell.x < 0 ||
        cell.x >= cols ||
        !mask[cell.y][cell.x]
      ) {
        return false;
      }
      keys.add(key);
      uniqueCells.push(cell);
    }

    uniqueCells.forEach((cell) => {
      mask[cell.y][cell.x] = false;
    });
    if (isValidAfterRemoval()) {
      return true;
    }
    uniqueCells.forEach((cell) => {
      mask[cell.y][cell.x] = true;
    });
    return false;
  };
  const allCells = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (mask[y][x]) {
        allCells.push({ y, x });
      }
    }
  }

  const seen = new Set();
  const candidateSource = preferredCells.length ? preferredCells.concat(allCells) : allCells;
  const candidates = shuffleList(candidateSource)
    .filter((cell) => {
      const key = `${cell.y},${cell.x}`;
      if (seen.has(key) || !mask[cell.y] || !mask[cell.y][cell.x]) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((cell) => ({
      cell,
      score: getRunSpan(mask, cell.y, cell.x, 0, 1).length +
        getRunSpan(mask, cell.y, cell.x, 1, 0).length +
        Math.random()
    }))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.cell);

  for (const cell of candidates) {
    if (tryRemoveCells([cell])) {
      return true;
    }
  }

  for (const cell of candidates) {
    const patterns = shuffleList([
      [{ y: cell.y, x: cell.x }, { y: cell.y, x: cell.x + 1 }],
      [{ y: cell.y, x: cell.x - 1 }, { y: cell.y, x: cell.x }],
      [{ y: cell.y, x: cell.x }, { y: cell.y + 1, x: cell.x }],
      [{ y: cell.y - 1, x: cell.x }, { y: cell.y, x: cell.x }],
      [{ y: cell.y, x: cell.x }, { y: cell.y, x: cell.x + 1 }, { y: cell.y + 1, x: cell.x }, { y: cell.y + 1, x: cell.x + 1 }],
      [{ y: cell.y - 1, x: cell.x - 1 }, { y: cell.y - 1, x: cell.x }, { y: cell.y, x: cell.x - 1 }, { y: cell.y, x: cell.x }]
    ]);
    for (const pattern of patterns) {
      if (tryRemoveCells(pattern)) {
        return true;
      }
    }
  }

  return false;
}

function buildPuzzleFromMask(sizeKey, mask, options = {}) {
  const { rows, cols } = parseSize(sizeKey);
  const area = (rows - 1) * (cols - 1);
  const digitAttempts = options.requireUnique
    ? (area > 700 ? 24 : area > 420 ? 32 : area > 200 ? 80 : area > 80 ? 64 : 420)
    : 1;

  const polishAttempts = options.requireUnique
    ? (area > 700 ? 18 : area > 420 ? 18 : area > 200 ? 24 : area > 80 ? 24 : 6)
    : 0;
  const nodeLimit = area > 700 ? 5000 : area > 420 ? 5000 : area > 200 ? 3200 : area > 80 ? 2200 : 50000;
  const startedAt = Date.now();
  const timeBudgetMs = options.timeBudgetMs || Number.POSITIVE_INFINITY;
  const solverCheckLimit = options.solverCheckLimit || Number.POSITIVE_INFINITY;
  let solverChecks = 0;

  for (let attempt = 0; attempt < digitAttempts; attempt += 1) {
    if (Date.now() - startedAt > timeBudgetMs || solverChecks >= solverCheckLimit) {
      return null;
    }
    const workingMask = options.requireUnique ? cloneBoolMask(mask) : mask;
    const maxMaskCuts = area > 700 ? 24 : area > 420 ? 18 : area > 200 ? 14 : 8;
    let maskCuts = 0;
    const digits = buildSolutionDigits(rows - 1, cols - 1, workingMask);
    if (!digits) {
      continue;
    }

    for (let polish = 0; polish <= polishAttempts; polish += 1) {
      if (Date.now() - startedAt > timeBudgetMs || solverChecks >= solverCheckLimit) {
        return null;
      }
      const puzzle = buildPuzzleFromDigits(sizeKey, workingMask, digits);
      if (!options.requireUnique) {
        return puzzle;
      }

      solverChecks += 1;
      const result = findAlternateKakuroSolution(puzzle.board, puzzle.boardSol, { nodeLimit });
      if (result.exhausted && !result.hasAlternate) {
        return puzzle;
      }

      const capturedSolutions = result.alternateSolution ? [result.alternateSolution] : [];
      const differingCells = getDifferingSolutionCells(puzzle, capturedSolutions, workingMask);
      if (result.hasAlternate && differingCells.length) {
        let mutated = false;
        const mutationBurst = area > 420 ? 4 : 2;
        for (let mutation = 0; mutation < mutationBurst; mutation += 1) {
          if (mutateSolutionDigits(workingMask, digits, differingCells)) {
            mutated = true;
          }
        }
        if (mutated) {
          continue;
        }
      }
      if (maskCuts < maxMaskCuts && removeAmbiguousWritableCell(workingMask, differingCells)) {
        maskCuts += 1;
        continue;
      }
      if (!mutateSolutionDigits(workingMask, digits, differingCells)) {
        break;
      }
    }
  }

  return null;
}

function isGeneratedPuzzleShapeValid(puzzle) {
  const runs = buildRunsFromBoard(puzzle.board);
  const mask = [];
  for (let y = 1; y < puzzle.board.length; y += 1) {
    const row = [];
    for (let x = 1; x < puzzle.board[0].length; x += 1) {
      row.push(isPlayCell(puzzle.board[y][x]));
    }
    mask.push(row);
  }
  const stats = measureWritableMask(mask);
  const area = mask.length * mask[0].length;
  const minimumRatio = area <= 16 ? 0.55 : area <= 80 ? 0.38 : area <= 420 ? 0.28 : area <= 700 ? 0.32 : 0.34;
  const minimumEdgePlayableRatio = area <= 80 ? 0.12 : area <= 420 ? 0.18 : area <= 700 ? 0.22 : 0.24;
  const minimumCornerPlayableRatio = area <= 80 ? 0.18 : area <= 420 ? 0.22 : 0.24;
  return (
    runs.length > 0 &&
    runs.every((run) => run.cells.length >= 2 && run.cells.length <= 8) &&
    stats.components === 1 &&
    stats.rowsCovered === mask.length &&
    stats.colsCovered === mask[0].length &&
    stats.minRun >= 2 &&
    stats.maxRun <= 8 &&
    stats.ratio >= minimumRatio &&
    stats.edgePlayableRatio >= minimumEdgePlayableRatio &&
    stats.cornerPlayableRatio >= minimumCornerPlayableRatio
  );
}

async function loadPuzzleForSize(sizeKey) {
  const { rows, cols } = parseSize(sizeKey);
  const playRows = Math.max(2, rows - 1);
  const playCols = Math.max(2, cols - 1);
  const area = playRows * playCols;
  const shapeAttemptLimit = area > 700 ? 26 : area > 420 ? 24 : area > 200 ? 22 : 8;
  const puzzleCandidateLimit = area > 700 ? 3 : area > 420 ? 4 : area > 200 ? 4 : 6;
  const puzzleTimeBudgetMs = area > 700 ? 6500 : area > 420 ? 6000 : area > 200 ? 4500 : 8000;
  const solverCheckLimit = area > 700 ? 260 : area > 420 ? 360 : area > 200 ? 520 : 1800;
  const candidates = [];
  let bestPuzzle = null;
  let bestScore = Number.POSITIVE_INFINITY;

  if (sizeKey === "4x4" && Math.random() < 0.32) {
    const fullPuzzle = buildFourByFourFullPuzzle(sizeKey);
    const fullCheck = countKakuroSolutions(fullPuzzle.board, 2);
    if (fullCheck.exhausted && fullCheck.solutions === 1 && isGeneratedPuzzleShapeValid(fullPuzzle)) {
      return fullPuzzle;
    }
  }

  for (let attempt = 0; attempt < shapeAttemptLimit; attempt += 1) {
    const mask = area > 420 && attempt % 3 !== 0
      ? buildCarvedWritableMask(playRows, playCols)
      : buildWritableMask(playRows, playCols, 1);
    enforceHardRunLimit(mask);
    reduceLongRunPressure(mask);
    reduceMediumRunPressure(mask);
    increaseClueDensity(mask);
    reduceLongRunPressure(mask);
    const stats = measureWritableMask(mask);
    if (
      stats.components !== 1 ||
      stats.rowsCovered !== playRows ||
      stats.colsCovered !== playCols ||
      stats.minRun < 2 ||
      stats.maxRun > 8
    ) {
      continue;
    }
    candidates.push({
      mask: cloneBoolMask(mask),
      acceptable: isMaskAcceptable(mask),
      stats,
      score: scoreWritableMask(mask)
    });
  }

  const scorePuzzleCandidate = (candidate) => {
    const minimumSolveRatio = area > 700 ? 0.38 : area > 420 ? 0.36 : area > 200 ? 0.32 : 0.48;
    const targetSolveRatio = area > 700 ? 0.44 : area > 420 ? 0.42 : area > 200 ? 0.4 : 0.5;
    const targetSolveEquationRatio = area > 420 ? 0.78 : area > 200 ? 0.74 : 0.64;
    const minimumSolveEdgeRatio = area > 700 ? 0.26 : area > 420 ? 0.24 : area > 200 ? 0.2 : 0.12;
    const minimumSolveCornerRatio = area > 420 ? 0.24 : area > 200 ? 0.22 : 0.18;
    return candidate.score +
      Math.max(0, minimumSolveRatio - candidate.stats.ratio) * 30000 +
      Math.max(0, candidate.stats.ratio - targetSolveRatio) * 18000 +
      Math.max(0, targetSolveEquationRatio - candidate.stats.equationRatio) * 9000 +
      Math.max(0, minimumSolveEdgeRatio - candidate.stats.edgePlayableRatio) * 26000 +
      Math.max(0, minimumSolveCornerRatio - candidate.stats.cornerPlayableRatio) * 18000 -
      candidate.stats.twoThreeRunRatio * 1200;
  };
  const acceptablePool = candidates.filter((candidate) => candidate.acceptable);
  const acceptableCandidates = area <= 16
    ? shuffleList(acceptablePool)
    : acceptablePool.sort((left, right) => scorePuzzleCandidate(left) - scorePuzzleCandidate(right));
  const fallbackCandidateLimit = area > 420 ? 4 : area > 200 ? 3 : 1;
  const fallbackPool = candidates.filter((candidate) => !candidate.acceptable);
  const fallbackCandidates = (area <= 16
    ? shuffleList(fallbackPool)
    : fallbackPool.sort((left, right) => scorePuzzleCandidate(left) - scorePuzzleCandidate(right)))
    .slice(0, fallbackCandidateLimit);
  const puzzleCandidates = acceptableCandidates
    .slice(0, puzzleCandidateLimit)
    .concat(fallbackCandidates);

  for (const candidate of puzzleCandidates) {
    const puzzle = buildPuzzleFromMask(sizeKey, candidate.mask, {
      requireUnique: true,
      solverCheckLimit,
      timeBudgetMs: puzzleTimeBudgetMs
    });
    if (!puzzle || !isGeneratedPuzzleShapeValid(puzzle)) {
      continue;
    }
    if (candidate.acceptable) {
      bestPuzzle = puzzle;
      bestScore = Number.NEGATIVE_INFINITY;
      break;
    }
    if (candidate.score < bestScore) {
      bestScore = candidate.score;
      bestPuzzle = puzzle;
    }
  }

  if (bestScore === Number.NEGATIVE_INFINITY && bestPuzzle) {
    return bestPuzzle;
  }

  if (bestPuzzle) {
    return bestPuzzle;
  }

  const fallbackMask = buildCarvedWritableMask(playRows, playCols);
  enforceHardRunLimit(fallbackMask);
  reduceLongRunPressure(fallbackMask);
  reduceMediumRunPressure(fallbackMask);
  increaseClueDensity(fallbackMask);
  reduceLongRunPressure(fallbackMask);
  const fallbackStats = measureWritableMask(fallbackMask);
  if (
    fallbackStats.components === 1 &&
    fallbackStats.rowsCovered === playRows &&
    fallbackStats.colsCovered === playCols &&
    fallbackStats.minRun >= 2 &&
    fallbackStats.maxRun <= 8
  ) {
    const fallbackPuzzle = buildPuzzleFromMask(sizeKey, fallbackMask, {
      requireUnique: true,
      solverCheckLimit,
      timeBudgetMs: puzzleTimeBudgetMs
    });
    if (fallbackPuzzle && isGeneratedPuzzleShapeValid(fallbackPuzzle)) {
      return fallbackPuzzle;
    }
  }

  return null;
}

function buildRunsFromBoard(board) {
  const runs = [];
  const height = board.length;
  const width = board[0].length;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = board[y][x];
      if (!isClueCell(cell)) {
        continue;
      }
      const h = getHoriz(cell);
      const v = getVert(cell);

      if (h > 0) {
        const cells = [];
        let nx = x + 1;
        while (nx < width && isPlayCell(board[y][nx])) {
          cells.push({ y, x: nx });
          nx += 1;
        }
        if (cells.length > 0) {
          runs.push({ sum: h, cells });
        }
      }

      if (v > 0) {
        const cells = [];
        let ny = y + 1;
        while (ny < height && isPlayCell(board[ny][x])) {
          cells.push({ y: ny, x });
          ny += 1;
        }
        if (cells.length > 0) {
          runs.push({ sum: v, cells });
        }
      }
    }
  }
  return runs;
}

function restorePersistedGameState() {
  const snapshot = readPersistedGameSnapshot();
  if (!snapshot) {
    return false;
  }

  const restoredGame = {
    sizeKey: snapshot.sizeKey,
    board: cloneMatrix(snapshot.board),
    boardSol: cloneMatrix(snapshot.boardSol),
    runs: buildRunsFromBoard(snapshot.board),
    isSolved: false,
    completionCounted: false
  };

  if (!restoredGame.runs.length) {
    clearPersistedGameState();
    return false;
  }

  game = restoredGame;
  selectedSize = snapshot.sizeKey;
  const index = SIZE_OPTIONS.indexOf(snapshot.sizeKey);
  if (index >= 0) {
    menuSizeIndex = index;
    updateMenuSizeLabel();
  }
  gameTitle.textContent = `Kakuro ${snapshot.sizeKey}`;
  renderBoard();
  evaluateBoard();
  return !game.isSolved;
}

function selectCell(y, x) {
  if (!game || game.isSolved || !isPlayCell(game.board[y][x])) {
    return;
  }

  if (selectedCell && selectedCell.y === y && selectedCell.x === x) {
    selectedCell = null;
    refreshSelectedCellUI();
    return;
  }

  selectedCell = { y, x };
  activePadDigit = null;
  refreshDigitPadSelection();
  refreshSelectedCellUI();
}

function refreshSelectedCellUI() {
  boardEl.querySelectorAll(".cell.play").forEach((cellEl) => {
    const cellY = Number(cellEl.dataset.y);
    const cellX = Number(cellEl.dataset.x);
    const isSelected = Boolean(selectedCell && cellY === selectedCell.y && cellX === selectedCell.x);
    cellEl.classList.toggle("selected", isSelected);
  });
}

function applyDigit(digit) {
  if (!game || game.isSolved) {
    return;
  }

  if (selectedCell) {
    const { y, x } = selectedCell;
    writeDigitToCell(y, x, digit);
    return;
  }

  activePadDigit = activePadDigit === digit ? null : digit;
  refreshDigitPadSelection();
}

function writeDigitToCell(y, x, digit) {
  if (!game || game.isSolved || !isPlayCell(game.board[y][x])) {
    return;
  }

  game.board[y][x] = digit;
  const valueEl = boardEl.querySelector(`.cell.play[data-y="${y}"][data-x="${x}"] span`);
  if (valueEl) {
    valueEl.textContent = digit === 0 ? "" : String(digit);
  }
  evaluateBoard();
}

function getHeldDigitWriteValue(y, x) {
  if (!game || !isPlayCell(game.board[y][x]) || activePadDigit === null) {
    return null;
  }

  if (activePadDigit === 0) {
    return 0;
  }

  return game.board[y][x] === activePadDigit ? 0 : activePadDigit;
}

function clearValidationClasses() {
  boardEl.querySelectorAll(".cell.play").forEach((el) => {
    el.classList.remove("valid", "invalid");
  });
}

function markInvalid(y, x) {
  const el = boardEl.querySelector(`.cell.play[data-y="${y}"][data-x="${x}"]`);
  if (el) {
    el.classList.add("invalid");
  }
}

function markValid(y, x) {
  const el = boardEl.querySelector(`.cell.play[data-y="${y}"][data-x="${x}"]`);
  if (el) {
    el.classList.add("valid");
  }
}

function evaluateBoard() {
  if (!game) {
    return;
  }
  game.isSolved = false;
  clearValidationClasses();
  const bad = new Set();
  let allFilled = true;

  for (const run of game.runs) {
    const seen = new Map();
    let sum = 0;
    let filled = 0;

    run.cells.forEach((c) => {
      const value = game.board[c.y][c.x];
      if (value === 0) {
        allFilled = false;
        return;
      }
      filled += 1;
      sum += value;
      if (!seen.has(value)) {
        seen.set(value, []);
      }
      seen.get(value).push(`${c.y},${c.x}`);
      if (value >= run.sum) {
        bad.add(`${c.y},${c.x}`);
      }
    });

    seen.forEach((positions) => {
      if (positions.length > 1) {
        positions.forEach((pos) => bad.add(pos));
      }
    });

    if (filled === run.cells.length && sum !== run.sum) {
      run.cells.forEach((c) => bad.add(`${c.y},${c.x}`));
    }
  }

  if (bad.size > 0) {
    bad.forEach((pos) => {
      const [y, x] = pos.split(",").map(Number);
      markInvalid(y, x);
    });
    updateSolvedStateUI();
    updateResumeVisibility();
    setStatus("Rule conflict: check the sum or repeated digits.", "bad");
    syncPersistedGameState();
    syncTimedInterstitialFlow();
    return;
  }

  if (allFilled) {
    for (let y = 0; y < game.board.length; y += 1) {
      for (let x = 0; x < game.board[0].length; x += 1) {
        if (isPlayCell(game.board[y][x]) && game.board[y][x] > 0) {
          markValid(y, x);
        }
      }
    }
    selectedCell = null;
    activePadDigit = null;
    refreshSelectedCellUI();
    refreshDigitPadSelection();
    game.isSolved = true;
    registerSolvedGameForInterstitial();
    updateSolvedStateUI();
    updateResumeVisibility();
    setStatus("Well done! The solution is correct.", "ok");
    syncPersistedGameState();
    syncTimedInterstitialFlow();
    return;
  }

  updateSolvedStateUI();
  updateResumeVisibility();
  setStatus("Everything is consistent. Keep going.", "normal");
  syncPersistedGameState();
  syncTimedInterstitialFlow();
}

function resetBoard() {
  if (!game) {
    return;
  }
  for (let y = 0; y < game.board.length; y += 1) {
    for (let x = 0; x < game.board[0].length; x += 1) {
      if (isPlayCell(game.board[y][x])) {
        game.board[y][x] = 0;
      }
    }
  }
  game.isSolved = false;
  renderBoard();
  closeHoldMenu();
  closeSolveDialog();
  updateSolvedStateUI();
  updateResumeVisibility();
  setStatus("Board cleared.", "normal");
  syncPersistedGameState();
  syncTimedInterstitialFlow();
}

function renderBoard() {
  if (!game) {
    return;
  }
  const board = game.board;
  const height = board.length;
  const width = board[0].length;
  boardEl.innerHTML = "";
  boardEl.style.setProperty("--cols", String(width));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = board[y][x];
      const el = document.createElement("div");
      el.className = "cell";

      if (value === -1) {
        el.classList.add("block");
      } else if (isClueCell(value)) {
        el.classList.add("clue");
        const h = getHoriz(value);
        const v = getVert(value);
        if (v > 0) {
          const vertical = document.createElement("span");
          vertical.className = "clue-top";
          vertical.textContent = String(v);
          el.appendChild(vertical);
        }
        if (h > 0) {
          const horizontal = document.createElement("span");
          horizontal.className = "clue-bottom";
          horizontal.textContent = String(h);
          el.appendChild(horizontal);
        }
      } else {
        el.classList.add("play");
        el.dataset.y = String(y);
        el.dataset.x = String(x);
        const span = document.createElement("span");
        span.textContent = value === 0 ? "" : String(value);
        el.appendChild(span);
      }

      boardEl.appendChild(el);
    }
  }
  selectedCell = null;
  activePadDigit = null;
  refreshDigitPadSelection();
  refreshSelectedCellUI();
}

function setStatus(text, type) {
  statusText.textContent = text;
  if (type === "ok") {
    statusText.style.color = "var(--ok)";
    return;
  }
  if (type === "bad") {
    statusText.style.color = "var(--bad)";
    return;
  }
  statusText.style.color = "var(--muted)";
}

function renderDigitPad() {
  digitPad.innerHTML = "";
  for (let d = 1; d <= 9; d += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "digit-btn";
    btn.dataset.digit = String(d);
    btn.style.setProperty("--btn-order", String(d - 1));
    btn.textContent = String(d);
    btn.addEventListener("click", () => applyDigit(d));
    digitPad.appendChild(btn);
  }
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "digit-btn";
  clear.id = "clearKey";
  clear.dataset.digit = "0";
  clear.style.setProperty("--btn-order", "9");
  clear.textContent = "X";
  clear.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startClearHold();
  });
  clear.addEventListener("pointerup", (event) => {
    event.preventDefault();
    const wasLong = clearLongPressTriggered;
    stopClearHold();
    if (!wasLong) {
      applyDigit(0);
    } else {
      suppressClearClick = true;
    }
    clearLongPressTriggered = false;
  });
  clear.addEventListener("pointerleave", () => {
    stopClearHold();
  });
  clear.addEventListener("pointercancel", () => {
    stopClearHold();
  });
  clear.addEventListener("click", (event) => {
    if (suppressClearClick) {
      event.preventDefault();
      suppressClearClick = false;
    }
  });
  clear.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
  digitPad.appendChild(clear);
  refreshDigitPadSelection();
}

function refreshDigitPadSelection() {
  if (!digitPad) {
    return;
  }

  digitPad.querySelectorAll(".digit-btn[data-digit]").forEach((button) => {
    const digit = Number(button.dataset.digit);
    button.classList.toggle("active", activePadDigit === digit);
  });
}

function closeHoldMenu() {
  if (holdMenu) {
    holdMenu.hidden = true;
  }
}

function openHoldMenu() {
  if (holdMenu && game && !game.isSolved) {
    closeSolveDialog();
    holdMenu.hidden = false;
    if (clearBoardButton) {
      clearBoardButton.focus({ preventScroll: true });
    }
  }
}

function closeSolveDialog() {
  if (solveDialog) {
    solveDialog.hidden = true;
  }
}

function openSolveDialog() {
  if (!solveDialog || !game || game.isSolved) {
    return;
  }
  closeHoldMenu();
  solveDialog.hidden = false;
  if (solveConfirmButton) {
    solveConfirmButton.focus({ preventScroll: true });
  }
}

function startCenterHold() {
  if (!game || game.isSolved) {
    return;
  }
  stopCenterHold();
  centerLongPressTriggered = false;
  centerHoldTimer = setTimeout(() => {
    centerLongPressTriggered = true;
    openSolveDialog();
  }, CENTER_SOLVE_HOLD_MS);
}

function stopCenterHold() {
  if (centerHoldTimer) {
    clearTimeout(centerHoldTimer);
    centerHoldTimer = null;
  }
}

function solveCurrentPuzzle() {
  if (!game || game.isSolved) {
    return;
  }

  for (let y = 0; y < game.board.length; y += 1) {
    for (let x = 0; x < game.board[0].length; x += 1) {
      if (isPlayCell(game.board[y][x]) && isPlayCell(game.boardSol[y][x])) {
        game.board[y][x] = game.boardSol[y][x];
      }
    }
  }

  selectedCell = null;
  activePadDigit = null;
  game.completionCounted = true;
  closeSolveDialog();
  closeHoldMenu();
  renderBoard();
  evaluateBoard();
  setStatus("Puzzle solved.", "ok");
}

function startClearHold() {
  if (!game || game.isSolved) {
    return;
  }
  stopClearHold();
  closeHoldMenu();
  clearLongPressTriggered = false;
  clearHoldTimer = setTimeout(() => {
    clearLongPressTriggered = true;
    openHoldMenu();
  }, 520);
}

function stopClearHold() {
  if (clearHoldTimer) {
    clearTimeout(clearHoldTimer);
    clearHoldTimer = null;
  }
}

function canResumeCurrentSelection() {
  return Boolean(game && !game.isSolved && selectedSize === SIZE_OPTIONS[menuSizeIndex]);
}

function updateSolvedStateUI() {
  if (!solvedPanel || !newGameSolvedButton) {
    return;
  }
  const solved = Boolean(game && game.isSolved);
  solvedPanel.hidden = !solved;
  if (viewportShell) {
    viewportShell.classList.toggle("solved", solved);
  }
  if (digitPad) {
    digitPad.classList.toggle("disabled", solved);
  }
  if (solved) {
    closeHoldMenu();
    closeSolveDialog();
    newGameSolvedButton.textContent = `New Game (${selectedSize})`;
  }
}

function updateResumeVisibility() {
  const canResume = canResumeCurrentSelection();
  resumeButton.style.display = canResume ? "" : "none";
  if (canResume) {
    resumeButton.textContent = `Resume ${selectedSize}`;
  } else {
    resumeButton.textContent = "Resume";
  }
}

function setStartControlsDisabled(disabled) {
  [
    sizePrev,
    sizeNext,
    newGameButton,
    resumeButton,
    backButton,
    newGameSolvedButton,
    menuSolvedButton,
    solveConfirmButton,
    solveCloseButton,
    clearBoardButton,
    clearBoardCloseButton
  ].forEach((button) => {
    if (button) {
      button.disabled = disabled;
    }
  });
}

function showScreen(which) {
  setThemePopoverOpen(false);
  closeSolveDialog();
  menuScreen.classList.toggle("active", which === "menu");
  gameScreen.classList.toggle("active", which === "game");
  if (which === "menu") {
    updateResumeVisibility();
    hideGameAd();
  } else if (which === "game") {
    requestAnimationFrame(showGameAd);
  }
  syncTimedInterstitialFlow();
}

async function startGame(sizeKey) {
  if (timedInterstitialPending && !hasActiveGameInProgress()) {
    await maybeShowTimedInterstitial();
  }

  const requestId = ++startGameRequestId;
  setStartControlsDisabled(true);
  setStatus(`${sizeKey} puzzle is loading...`, "normal");
  showLoadingOverlay(`${sizeKey} puzzle is loading...`);

  let puzzle = null;
  try {
    await waitForUiPaint();
    if (requestId !== startGameRequestId) {
      return;
    }
    puzzle = await loadPuzzleForSize(sizeKey);
  } catch (error) {
    puzzle = null;
  } finally {
    if (requestId === startGameRequestId) {
      hideLoadingOverlay();
    }
  }

  if (requestId !== startGameRequestId) {
    return;
  }

  setStartControlsDisabled(false);
  if (!puzzle) {
    setStatus("Puzzle source is not ready yet. Design and mechanics are ready.", "bad");
    return;
  }
  game = {
    ...puzzle,
    runs: buildRunsFromBoard(puzzle.board),
    isSolved: false,
    completionCounted: false
  };
  selectedSize = sizeKey;
  const idx = SIZE_OPTIONS.indexOf(sizeKey);
  if (idx >= 0) {
    menuSizeIndex = idx;
    updateMenuSizeLabel();
  }
  gameTitle.textContent = `Kakuro ${sizeKey}`;
  showScreen("game");
  renderBoard();
  requestAnimationFrame(() => {
    fitBoardToViewport();
  });
  updateSolvedStateUI();
  updateResumeVisibility();
  syncPersistedGameState();
  setStatus(`${sizeKey} puzzle ready. Select a cell and enter a digit.`, "normal");
  syncTimedInterstitialFlow();
}

function updateMenuSizeLabel() {
  const sizeKey = SIZE_OPTIONS[menuSizeIndex] || SIZE_OPTIONS[0];
  sizeLabel.textContent = sizeKey;
  rememberMenuSize(sizeKey);
  updateResumeVisibility();
}

function hasActiveGameInProgress() {
  return Boolean(game && !game.isSolved);
}

function pauseTimedInterstitialCountdown() {
  if (timedInterstitialTimer) {
    clearTimeout(timedInterstitialTimer);
    timedInterstitialTimer = null;
  }
  if (timedInterstitialStartedAt > 0) {
    timedInterstitialRemainingMs = Math.max(
      0,
      timedInterstitialRemainingMs - (Date.now() - timedInterstitialStartedAt)
    );
    timedInterstitialStartedAt = 0;
  }
}

function resetTimedInterstitialCycle() {
  pauseTimedInterstitialCountdown();
  timedInterstitialPending = false;
  timedInterstitialRemainingMs = TIMED_INTERSTITIAL_DELAY_MS;
  solvedGamesSinceInterstitial = 0;
}

function registerSolvedGameForInterstitial() {
  if (!game || game.completionCounted) {
    return;
  }
  game.completionCounted = true;
  if (timedInterstitialPending) {
    return;
  }
  solvedGamesSinceInterstitial += 1;
  if (solvedGamesSinceInterstitial >= INTERSTITIAL_SOLVE_THRESHOLD) {
    timedInterstitialPending = true;
    pauseTimedInterstitialCountdown();
  }
}

function shouldTrackTimedInterstitialCountdown() {
  return !timedInterstitialPending
    && !adMobInterstitialShowing
    && hasActiveGameInProgress()
    && gameScreen.classList.contains("active")
    && document.visibilityState === "visible";
}

function canShowTimedInterstitialNow() {
  return timedInterstitialPending
    && !adMobInterstitialShowing
    && !hasActiveGameInProgress()
    && document.visibilityState === "visible";
}

async function ensureTimedInterstitialPrepared() {
  if (adMobInterstitialReady) {
    return true;
  }
  if (adMobInterstitialLoadingPromise) {
    return adMobInterstitialLoadingPromise;
  }

  const AdMob = await initializeAdMob();
  if (!AdMob || typeof AdMob.prepareInterstitial !== "function") {
    return false;
  }

  adMobInterstitialLoadingPromise = AdMob.prepareInterstitial({
    adId: ADMOB_INTERSTITIAL_ID,
    isTesting: true,
    npa: true
  }).then(() => {
    adMobInterstitialReady = true;
    return true;
  }).catch(() => {
    adMobInterstitialReady = false;
    return false;
  }).finally(() => {
    adMobInterstitialLoadingPromise = null;
  });

  return adMobInterstitialLoadingPromise;
}

function onTimedInterstitialDue() {
  timedInterstitialTimer = null;
  timedInterstitialStartedAt = 0;
  timedInterstitialRemainingMs = 0;
  timedInterstitialPending = true;
  syncTimedInterstitialFlow();
}

function startTimedInterstitialCountdown() {
  if (!shouldTrackTimedInterstitialCountdown() || timedInterstitialTimer) {
    return;
  }
  timedInterstitialStartedAt = Date.now();
  timedInterstitialTimer = setTimeout(onTimedInterstitialDue, timedInterstitialRemainingMs);
  void ensureTimedInterstitialPrepared();
}

async function maybeShowTimedInterstitial() {
  if (!canShowTimedInterstitialNow() || adMobInterstitialPresenting) {
    return;
  }

  adMobInterstitialPresenting = true;
  pauseTimedInterstitialCountdown();

  try {
    const AdMob = await initializeAdMob();
    if (!AdMob || typeof AdMob.showInterstitial !== "function") {
      resetTimedInterstitialCycle();
      return;
    }

    const isPrepared = await ensureTimedInterstitialPrepared();
    if (!isPrepared) {
      resetTimedInterstitialCycle();
      return;
    }

    await AdMob.showInterstitial();
    adMobInterstitialReady = false;
    adMobInterstitialShowing = true;
    resetTimedInterstitialCycle();
    void ensureTimedInterstitialPrepared();
  } catch (_) {
    adMobInterstitialReady = false;
    adMobInterstitialShowing = false;
    resetTimedInterstitialCycle();
  } finally {
    adMobInterstitialPresenting = false;
    if (!adMobInterstitialShowing) {
      syncTimedInterstitialFlow();
    }
  }
}

function syncTimedInterstitialFlow() {
  if (canShowTimedInterstitialNow()) {
    void maybeShowTimedInterstitial();
    return;
  }
  if (shouldTrackTimedInterstitialCountdown()) {
    startTimedInterstitialCountdown();
    return;
  }
  pauseTimedInterstitialCountdown();
}

function getNativeAdMobPlugin() {
  const capacitor = window.Capacitor;
  if (!capacitor || !capacitor.Plugins || !capacitor.Plugins.AdMob) {
    return null;
  }
  const isNative = typeof capacitor.isNativePlatform === "function"
    ? capacitor.isNativePlatform()
    : typeof capacitor.getPlatform === "function" && capacitor.getPlatform() !== "web";
  return isNative ? capacitor.Plugins.AdMob : null;
}

function getAdSlotTopMargin() {
  if (!adSlot) {
    return 0;
  }
  return Math.max(0, Math.round(adSlot.getBoundingClientRect().top));
}

function bindAdMobEvents(AdMob) {
  if (adMobListenersBound || !AdMob || typeof AdMob.addListener !== "function") {
    return;
  }
  adMobListenersBound = true;

  AdMob.addListener("bannerAdSizeChanged", (size) => {
    if (size && size.height > 0 && gameScreen) {
      const preservedView = game ? captureViewportCenterState() : null;
      const reservedHeight = clamp(Math.ceil(size.height) + 8, 54, 96);
      gameScreen.style.setProperty("--ad-slot-height", `${reservedHeight}px`);
      requestAnimationFrame(() => {
        restoreViewportCenterState(preservedView);
      });
    }
  });

  AdMob.addListener("interstitialAdLoaded", () => {
    adMobInterstitialReady = true;
  });

  AdMob.addListener("interstitialAdFailedToLoad", () => {
    adMobInterstitialReady = false;
    adMobInterstitialLoadingPromise = null;
  });

  AdMob.addListener("interstitialAdShowed", () => {
    adMobInterstitialShowing = true;
  });

  AdMob.addListener("interstitialAdFailedToShow", () => {
    adMobInterstitialReady = false;
    adMobInterstitialShowing = false;
    syncTimedInterstitialFlow();
  });

  AdMob.addListener("interstitialAdDismissed", () => {
    adMobInterstitialShowing = false;
    syncTimedInterstitialFlow();
  });
}

function initializeAdMob() {
  const AdMob = getNativeAdMobPlugin();
  if (!AdMob) {
    return Promise.resolve(null);
  }
  bindAdMobEvents(AdMob);
  if (!adMobInitPromise) {
    adMobInitPromise = AdMob.initialize().then(() => AdMob).catch(() => null);
  }
  return adMobInitPromise;
}

async function showGameAd() {
  const AdMob = await initializeAdMob();
  if (!AdMob) {
    return;
  }

  try {
    if (adMobBannerRequested && !adMobBannerVisible && typeof AdMob.resumeBanner === "function") {
      await AdMob.resumeBanner();
      adMobBannerVisible = true;
      return;
    }

    if (adMobBannerRequested && adMobBannerVisible) {
      return;
    }

    await AdMob.showBanner({
      adId: ADMOB_BANNER_ID,
      adSize: "BANNER",
      position: "TOP_CENTER",
      margin: getAdSlotTopMargin(),
      isTesting: true,
      npa: true
    });
    adMobBannerRequested = true;
    adMobBannerVisible = true;
  } catch (_) {
    adMobBannerVisible = false;
  }
}

async function hideGameAd() {
  const AdMob = getNativeAdMobPlugin();
  if (!AdMob || !adMobBannerRequested || !adMobBannerVisible || typeof AdMob.hideBanner !== "function") {
    return;
  }
  try {
    await AdMob.hideBanner();
    adMobBannerVisible = false;
  } catch (_) {
    adMobBannerVisible = false;
  }
}

async function refreshGameAdPosition() {
  const AdMob = getNativeAdMobPlugin();
  if (!AdMob || !adMobBannerRequested || !adMobBannerVisible || typeof AdMob.removeBanner !== "function") {
    return;
  }
  try {
    await AdMob.removeBanner();
    adMobBannerRequested = false;
    adMobBannerVisible = false;
    await showGameAd();
  } catch (_) {
    adMobBannerRequested = false;
    adMobBannerVisible = false;
  }
}

function commitTransform() {
  if (!mapCanvas) {
    return;
  }
  clampViewPosition();
  mapCanvas.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`;
}

function applyTransform() {
  if (transformFrameId) {
    cancelAnimationFrame(transformFrameId);
    transformFrameId = 0;
  }
  commitTransform();
}

function scheduleTransformUpdate() {
  if (transformFrameId) {
    return;
  }
  transformFrameId = requestAnimationFrame(() => {
    transformFrameId = 0;
    commitTransform();
  });
}

function getAxisPanPadding(scaledSize, viewportSize) {
  if (scaledSize <= 0 || viewportSize <= 0) {
    return 0;
  }
  const basePadding = clamp(viewportSize * 2.4, 640, 1600);
  if (scaledSize <= viewportSize) {
    return Math.min(basePadding, (viewportSize - scaledSize) / 2);
  }
  return basePadding;
}

function clampAxis(offset, scaledSize, viewportSize) {
  if (scaledSize <= 0 || viewportSize <= 0) {
    return offset;
  }
  const panPadding = getAxisPanPadding(scaledSize, viewportSize);
  if (scaledSize <= viewportSize) {
    const centeredOffset = (viewportSize - scaledSize) / 2;
    return clamp(offset, centeredOffset - panPadding, centeredOffset + panPadding);
  }
  return clamp(offset, viewportSize - scaledSize - panPadding, panPadding);
}

function clampViewPosition() {
  if (!mapViewport || !boardEl || view.scale <= 0) {
    return;
  }
  const rect = mapViewport.getBoundingClientRect();
  const scaledWidth = boardEl.offsetWidth * view.scale;
  const scaledHeight = boardEl.offsetHeight * view.scale;
  if (rect.width <= 0 || rect.height <= 0 || scaledWidth <= 0 || scaledHeight <= 0) {
    return;
  }
  view.x = clampAxis(view.x, scaledWidth, rect.width);
  view.y = clampAxis(view.y, scaledHeight, rect.height);
}

function toLocal(clientX, clientY) {
  const rect = mapViewport.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function screenToWorld(clientX, clientY) {
  const local = toLocal(clientX, clientY);
  return {
    x: (local.x - view.x) / view.scale,
    y: (local.y - view.y) / view.scale
  };
}

function captureViewportCenterState() {
  if (!mapViewport || view.scale <= 0) {
    return null;
  }
  const rect = mapViewport.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    centerWorldX: (rect.width / 2 - view.x) / view.scale,
    centerWorldY: (rect.height / 2 - view.y) / view.scale
  };
}

function restoreViewportCenterState(state) {
  if (!state || !mapViewport || view.scale <= 0) {
    return;
  }
  const rect = mapViewport.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }
  view.x = rect.width / 2 - state.centerWorldX * view.scale;
  view.y = rect.height / 2 - state.centerWorldY * view.scale;
  applyTransform();
}

function fitBoardToViewport() {
  if (!game) {
    return;
  }
  const rect = mapViewport.getBoundingClientRect();
  const bw = boardEl.offsetWidth;
  const bh = boardEl.offsetHeight;
  const sx = rect.width / (bw + 32);
  const sy = rect.height / (bh + 32);
  view.scale = clamp(Math.min(sx, sy), view.minScale, view.maxScale);
  view.x = (rect.width - bw * view.scale) / 2;
  view.y = (rect.height - bh * view.scale) / 2;
  applyTransform();
}

function getPointerPair() {
  const p = Array.from(pointers.values());
  if (p.length < 2) {
    return null;
  }
  return [p[0], p[1]];
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function onPointerDown(event) {
  if (game && game.isSolved) {
    return;
  }
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (event.target instanceof HTMLElement) {
    pointerStartCell.set(event.pointerId, event.target.closest(".cell.play"));
  } else {
    pointerStartCell.set(event.pointerId, null);
  }
  mapViewport.setPointerCapture(event.pointerId);
  movedOnPointer = false;

  if (pointers.size === 1) {
    dragState = {
      x: event.clientX,
      y: event.clientY,
      ox: view.x,
      oy: view.y
    };
    pinchState = null;
    return;
  }

  const pair = getPointerPair();
  if (!pair) {
    return;
  }
  const mid = midpoint(pair[0], pair[1]);
  pinchState = {
    startDist: dist(pair[0], pair[1]),
    startScale: view.scale,
    anchor: screenToWorld(mid.x, mid.y)
  };
  dragState = null;
}

function onPointerMove(event) {
  if (game && game.isSolved) {
    return;
  }
  if (!pointers.has(event.pointerId)) {
    return;
  }
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size >= 2 && pinchState) {
    const pair = getPointerPair();
    if (!pair) {
      return;
    }
    const mid = midpoint(pair[0], pair[1]);
    const mLocal = toLocal(mid.x, mid.y);
    const ratio = dist(pair[0], pair[1]) / pinchState.startDist;
    view.scale = clamp(pinchState.startScale * ratio, view.minScale, view.maxScale);
    view.x = mLocal.x - pinchState.anchor.x * view.scale;
    view.y = mLocal.y - pinchState.anchor.y * view.scale;
    movedOnPointer = true;
    scheduleTransformUpdate();
    return;
  }

  if (pointers.size === 1 && dragState) {
    const dx = event.clientX - dragState.x;
    const dy = event.clientY - dragState.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      movedOnPointer = true;
    }
    view.x = dragState.ox + dx;
    view.y = dragState.oy + dy;
    scheduleTransformUpdate();
  }
}

function onPointerUp(event) {
  if (mapViewport.hasPointerCapture(event.pointerId)) {
    mapViewport.releasePointerCapture(event.pointerId);
  }
  const startCell = pointerStartCell.get(event.pointerId);
  pointerStartCell.delete(event.pointerId);
  pointers.delete(event.pointerId);

  if (pointers.size < 2) {
    pinchState = null;
  }
  if (pointers.size === 0) {
    dragState = null;
  }

  if (!movedOnPointer && startCell instanceof HTMLElement) {
    const y = Number(startCell.dataset.y);
    const x = Number(startCell.dataset.x);
    if (activePadDigit !== null && !selectedCell) {
      const digit = getHeldDigitWriteValue(y, x);
      if (digit !== null) {
        writeDigitToCell(y, x, digit);
      }
      return;
    }
    selectCell(y, x);
  }
}

function onWheel(event) {
  if (game && game.isSolved) {
    return;
  }
  event.preventDefault();
  const factor = event.deltaY < 0 ? 1.08 : 0.92;
  const anchor = screenToWorld(event.clientX, event.clientY);
  const local = toLocal(event.clientX, event.clientY);
  view.scale = clamp(view.scale * factor, view.minScale, view.maxScale);
  view.x = local.x - anchor.x * view.scale;
  view.y = local.y - anchor.y * view.scale;
  scheduleTransformUpdate();
}

function bindEvents() {
  if (themeToggleButton) {
    themeToggleButton.addEventListener("click", (event) => {
      event.preventDefault();
      toggleThemePopover();
    });
  }

  themeModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyTheme(button.dataset.themeChoice, true);
    });
  });

  themeAccentButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyAccent(button.dataset.accentChoice, true);
    });
  });

  sizePrev.addEventListener("click", () => {
    menuSizeIndex = (menuSizeIndex - 1 + SIZE_OPTIONS.length) % SIZE_OPTIONS.length;
    updateMenuSizeLabel();
  });
  sizeNext.addEventListener("click", () => {
    menuSizeIndex = (menuSizeIndex + 1) % SIZE_OPTIONS.length;
    updateMenuSizeLabel();
  });

  newGameButton.addEventListener("click", () => {
    startGame(SIZE_OPTIONS[menuSizeIndex]);
  });

  resumeButton.addEventListener("click", () => {
    if (canResumeCurrentSelection()) {
      showScreen("game");
      requestAnimationFrame(() => {
        fitBoardToViewport();
      });
    }
  });

  backButton.addEventListener("click", () => {
    closeHoldMenu();
    closeSolveDialog();
    showScreen("menu");
  });

  clearBoardButton.addEventListener("click", () => {
    resetBoard();
  });

  if (clearBoardCloseButton) {
    clearBoardCloseButton.addEventListener("click", closeHoldMenu);
  }

  if (solveConfirmButton) {
    solveConfirmButton.addEventListener("click", solveCurrentPuzzle);
  }

  if (solveCloseButton) {
    solveCloseButton.addEventListener("click", closeSolveDialog);
  }

  newGameSolvedButton.addEventListener("click", () => {
    startGame(selectedSize);
  });

  menuSolvedButton.addEventListener("click", () => {
    closeHoldMenu();
    showScreen("menu");
  });

  document.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Element) {
      const pressedButton = event.target.closest(ANIMATED_BUTTON_SELECTOR);
      if (pressedButton instanceof HTMLButtonElement && !pressedButton.disabled) {
        triggerButtonTapBurst(pressedButton);
      }
    }

    if (themePopover && !themePopover.hidden) {
      if (!(event.target instanceof Node) || !themeControl || !themeControl.contains(event.target)) {
        setThemePopoverOpen(false);
      }
    }

    if (!holdMenu || holdMenu.hidden) {
      return;
    }
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    if (event.target.closest("#holdMenu") || event.target.closest("#clearKey")) {
      return;
    }
    closeHoldMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setThemePopoverOpen(false);
      closeHoldMenu();
      closeSolveDialog();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      syncPersistedGameState();
    }
    syncTimedInterstitialFlow();
  });

  window.addEventListener("pagehide", syncPersistedGameState);
  window.addEventListener("beforeunload", syncPersistedGameState);

  centerButton.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    startCenterHold();
  });
  centerButton.addEventListener("pointerup", () => {
    const wasLong = centerLongPressTriggered;
    stopCenterHold();
    if (wasLong) {
      suppressCenterClick = true;
    }
    centerLongPressTriggered = false;
  });
  centerButton.addEventListener("pointerleave", stopCenterHold);
  centerButton.addEventListener("pointercancel", stopCenterHold);
  centerButton.addEventListener("click", (event) => {
    if (suppressCenterClick) {
      event.preventDefault();
      suppressCenterClick = false;
      return;
    }
    fitBoardToViewport();
  });

  mapViewport.addEventListener("pointerdown", onPointerDown);
  mapViewport.addEventListener("pointermove", onPointerMove);
  mapViewport.addEventListener("pointerup", onPointerUp);
  mapViewport.addEventListener("pointercancel", onPointerUp);
  mapViewport.addEventListener("wheel", onWheel, { passive: false });

  window.addEventListener("resize", () => {
    if (gameScreen.classList.contains("active")) {
      scheduleTransformUpdate();
      clearTimeout(adMobResizeTimer);
      adMobResizeTimer = setTimeout(refreshGameAdPosition, 180);
    }
  });
}

function init() {
  applyAccent(getStoredAccent(), false);
  applyTheme(getStoredTheme(), false);
  updateMenuSizeLabel();
  renderDigitPad();
  bindShellGuards();
  bindEvents();
  if (!restorePersistedGameState()) {
    updateSolvedStateUI();
    updateResumeVisibility();
  }
  if (backButton) {
    backButton.setAttribute("aria-label", "Back to menu");
    backButton.setAttribute("title", "Back to menu");
  }
  syncThemeControls();
  showScreen("menu");
  syncTimedInterstitialFlow();
  startLaunchSequence();
}

init();

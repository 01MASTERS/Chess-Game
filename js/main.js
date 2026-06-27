/**
 * main.js — Application Controller
 *
 * Owns all mutable application state. Wires together
 * ChessEngine, ChessBoard, and ChessUI into a cohesive app.
 *
 * Responsibilities:
 *   - Session state (game state, history, UI state)
 *   - Click/interaction handling
 *   - Persistence (localStorage)
 *   - Coordinating renders after each state change
 *
 * Future-ready:
 *   - State shape is serialisable for PGN/FEN export
 *   - Clock integration point marked with TODO
 *   - Engine (Stockfish) integration point marked with TODO
 */

const ChessApp = (() => {
  const STORAGE_KEY = "chess_v2_session";

  // ─── App State ────────────────────────────────────────────────────────────

  let gameState = null; // ChessEngine state object
  let history = []; // [{ from, to, notation, isCapture, isCastle, isPromotion, stateAfter }]
  let flipped = false; // board orientation
  let selected = null; // index of selected square (or null)
  let legalSqs = []; // legal destination squares for selected piece
  let lastMove = null; // { from, to } of the last executed move
  let gameResult = "playing"; // result string from ChessEngine.getGameResult()
  let awaitingPromo = false; // true while promotion picker is open
  let currentMoveIdx = null; // null = live play, otherwise index in history we're viewing
  let showCoords = true; // visibility state for coordinates
  let gameStartTime = null; // game start timestamp

  // Settings state
  let settings = {
    darkMode: true,
    soundEnabled: true,
    animations: true,
    autoFlip: false,
    boardTheme: "green",
  };

  // TODO: Clock state will live here
  // let clock = { white: 600, black: 600, increment: 0, running: false };

  // ─── Initialise ───────────────────────────────────────────────────────────

  function init() {
    loadSettings();
    applySettings();

    ChessBoard.init("board", "coords-ranks", "coords-files", onSquareClick, onSquareDrop);

    // Header buttons
    document
      .getElementById("btn-new-game")
      .addEventListener("click", confirmNewGame);
    document.getElementById("btn-flip").addEventListener("click", flipBoard);
    document.getElementById("btn-undo").addEventListener("click", undoMove);
    document
      .getElementById("btn-coords-toggle")
      .addEventListener("click", toggleCoords);
    document
      .getElementById("btn-theme")
      .addEventListener("click", openThemeSelector);
    document
      .getElementById("btn-settings")
      .addEventListener("click", openSettings);

    // Move navigation
    document
      .getElementById("btn-prev-move")
      .addEventListener("click", prevMove);
    document
      .getElementById("btn-next-move")
      .addEventListener("click", nextMove);

    // Keyboard shortcuts
    document.addEventListener("keydown", handleKeyboardShortcut);

    // Modal close buttons
    document.querySelectorAll(".modal-close").forEach((btn) => {
      btn.addEventListener("click", closeAllModals);
    });

    // Settings UI
    document
      .getElementById("toggle-dark-mode")
      .addEventListener("change", (e) => {
        settings.darkMode = e.target.checked;
        saveSettings();
        applySettings();
      });

    document.getElementById("toggle-sounds").addEventListener("change", (e) => {
      settings.soundEnabled = e.target.checked;
      saveSettings();
    });

    document
      .getElementById("toggle-animations")
      .addEventListener("change", (e) => {
        settings.animations = e.target.checked;
        saveSettings();
        applySettings();
      });

    document
      .getElementById("toggle-auto-flip")
      .addEventListener("change", (e) => {
        settings.autoFlip = e.target.checked;
        saveSettings();
      });

    document
      .getElementById("btn-clear-storage")
      .addEventListener("click", () => {
        if (window.confirm("Clear all saved games? This cannot be undone.")) {
          localStorage.clear();
          startNewGame();
        }
      });

    // Close modals on background click
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeAllModals();
      });
    });

    if (!loadSession()) startNewGame();
    else fullRender();

    gameStartTime = Date.now();
  }

  // ─── New Game / Reset ─────────────────────────────────────────────────────

  function startNewGame() {
    gameState = ChessEngine.createInitialState();
    history = [];
    selected = null;
    legalSqs = [];
    lastMove = null;
    gameResult = "playing";
    awaitingPromo = false;
    currentMoveIdx = null;
    gameStartTime = Date.now();
    saveSession();
    fullRender();
  }

  function confirmNewGame() {
    if (history.length === 0) {
      startNewGame();
      return;
    }
    if (window.confirm("Start a new game? Current game will be lost."))
      startNewGame();
  }

  // ─── Board Flip ───────────────────────────────────────────────────────────

  function flipBoard() {
    flipped = !flipped;
    saveSession();
    fullRender();
  }

  // ─── Undo ─────────────────────────────────────────────────────────────────

  function undoMove() {
    if (gameResult !== "playing" || history.length === 0) return;
    history.pop();
    gameState =
      history.length > 0
        ? ChessEngine.cloneState(history[history.length - 1].stateAfter)
        : ChessEngine.createInitialState();
    lastMove =
      history.length > 0
        ? {
            from: history[history.length - 1].from,
            to: history[history.length - 1].to,
          }
        : null;
    selected = null;
    legalSqs = [];
    gameResult = ChessEngine.getGameResult(gameState);
    saveSession();
    fullRender();
  }

  // ─── Move Navigation ──────────────────────────────────────────────────────

  function jumpToMove(moveIdx) {
    if (moveIdx < -1 || moveIdx >= history.length) return;

    currentMoveIdx = moveIdx;

    if (moveIdx === -1) {
      gameState = ChessEngine.createInitialState();
      lastMove = null;
    } else {
      gameState = ChessEngine.cloneState(history[moveIdx].stateAfter);
      lastMove = { from: history[moveIdx].from, to: history[moveIdx].to };
    }

    selected = null;
    legalSqs = [];
    fullRender();
  }

  function prevMove() {
    if (currentMoveIdx === null) currentMoveIdx = history.length - 1;
    else if (currentMoveIdx > -1) currentMoveIdx--;
    else return;

    jumpToMove(currentMoveIdx);
  }

  function nextMove() {
    if (currentMoveIdx === null) return;
    if (currentMoveIdx < history.length - 1) {
      currentMoveIdx++;
      jumpToMove(currentMoveIdx);
    } else {
      currentMoveIdx = null;
      gameState =
        history.length > 0
          ? ChessEngine.cloneState(history[history.length - 1].stateAfter)
          : ChessEngine.createInitialState();
      lastMove =
        history.length > 0
          ? {
              from: history[history.length - 1].from,
              to: history[history.length - 1].to,
            }
          : null;
      selected = null;
      legalSqs = [];
      fullRender();
    }
  }

  // ─── Board Controls ───────────────────────────────────────────────────────

  function toggleCoords() {
    showCoords = !showCoords;
    document.getElementById("coords-ranks").style.display = showCoords
      ? "flex"
      : "none";
    document.getElementById("coords-files").style.display = showCoords
      ? "flex"
      : "none";
  }

  function openThemeSelector() {
    const modal = document.getElementById("theme-selector");
    const container = document.getElementById("theme-options");
    container.innerHTML = "";

    const themes = [
      { id: "green", name: "Green", bg: "#779556", light: "#ebecd0" },
      { id: "classic", name: "Classic", bg: "#B58863", light: "#F0D9B5" },
      { id: "blue", name: "Blue", bg: "#4A90E2", light: "#E8E8E8" },
      { id: "purple", name: "Purple", bg: "#7B5BA0", light: "#F0E8F0" },
    ];

    themes.forEach((theme) => {
      const btn = document.createElement("div");
      btn.className = `theme-option ${settings.boardTheme === theme.id ? "active" : ""}`;
      btn.style.cssText = `border-color: ${theme.bg}; background: linear-gradient(135deg, ${theme.light} 50%, ${theme.bg} 50%);`;
      btn.textContent = theme.name;
      btn.addEventListener("click", () => {
        settings.boardTheme = theme.id;
        saveSettings();
        applyBoardTheme(theme.id);
        modal.classList.remove("visible");
      });
      container.appendChild(btn);
    });

    modal.classList.add("visible");
  }

  function openSettings() {
    const modal = document.getElementById("settings-modal");
    document.getElementById("toggle-dark-mode").checked = settings.darkMode;
    document.getElementById("toggle-sounds").checked = settings.soundEnabled;
    document.getElementById("toggle-animations").checked = settings.animations;
    document.getElementById("toggle-auto-flip").checked = settings.autoFlip;
    modal.classList.add("visible");
  }

  function closeAllModals() {
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.classList.remove("visible");
    });
  }

  // ─── Settings Management ──────────────────────────────────────────────────

  function loadSettings() {
    try {
      const saved = localStorage.getItem("chess_settings");
      if (saved) settings = { ...settings, ...JSON.parse(saved) };
    } catch (_) {
      /* ignore */
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem("chess_settings", JSON.stringify(settings));
    } catch (_) {
      /* ignore */
    }
  }

  function applySettings() {
    applyBoardTheme(settings.boardTheme);
    document.documentElement.classList.toggle("dark-mode", settings.darkMode);
    document.documentElement.style.setProperty(
      "--animations-enabled",
      settings.animations ? "1" : "0",
    );
  }

  function applyBoardTheme(themeId) {
    const themes = {
      green: { light: "#ebecd0", dark: "#779556", coordColor: "#e8e4da" },
      classic: { light: "#F0D9B5", dark: "#B58863", coordColor: "#5a4a3a" },
      blue: { light: "#E8E8E8", dark: "#4A90E2", coordColor: "#2c3e50" },
      purple: { light: "#F0E8F0", dark: "#7B5BA0", coordColor: "#4a3a5a" },
    };
    const theme = themes[themeId] || themes.green;
    document.documentElement.style.setProperty("--sq-light", theme.light);
    document.documentElement.style.setProperty("--sq-dark", theme.dark);
    document.documentElement.style.setProperty(
      "--coord-color",
      theme.coordColor,
    );
  }

  // ─── Keyboard Shortcuts ───────────────────────────────────────────────────

  function handleKeyboardShortcut(e) {
    // Don't trigger if user is typing in an input
    if (e.target.matches("input, textarea, select")) return;

    switch (e.key) {
      case "f":
      case "F":
        e.preventDefault();
        flipBoard();
        break;
      case "c":
      case "C":
        e.preventDefault();
        toggleCoords();
        break;
      case "s":
      case "S":
        e.preventDefault();
        openSettings();
        break;
      case "?":
        e.preventDefault();
        document.getElementById("shortcuts-help").classList.add("visible");
        break;
      case "ArrowLeft":
        e.preventDefault();
        prevMove();
        break;
      case "ArrowRight":
        e.preventDefault();
        nextMove();
        break;
      case "Home":
        e.preventDefault();
        jumpToMove(-1);
        break;
      case "End":
        e.preventDefault();
        jumpToMove(history.length - 1);
        break;
      case "z":
      case "Z":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          undoMove();
        }
        break;
      case "Escape":
        closeAllModals();
        break;
    }
  }

  // ─── Click Handler ────────────────────────────────────────────────────────

  function onSquareClick(sqIdx) {
    if (gameResult !== "playing" || awaitingPromo) return;

    const piece = gameState.board[sqIdx];

    // A legal destination is selected → execute the move
    if (selected !== null && legalSqs.includes(sqIdx)) {
      handleMoveAttempt(selected, sqIdx);
      return;
    }

    // Clicking own piece → select it
    if (piece && ChessEngine.colorOf(piece) === gameState.turn) {
      // Re-clicking same square deselects
      if (selected === sqIdx) {
        selected = null;
        legalSqs = [];
      } else {
        selected = sqIdx;
        legalSqs = ChessEngine.legalMovesFrom(gameState, sqIdx);
      }
      ChessBoard.render(_boardRenderParams());
      return;
    }

    // Clicking empty / enemy square with nothing selected → deselect
    selected = null;
    legalSqs = [];
    ChessBoard.render(_boardRenderParams());
  }

  function onSquareDrop(fromSqIdx, toSqIdx) {
    if (gameResult !== "playing" || awaitingPromo) return;

    const legalMoves = ChessEngine.legalMovesFrom(gameState, fromSqIdx);
    
    if (legalMoves.includes(toSqIdx)) {
      handleMoveAttempt(fromSqIdx, toSqIdx);
    } else {
      selected = null;
      legalSqs = [];
      ChessBoard.render(_boardRenderParams());
    }
  }

  // ─── Move Execution ───────────────────────────────────────────────────────

  async function handleMoveAttempt(from, to) {
    const piece = gameState.board[from];
    const type = ChessEngine.typeOf(piece);
    const col = ChessEngine.colorOf(piece);
    const { r: tr } = ChessEngine.rc(to);

    let promoType = null;

    // Pawn promotion — await user choice
    if (type === "P" && (tr === 0 || tr === 7)) {
      awaitingPromo = true;
      ChessBoard.render(_boardRenderParams()); // keep board visible
      promoType = await ChessUI.showPromotionPicker(col);
      awaitingPromo = false;
    }

    executeMove(from, to, promoType);
  }

  function executeMove(from, to, promoType) {
    const notation = ChessEngine.toAlgebraic(gameState, from, to, promoType);

    // Classify move for sound
    const isCastle =
      ChessEngine.typeOf(gameState.board[from]) === "K" &&
      Math.abs(ChessEngine.rc(from).c - ChessEngine.rc(to).c) === 2;
    const isCapture =
      gameState.board[to] !== null ||
      (ChessEngine.typeOf(gameState.board[from]) === "P" &&
        gameState.enPassant === to);
    const isPromotion = promoType !== null;

    const nextState = ChessEngine.applyMove(gameState, from, to, promoType);
    const nextResult = ChessEngine.getGameResult(nextState);
    const isCheck =
      nextResult === "playing" &&
      ChessEngine.inCheck(nextState.board, nextState.turn);
    const isCheckmate = nextResult === "checkmate";

    history.push({
      from,
      to,
      notation,
      isCapture,
      isCastle,
      isPromotion,
      stateAfter: ChessEngine.cloneState(nextState),
    });

    gameState = nextState;
    lastMove = { from, to };
    selected = null;
    legalSqs = [];
    gameResult = nextResult;

    ChessUI.playMoveSound({
      isCapture,
      isCastle,
      isPromotion,
      isCheck,
      isCheckmate,
    });

    saveSession();
    fullRender();

    // TODO: Trigger Stockfish analysis here if engine is attached
  }

  // ─── Full Render ──────────────────────────────────────────────────────────

  function fullRender() {
    const isCheck =
      gameResult === "playing" &&
      ChessEngine.inCheck(gameState.board, gameState.turn);

    const stats = getGameStatistics();

    ChessBoard.render(_boardRenderParams());
    ChessBoard.renderCoords(flipped);
    ChessUI.renderPlayerBars(gameState, flipped);
    ChessUI.renderStatus(gameResult, gameState.turn, isCheck);
    ChessUI.renderMoveHistory(history, currentMoveIdx, jumpToMove);
    ChessUI.renderStatistics(stats, history.length, currentMoveIdx);
  }

  function getGameStatistics() {
    const { capturedByWhite, capturedByBlack } = ChessEngine.getCapturedPieces(
      gameState.board,
    );
    const advantage = ChessEngine.getMaterialAdvantage(gameState.board);
    const duration = Math.floor((Date.now() - gameStartTime) / 1000);
    const capturedTotal = capturedByWhite.length + capturedByBlack.length;

    return {
      totalMoves: history.length,
      capturedTotal,
      advantage,
      duration,
      capturedByWhite,
      capturedByBlack,
    };
  }

  function _boardRenderParams() {
    const isCheck =
      gameResult === "playing" &&
      ChessEngine.inCheck(gameState.board, gameState.turn);
    return {
      board: gameState.board,
      flipped,
      selected,
      legalSqs,
      lastMove,
      isCheck,
      turn: gameState.turn,
      enPassant: gameState.enPassant,
    };
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  function saveSession() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          gameState,
          history,
          flipped,
          lastMove,
        }),
      );
    } catch (_) {
      /* storage unavailable */
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved.gameState) return false;

      gameState = saved.gameState;
      history = saved.history || [];
      flipped = saved.flipped || false;
      lastMove = saved.lastMove || null;
      selected = null;
      legalSqs = [];
      gameResult = ChessEngine.getGameResult(gameState);
      return true;
    } catch (_) {
      return false;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  // Exposed for future integrations (Stockfish, clocks, PGN export, etc.)

  return {
    init,
    newGame: confirmNewGame,
    flipBoard,
    undoMove,
    getState: () => ChessEngine.cloneState(gameState),
    getHistory: () => [...history],
    getFEN: () => ChessEngine.getFEN(gameState),
    // TODO: loadFEN(fen) — parse and load a position
    // TODO: exportPGN()  — build PGN string from history
  };
})();

// Boot the application once the DOM is ready
document.addEventListener("DOMContentLoaded", ChessApp.init);

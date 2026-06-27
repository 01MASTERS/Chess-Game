/**
 * ui.js — UI Rendering Module
 *
 * Responsible for:
 *   - Player bars (name, captured pieces, material advantage, turn indicator)
 *   - Sidebar (game status, game-over banner, move history)
 *   - Promotion picker dialog
 *   - Chess sound synthesis (Web Audio API, no external files)
 *   - Toast notifications
 *
 * Receives all data it needs via function arguments — no game state stored here.
 */

const ChessUI = (() => {
  // ─── Sound Engine (Web Audio API) ────────────────────────────────────────

  const SoundEngine = (() => {
    let ctx = null;

    function getCtx() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      return ctx;
    }

    function tone(frequency, type, duration, gain = 0.18, delay = 0) {
      try {
        const ac = getCtx();
        const osc = ac.createOscillator();
        const env = ac.createGain();
        osc.connect(env);
        env.connect(ac.destination);
        osc.type = type;
        osc.frequency.value = frequency;
        env.gain.setValueAtTime(0, ac.currentTime + delay);
        env.gain.linearRampToValueAtTime(gain, ac.currentTime + delay + 0.01);
        env.gain.exponentialRampToValueAtTime(
          0.001,
          ac.currentTime + delay + duration,
        );
        osc.start(ac.currentTime + delay);
        osc.stop(ac.currentTime + delay + duration + 0.05);
      } catch (_) {
        /* AudioContext not available */
      }
    }

    return {
      move() {
        tone(440, "triangle", 0.08, 0.12);
        tone(600, "triangle", 0.06, 0.06, 0.06);
      },
      capture() {
        tone(180, "sawtooth", 0.12, 0.14);
        tone(280, "sawtooth", 0.09, 0.1, 0.08);
      },
      check() {
        tone(880, "square", 0.1, 0.1);
        tone(660, "square", 0.1, 0.08, 0.1);
        tone(880, "square", 0.1, 0.1, 0.2);
      },
      castle() {
        tone(300, "triangle", 0.1, 0.1);
        tone(450, "triangle", 0.1, 0.1, 0.1);
        tone(600, "triangle", 0.12, 0.12, 0.2);
      },
      promote() {
        [400, 500, 650, 800].forEach((f, i) =>
          tone(f, "triangle", 0.15, 0.14, i * 0.08),
        );
      },
      gameOver() {
        [600, 500, 400, 300].forEach((f, i) =>
          tone(f, "triangle", 0.18, 0.13, i * 0.12),
        );
      },
    };
  })();

  // ─── DOM Refs ──────────────────────────────────────────────────────────────

  const el = (id) => document.getElementById(id);

  // ─── Player Bars ──────────────────────────────────────────────────────────

  /**
   * Update both player bars.
   *
   * The "top" player is whoever appears above the board (black by default,
   * white when flipped). Captured pieces shown BELOW the captor's bar
   * means the captor's bar shows pieces they have taken FROM the opponent.
   *
   * @param {object} state  - full game state
   * @param {boolean} flipped
   */
  function renderPlayerBars(state, flipped) {
    const { capturedByWhite, capturedByBlack } = ChessEngine.getCapturedPieces(
      state.board,
    );
    const advantage = ChessEngine.getMaterialAdvantage(state.board);

    // topColor = the player at the top of the screen
    const topColor = flipped ? "w" : "b";
    const botColor = flipped ? "b" : "w";

    _updateBar(
      "top",
      topColor,
      state.turn,
      capturedByWhite,
      capturedByBlack,
      advantage,
    );
    _updateBar(
      "bottom",
      botColor,
      state.turn,
      capturedByWhite,
      capturedByBlack,
      advantage,
    );
  }

  function _updateBar(
    position,
    color,
    turn,
    capturedByWhite,
    capturedByBlack,
    advantage,
  ) {
    // Pieces this player has captured = opponent pieces they've taken
    // White captures black pieces → capturedByWhite contains black pieces
    // Black captures white pieces → capturedByBlack contains white pieces
    const capturedByThisPlayer =
      color === "w" ? capturedByWhite : capturedByBlack;

    // Material advantage from THIS player's perspective
    const playerAdvantage = color === "w" ? advantage : -advantage;

    const isActive = turn === color;

    // Avatar
    el(`avatar-${position}`).textContent = color === "w" ? "♔" : "♚";
    el(`avatar-${position}`).className =
      `player-avatar ${color === "w" ? "white-av" : "black-av"}`;

    // Name
    el(`name-${position}`).textContent = color === "w" ? "White" : "Black";

    // Captured pieces
    el(`captured-${position}`).textContent = _sortCaptured(capturedByThisPlayer)
      .map((p) => ChessEngine.PIECE_GLYPHS[p])
      .join("");

    // Material advantage (only shown for the leading side)
    el(`diff-${position}`).textContent =
      playerAdvantage > 0 ? `+${playerAdvantage}` : "";

    // Turn dot
    const dot = el(`dot-${position}`);
    dot.className = `turn-dot${isActive ? "" : " hidden"}`;

    // Bar active state
    const bar = el(`bar-${position}`);
    bar.className = `player-bar ${position}${isActive ? " active-turn" : ""}`;
  }

  /** Sort captured pieces by value descending for consistent display. */
  function _sortCaptured(pieces) {
    const order = { Q: 0, R: 1, B: 2, N: 3, P: 4 };
    return [...pieces].sort(
      (a, b) =>
        (order[ChessEngine.typeOf(a)] ?? 9) -
        (order[ChessEngine.typeOf(b)] ?? 9),
    );
  }

  // ─── Sidebar / Status ────────────────────────────────────────────────────

  /**
   * Update status text and game-over banner.
   * @param {string} result  - from ChessEngine.getGameResult()
   * @param {string} turn    - 'w' or 'b'
   * @param {boolean} isCheck
   */
  function renderStatus(result, turn, isCheck) {
    const statusEl = el("status-text");
    const bannerEl = el("gameover-banner");

    if (result === "playing") {
      bannerEl.classList.remove("visible");
      if (isCheck) {
        statusEl.textContent = `${turn === "w" ? "White" : "Black"} is in Check!`;
        statusEl.className = "status-value in-check";
      } else {
        statusEl.textContent = `${turn === "w" ? "White" : "Black"} to move`;
        statusEl.className = "status-value";
      }
    } else {
      statusEl.textContent = "Game Over";
      statusEl.className = "status-value game-over";
      _showGameOver(result, turn);
    }
  }

  function _showGameOver(result, turn) {
    const titles = {
      checkmate: "Checkmate",
      stalemate: "Stalemate",
      "draw-50move": "50-Move Rule",
      "draw-insufficient": "Insufficient Material",
    };
    const subtitles = {
      checkmate: `${turn === "w" ? "Black" : "White"} wins!`,
      stalemate: "Draw — neither player can move",
      "draw-50move": "Draw by the 50-move rule",
      "draw-insufficient": "Draw — neither side can checkmate",
    };
    el("gameover-title").textContent = titles[result] || "Game Over";
    el("gameover-subtitle").textContent = subtitles[result] || "";
    el("gameover-banner").classList.add("visible");
  }

  // ─── Move History ─────────────────────────────────────────────────────────

  /**
   * Re-render the full move history list.
   * @param {Array} history - array of { notation } objects
   * @param {number|null} currentMoveIdx - index of currently viewed move
   * @param {Function} jumpToMove - callback to jump to a specific move
   */
  function renderMoveHistory(
    history,
    currentMoveIdx = null,
    jumpToMove = () => {},
  ) {
    const listEl = el("move-list");
    listEl.innerHTML = "";

    // Update move counter
    const moveCounter = el("move-counter");
    if (moveCounter) {
      const displayIdx =
        currentMoveIdx === null ? history.length : currentMoveIdx + 1;
      moveCounter.textContent = `${displayIdx}/${history.length}`;
    }

    for (let i = 0; i < history.length; i += 2) {
      const row = document.createElement("div");
      row.className = "move-row";

      const numEl = document.createElement("div");
      numEl.className = "move-num";
      numEl.textContent = `${Math.floor(i / 2) + 1}.`;
      row.appendChild(numEl);

      const wEl = document.createElement("div");
      wEl.className = `move-cell${i === history.length - 1 ? " latest" : ""}${currentMoveIdx === i ? " current" : ""}`;
      wEl.textContent = history[i].notation;
      wEl.style.cursor = "pointer";
      wEl.addEventListener("click", () => jumpToMove(i));
      row.appendChild(wEl);

      const bEl = document.createElement("div");
      bEl.className = `move-cell${history[i + 1] && i + 1 === history.length - 1 ? " latest" : ""}${currentMoveIdx === i + 1 ? " current" : ""}`;
      if (history[i + 1]) {
        bEl.textContent = history[i + 1].notation;
        bEl.style.cursor = "pointer";
        bEl.addEventListener("click", () => jumpToMove(i + 1));
      }
      row.appendChild(bEl);

      listEl.appendChild(row);
    }

    // Auto-scroll to the latest move
    listEl.scrollTop = listEl.scrollHeight;
  }

  // ─── Statistics ────────────────────────────────────────────────────────────

  /**
   * Render game statistics.
   * @param {object} stats - { totalMoves, capturedTotal, advantage, duration, capturedByWhite, capturedByBlack }
   * @param {number} historyLength - total moves in history
   * @param {number|null} currentMoveIdx - current viewing index
   */
  function renderStatistics(stats, historyLength, currentMoveIdx) {
    const minutes = Math.floor(stats.duration / 60);
    const seconds = stats.duration % 60;
    const durationStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    el("stat-moves").textContent = stats.totalMoves;
    el("stat-duration").textContent = durationStr;
    el("stat-material").textContent = Math.abs(stats.advantage);
    el("stat-captured").textContent = stats.capturedTotal;
  }

  // ─── Promotion Picker ─────────────────────────────────────────────────────

  /**
   * Show the promotion overlay and resolve a Promise with the chosen piece type.
   * @param {'w'|'b'} color
   * @returns {Promise<string>} - resolves with 'Q', 'R', 'B', or 'N'
   */
  function showPromotionPicker(color) {
    return new Promise((resolve) => {
      const overlay = el("promotion-overlay");
      const choices = el("promotion-choices");
      choices.innerHTML = "";

      const types = ["Q", "R", "B", "N"];
      const labels = { Q: "Queen", R: "Rook", B: "Bishop", N: "Knight" };

      types.forEach((type) => {
        const pieceCode = color + type;
        const btn = document.createElement("button");
        btn.className = "promo-btn";
        btn.setAttribute("aria-label", labels[type]);

        const glyph = document.createElement("span");
        glyph.className = `promo-glyph ${color === "w" ? "white-piece" : "black-piece"}`;
        glyph.textContent = ChessEngine.PIECE_GLYPHS[pieceCode];

        const label = document.createElement("span");
        label.className = "promo-label";
        label.textContent = labels[type];

        btn.appendChild(glyph);
        btn.appendChild(label);

        btn.addEventListener("click", () => {
          overlay.classList.remove("visible");
          resolve(type);
        });

        choices.appendChild(btn);
      });

      overlay.classList.add("visible");
    });
  }

  // ─── Toast ───────────────────────────────────────────────────────────────

  let toastTimer = null;

  function showToast(message, duration = 2500) {
    let toastEl = el("toast");
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.id = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => toastEl.classList.remove("visible"),
      duration,
    );
  }

  // ─── Sound Helpers ────────────────────────────────────────────────────────

  /**
   * Play the appropriate sound for a completed move.
   * @param {object} moveInfo - { isCapture, isCastle, isPromotion, isCheck, isCheckmate }
   */
  function playMoveSound(moveInfo) {
    if (moveInfo.isCheckmate) {
      SoundEngine.gameOver();
      return;
    }
    if (moveInfo.isCheck) {
      SoundEngine.check();
      return;
    }
    if (moveInfo.isPromotion) {
      SoundEngine.promote();
      return;
    }
    if (moveInfo.isCastle) {
      SoundEngine.castle();
      return;
    }
    if (moveInfo.isCapture) {
      SoundEngine.capture();
      return;
    }
    SoundEngine.move();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    renderPlayerBars,
    renderStatus,
    renderMoveHistory,
    renderStatistics,
    showPromotionPicker,
    showToast,
    playMoveSound,
  };
})();

/**
 * game.js — Pure Chess Engine
 *
 * Self-contained chess logic with zero DOM dependencies.
 * All functions are exported via the `ChessEngine` namespace.
 *
 * Board representation:
 *   - Array[64], index = row*8 + col
 *   - row 0 = rank 8 (black back rank), row 7 = rank 1 (white back rank)
 *   - Piece codes: 'wP', 'bK', 'wQ', etc. | null for empty
 *
 * State object shape:
 *   { board, turn, castling, enPassant, halfMove, fullMove }
 *
 * Future-ready hooks:
 *   - getFEN(state)  — for PGN/FEN export
 *   - parseFEN(fen)  — for FEN import
 *   - getGameResult(state) — for analysis / review
 */

const ChessEngine = (() => {

  // ─── Constants ────────────────────────────────────────────────────────────

  const PIECE_GLYPHS = {
    wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
    bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
  };

  const PIECE_VALUES = { K: 0, Q: 9, R: 5, B: 3, N: 3, P: 1 };

  const INITIAL_COUNTS = { wP: 8, wN: 2, wB: 2, wR: 2, wQ: 1, bP: 8, bN: 2, bB: 2, bR: 2, bQ: 1 };

  const FILES = 'abcdefgh';
  const RANKS = '87654321';

  // ─── Board Helpers ────────────────────────────────────────────────────────

  function idx(r, c) { return r * 8 + c; }
  function rc(i)     { return { r: Math.floor(i / 8), c: i % 8 }; }
  function colorOf(p) { return p ? p[0] : null; }
  function typeOf(p)  { return p ? p[1] : null; }

  // ─── State Management ─────────────────────────────────────────────────────

  function createInitialBoard() {
    const b = Array(64).fill(null);
    const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
      b[idx(0, c)] = 'b' + backRank[c];
      b[idx(1, c)] = 'bP';
      b[idx(6, c)] = 'wP';
      b[idx(7, c)] = 'w' + backRank[c];
    }
    return b;
  }

  function createInitialState() {
    return {
      board:     createInitialBoard(),
      turn:      'w',
      castling:  { wK: true, wQ: true, bK: true, bQ: true },
      enPassant: null,
      halfMove:  0,
      fullMove:  1,
    };
  }

  function cloneState(s) {
    return {
      board:     [...s.board],
      turn:      s.turn,
      castling:  { ...s.castling },
      enPassant: s.enPassant,
      halfMove:  s.halfMove,
      fullMove:  s.fullMove,
    };
  }

  // ─── Move Generation ──────────────────────────────────────────────────────

  /**
   * Generate pseudo-legal moves (no check filtering).
   * Returns array of destination square indices.
   */
  function rawMoves(board, from, enPassant) {
    const moves = [];
    const piece = board[from];
    if (!piece) return moves;

    const col  = colorOf(piece);
    const type = typeOf(piece);
    const { r, c } = rc(from);

    // Add square if in bounds and not occupied by own piece.
    // Returns true if square was empty (slider can continue).
    const addIf = (r2, c2) => {
      if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) return false;
      const target = board[idx(r2, c2)];
      if (target && colorOf(target) === col) return false;
      moves.push(idx(r2, c2));
      return !target;
    };

    const slide = (dr, dc) => {
      let r2 = r + dr, c2 = c + dc;
      while (r2 >= 0 && r2 <= 7 && c2 >= 0 && c2 <= 7) {
        if (!addIf(r2, c2)) break;
        r2 += dr; c2 += dc;
      }
    };

    if (type === 'P') {
      const dir      = col === 'w' ? -1 : 1;
      const startRow = col === 'w' ? 6 : 1;

      // Forward push
      if (r + dir >= 0 && r + dir <= 7 && !board[idx(r + dir, c)]) {
        moves.push(idx(r + dir, c));
        if (r === startRow && !board[idx(r + 2 * dir, c)]) {
          moves.push(idx(r + 2 * dir, c));
        }
      }

      // Diagonal captures + en passant
      for (const dc of [-1, 1]) {
        const c2 = c + dc, r2 = r + dir;
        if (c2 < 0 || c2 > 7 || r2 < 0 || r2 > 7) continue;
        const target = board[idx(r2, c2)];
        if (target && colorOf(target) !== col) moves.push(idx(r2, c2));
        if (enPassant === idx(r2, c2)) moves.push(idx(r2, c2));
      }

    } else if (type === 'N') {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        addIf(r + dr, c + dc);
      }
    } else if (type === 'B') {
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr, dc);
    } else if (type === 'R') {
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, dc);
    } else if (type === 'Q') {
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, dc);
    } else if (type === 'K') {
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        addIf(r + dr, c + dc);
      }
    }

    return moves;
  }

  function isAttacked(board, sq, byColor) {
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (!p || colorOf(p) !== byColor) continue;
      if (rawMoves(board, i, null).includes(sq)) return true;
    }
    return false;
  }

  function findKing(board, color) {
    return board.findIndex(p => p === color + 'K');
  }

  function inCheck(board, color) {
    const kSq = findKing(board, color);
    if (kSq < 0) return false;
    return isAttacked(board, kSq, color === 'w' ? 'b' : 'w');
  }

  /**
   * Returns all legal moves from a square, filtered for self-check.
   * Castling rights are checked here.
   */
  function legalMovesFrom(state, from) {
    const piece = state.board[from];
    if (!piece) return [];

    const col  = colorOf(piece);
    const type = typeOf(piece);
    if (col !== state.turn) return [];

    let moves = rawMoves(state.board, from, state.enPassant);

    // Castling
    if (type === 'K') {
      const { r, c } = rc(from);
      const opp = col === 'w' ? 'b' : 'w';

      if (!inCheck(state.board, col)) {
        // Kingside
        if (state.castling[col + 'K']) {
          if (!state.board[idx(r, 5)] && !state.board[idx(r, 6)] &&
              !isAttacked(state.board, idx(r, 5), opp) &&
              !isAttacked(state.board, idx(r, 6), opp)) {
            moves.push(idx(r, 6));
          }
        }
        // Queenside
        if (state.castling[col + 'Q']) {
          if (!state.board[idx(r, 3)] && !state.board[idx(r, 2)] && !state.board[idx(r, 1)] &&
              !isAttacked(state.board, idx(r, 3), opp) &&
              !isAttacked(state.board, idx(r, 2), opp)) {
            moves.push(idx(r, 2));
          }
        }
      }
    }

    // Filter moves that leave own king in check
    return moves.filter(to => {
      const next = applyMove(state, from, to, 'Q'); // promo type doesn't affect check
      return !inCheck(next.board, col);
    });
  }

  /** Returns all legal { from, to } pairs for the current player. */
  function allLegalMoves(state) {
    const moves = [];
    for (let i = 0; i < 64; i++) {
      if (state.board[i] && colorOf(state.board[i]) === state.turn) {
        legalMovesFrom(state, i).forEach(to => moves.push({ from: i, to }));
      }
    }
    return moves;
  }

  // ─── Move Application ─────────────────────────────────────────────────────

  /**
   * Returns a new state after applying the move.
   * Does NOT mutate the input state.
   */
  function applyMove(state, from, to, promoType) {
    const s = cloneState(state);
    const piece = s.board[from];
    const col  = colorOf(piece);
    const type = typeOf(piece);
    const { r: fr, c: fc } = rc(from);
    const { r: tr, c: tc } = rc(to);

    s.enPassant = null;
    s.halfMove++;

    // Standard capture resets half-move clock
    if (s.board[to]) s.halfMove = 0;

    // En passant capture — remove the captured pawn
    if (type === 'P' && state.enPassant === to) {
      const capRow = col === 'w' ? tr + 1 : tr - 1;
      s.board[idx(capRow, tc)] = null;
      s.halfMove = 0;
    }

    // Pawn double push — set en passant target
    if (type === 'P' && Math.abs(fr - tr) === 2) {
      s.enPassant = idx((fr + tr) / 2, fc);
    }

    // Pawn move resets half-move clock
    if (type === 'P') s.halfMove = 0;

    // Castling — move the rook alongside the king
    if (type === 'K') {
      if (fc === 4 && tc === 6) { s.board[idx(fr, 7)] = null; s.board[idx(fr, 5)] = col + 'R'; }
      if (fc === 4 && tc === 2) { s.board[idx(fr, 0)] = null; s.board[idx(fr, 3)] = col + 'R'; }
      s.castling[col + 'K'] = false;
      s.castling[col + 'Q'] = false;
    }

    // Rook move disables that side's castling
    if (type === 'R') {
      if (from === idx(7, 0)) s.castling['wQ'] = false;
      if (from === idx(7, 7)) s.castling['wK'] = false;
      if (from === idx(0, 0)) s.castling['bQ'] = false;
      if (from === idx(0, 7)) s.castling['bK'] = false;
    }

    // Rook captured also disables castling
    if (to === idx(7, 0)) s.castling['wQ'] = false;
    if (to === idx(7, 7)) s.castling['wK'] = false;
    if (to === idx(0, 0)) s.castling['bQ'] = false;
    if (to === idx(0, 7)) s.castling['bK'] = false;

    // Execute the move
    s.board[to]   = piece;
    s.board[from] = null;

    // Pawn promotion
    if (type === 'P' && (tr === 0 || tr === 7)) {
      s.board[to] = col + (promoType || 'Q');
    }

    s.turn = col === 'w' ? 'b' : 'w';
    if (col === 'b') s.fullMove++;

    return s;
  }

  // ─── Game Status ──────────────────────────────────────────────────────────

  /**
   * Returns one of: 'playing' | 'checkmate' | 'stalemate' |
   *                 'draw-50move' | 'draw-insufficient'
   */
  function getGameResult(state) {
    const moves = allLegalMoves(state);

    if (moves.length === 0) {
      return inCheck(state.board, state.turn) ? 'checkmate' : 'stalemate';
    }
    if (state.halfMove >= 100) return 'draw-50move';
    if (hasInsufficientMaterial(state.board)) return 'draw-insufficient';
    return 'playing';
  }

  function hasInsufficientMaterial(board) {
    const pieces = board.filter(Boolean);
    if (pieces.length === 2) return true; // K vs K

    if (pieces.length === 3) {
      const types = pieces.map(typeOf).filter(t => t !== 'K');
      if (types.length === 1 && (types[0] === 'B' || types[0] === 'N')) return true;
    }

    if (pieces.length === 4) {
      const wPieces = board.filter(p => p && colorOf(p) === 'w').map(typeOf);
      const bPieces = board.filter(p => p && colorOf(p) === 'b').map(typeOf);
      if (wPieces.length === 2 && wPieces.includes('K') && wPieces.includes('B') &&
          bPieces.length === 2 && bPieces.includes('K') && bPieces.includes('B')) {
        const wBIdx = board.findIndex(p => p === 'wB');
        const bBIdx = board.findIndex(p => p === 'bB');
        const wSq = Math.floor(wBIdx / 8) + wBIdx % 8;
        const bSq = Math.floor(bBIdx / 8) + bBIdx % 8;
        if (wSq % 2 === bSq % 2) return true; // same color bishops
      }
    }

    return false;
  }

  // ─── Algebraic Notation ───────────────────────────────────────────────────

  /**
   * Converts a move to standard algebraic notation.
   * Requires the state BEFORE the move is applied.
   */
  function toAlgebraic(state, from, to, promoType) {
    const piece = state.board[from];
    const type  = typeOf(piece);
    const col   = colorOf(piece);
    const { r: fr, c: fc } = rc(from);
    const { r: tr, c: tc } = rc(to);
    const toSq = FILES[tc] + RANKS[tr];

    const isCapture = state.board[to] !== null || (type === 'P' && state.enPassant === to);

    // Castling
    if (type === 'K' && fc === 4 && tc === 6) return 'O-O';
    if (type === 'K' && fc === 4 && tc === 2) return 'O-O-O';

    let notation = '';

    // Piece letter (pawns omit it except on capture)
    if (type !== 'P') {
      notation += type;
    } else if (isCapture) {
      notation += FILES[fc];
    }

    // Disambiguation
    if (type !== 'P') {
      const ambiguous = [];
      for (let i = 0; i < 64; i++) {
        if (i === from || state.board[i] !== piece) continue;
        if (legalMovesFrom(state, i).includes(to)) ambiguous.push(i);
      }
      if (ambiguous.length > 0) {
        const sameFile = ambiguous.some(i => rc(i).c === fc);
        const sameRank = ambiguous.some(i => rc(i).r === fr);
        if (!sameFile)       notation += FILES[fc];
        else if (!sameRank)  notation += RANKS[fr];
        else                 notation += FILES[fc] + RANKS[fr];
      }
    }

    if (isCapture) notation += 'x';
    notation += toSq;

    // Promotion
    if (type === 'P' && (tr === 0 || tr === 7)) {
      notation += '=' + (promoType || 'Q');
    }

    // Check / checkmate suffix
    const nextState = applyMove(state, from, to, promoType || 'Q');
    const oppColor  = col === 'w' ? 'b' : 'w';
    if (inCheck(nextState.board, oppColor)) {
      const oppMoves = allLegalMoves(nextState);
      notation += oppMoves.length === 0 ? '#' : '+';
    }

    return notation;
  }

  // ─── Material Calculation ─────────────────────────────────────────────────

  /**
   * Returns { capturedByWhite: [...], capturedByBlack: [...] }
   * where each array contains piece codes of what that player has taken.
   *
   * Captured BY white = black pieces no longer on the board.
   * Captured BY black = white pieces no longer on the board.
   */
  function getCapturedPieces(board) {
    const counts = {};
    board.forEach(p => { if (p) counts[p] = (counts[p] || 0) + 1; });

    const capturedByWhite = []; // black pieces taken
    const capturedByBlack = []; // white pieces taken

    Object.entries(INITIAL_COUNTS).forEach(([piece, startCount]) => {
      const remaining = counts[piece] || 0;
      const captured  = startCount - remaining;
      const capturedBy = colorOf(piece) === 'b' ? capturedByWhite : capturedByBlack;
      for (let i = 0; i < captured; i++) capturedBy.push(piece);
    });

    return { capturedByWhite, capturedByBlack };
  }

  /**
   * Returns material advantage from white's perspective.
   * Positive = white leads, negative = black leads.
   */
  function getMaterialAdvantage(board) {
    const { capturedByWhite, capturedByBlack } = getCapturedPieces(board);
    const whiteGain = capturedByWhite.reduce((s, p) => s + PIECE_VALUES[typeOf(p)], 0);
    const blackGain = capturedByBlack.reduce((s, p) => s + PIECE_VALUES[typeOf(p)], 0);
    return whiteGain - blackGain;
  }

  // ─── FEN (future-ready) ───────────────────────────────────────────────────

  /** Serialises the current state to a FEN string. */
  function getFEN(state) {
    const rows = [];
    for (let r = 0; r < 8; r++) {
      let empty = 0, row = '';
      for (let c = 0; c < 8; c++) {
        const p = state.board[idx(r, c)];
        if (!p) {
          empty++;
        } else {
          if (empty) { row += empty; empty = 0; }
          const ch = typeOf(p) === 'P' && colorOf(p) === 'w' ? 'P'
                   : colorOf(p) === 'w' ? typeOf(p)
                   : typeOf(p).toLowerCase();
          row += colorOf(p) === 'w' ? ch.toUpperCase() : ch.toLowerCase();
        }
      }
      if (empty) row += empty;
      rows.push(row);
    }

    const castleStr =
      (state.castling.wK ? 'K' : '') +
      (state.castling.wQ ? 'Q' : '') +
      (state.castling.bK ? 'k' : '') +
      (state.castling.bQ ? 'q' : '') || '-';

    const ep = state.enPassant !== null
      ? FILES[rc(state.enPassant).c] + RANKS[rc(state.enPassant).r]
      : '-';

    return `${rows.join('/')} ${state.turn === 'w' ? 'w' : 'b'} ${castleStr} ${ep} ${state.halfMove} ${state.fullMove}`;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    // State
    createInitialState,
    cloneState,

    // Move logic
    legalMovesFrom,
    allLegalMoves,
    applyMove,
    inCheck,
    getGameResult,

    // Notation & analysis
    toAlgebraic,
    getCapturedPieces,
    getMaterialAdvantage,
    getFEN,

    // Helpers (exposed for UI use)
    colorOf,
    typeOf,
    idx,
    rc,
    PIECE_GLYPHS,
    PIECE_VALUES,
  };

})();

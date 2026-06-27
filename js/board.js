/**
 * board.js — Board Rendering Module
 *
 * Responsible for:
 *   - Rendering the 8×8 grid of squares and pieces
 *   - Coordinate labels (ranks + files)
 *   - Square highlight classes (selected, legal, last-move, check)
 *   - Delegating click events to the app via a callback
 *
 * Zero coupling to game logic — receives all state it needs as arguments.
 */

const ChessBoard = (() => {

  // ─── DOM Refs (resolved once on init) ─────────────────────────────────────

  let boardEl      = null;
  let coordRanksEl = null;
  let coordFilesEl = null;
  let onSquareClickCb = () => {};
  let onSquareDropCb = () => {};

  function init(boardId, coordRanksId, coordFilesId, onClickCallback, onDropCallback) {
    boardEl       = document.getElementById(boardId);
    coordRanksEl  = document.getElementById(coordRanksId);
    coordFilesEl  = document.getElementById(coordFilesId);
    onSquareClickCb = onClickCallback;
    if (onDropCallback) onSquareDropCb = onDropCallback;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  /**
   * Full board re-render.
   *
   * @param {object} params
   * @param {Array}   params.board        - 64-element piece array
   * @param {boolean} params.flipped      - true = black at bottom
   * @param {number|null} params.selected - index of selected square
   * @param {number[]} params.legalSqs    - legal move destination indices
   * @param {{from,to}|null} params.lastMove
   * @param {boolean} params.isCheck      - current player in check?
   * @param {string}  params.turn         - 'w' or 'b'
   * @param {number|null} params.enPassant
   */
  function render({ board, flipped, selected, legalSqs, lastMove, isCheck, turn, enPassant }) {
    let childIdx = 0;
    const reuse = boardEl.children.length === 64;

    for (let displayRow = 0; displayRow < 8; displayRow++) {
      for (let displayCol = 0; displayCol < 8; displayCol++) {
        const r = flipped ? 7 - displayRow : displayRow;
        const c = flipped ? 7 - displayCol : displayCol;
        const sqIdx   = ChessEngine.idx(r, c);
        const isLight = (r + c) % 2 === 0;
        const piece   = board[sqIdx];

        let sq;
        if (reuse) {
          sq = boardEl.children[childIdx++];
          sq.className = `sq ${isLight ? 'light' : 'dark'}`;
        } else {
          sq = document.createElement('div');
          sq.className = `sq ${isLight ? 'light' : 'dark'}`;
          sq.dataset.idx = sqIdx;
          
          sq.addEventListener('click', () => onSquareClickCb(sqIdx));
          
          // --- Drag and Drop Listeners ---
          sq.addEventListener('dragstart', (e) => {
            const currentPiece = sq.querySelector('.piece');
            if (!currentPiece) {
              e.preventDefault();
              return;
            }
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', sqIdx);
            
            // Allow drag ghost to render before updating highlights
            setTimeout(() => {
              onSquareClickCb(sqIdx);
            }, 0);
          });
          
          sq.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            e.dataTransfer.dropEffect = 'move';
          });
          
          sq.addEventListener('dragenter', (e) => {
            e.preventDefault();
          });
          
          sq.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
            if (!isNaN(fromIdx) && fromIdx !== sqIdx) {
              onSquareDropCb(fromIdx, sqIdx);
            }
          });
        }
        
        sq.draggable = !!piece;

        // ── Highlight classes ──
        if (selected === sqIdx) sq.classList.add('sq-selected');
        if (lastMove) {
          if (sqIdx === lastMove.from) sq.classList.add('sq-last-from');
          if (sqIdx === lastMove.to)   sq.classList.add('sq-last-to');
        }
        if (isCheck && piece === turn + 'K') sq.classList.add('sq-check');
        if (legalSqs.includes(sqIdx)) {
          const isEnemyOccupied = piece && ChessEngine.colorOf(piece) !== turn;
          const isEnPassant     = enPassant === sqIdx;
          sq.classList.add(isEnemyOccupied || isEnPassant ? 'sq-legal-capture' : 'sq-legal');
        }

        // ── Piece ──
        if (piece) {
          let pieceEl = sq.querySelector('.piece');
          const pieceCol = ChessEngine.colorOf(piece);
          const newClass = `piece ${pieceCol === 'w' ? 'white-piece' : 'black-piece'}`;
          const newText = ChessEngine.PIECE_GLYPHS[piece];
          
          if (!pieceEl) {
             pieceEl = document.createElement('div');
             sq.appendChild(pieceEl);
          }
          if (pieceEl.className !== newClass) pieceEl.className = newClass;
          if (pieceEl.textContent !== newText) pieceEl.textContent = newText;
        } else {
          const oldPiece = sq.querySelector('.piece');
          if (oldPiece) sq.removeChild(oldPiece);
        }

        if (!reuse) boardEl.appendChild(sq);
      }
    }
  }

  /**
   * Re-render coordinate labels.
   * @param {boolean} flipped
   */
  function renderCoords(flipped) {
    coordRanksEl.innerHTML = '';
    coordFilesEl.innerHTML = '';

    const ranks = flipped
      ? ['1','2','3','4','5','6','7','8']
      : ['8','7','6','5','4','3','2','1'];

    const files = flipped
      ? ['h','g','f','e','d','c','b','a']
      : ['a','b','c','d','e','f','g','h'];

    ranks.forEach(label => {
      const el = document.createElement('div');
      el.className = 'coord-label';
      el.textContent = label;
      coordRanksEl.appendChild(el);
    });

    files.forEach(label => {
      const el = document.createElement('div');
      el.className = 'coord-label';
      el.textContent = label;
      coordFilesEl.appendChild(el);
    });
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return { init, render, renderCoords };

})();

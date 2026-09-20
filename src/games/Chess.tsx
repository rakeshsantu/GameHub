import { useState, useCallback, useEffect } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'

// ── Types ─────────────────────────────────────────────────
type Color = 'w' | 'b'
type PieceType = 'K'|'Q'|'R'|'B'|'N'|'P'
type Piece = { type: PieceType; color: Color }
type Board = (Piece | null)[][]
type Pos = [number, number]

interface CastleRights { wK:boolean; wQ:boolean; bK:boolean; bQ:boolean }

interface State {
  board:      Board
  turn:       Color
  selected:   Pos | null
  moves:      Pos[]
  castle:     CastleRights
  enPassant:  Pos | null
  status:     'playing'|'check'|'checkmate'|'stalemate'|'draw'
  captured:   { w: Piece[]; b: Piece[] }
  history:    string[]
}

const GLYPHS: Record<string, string> = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟',
}

// ── Initial board ─────────────────────────────────────────
function initBoard(): Board {
  const b: Board = Array.from({length:8}, () => Array(8).fill(null))
  const order: PieceType[] = ['R','N','B','Q','K','B','N','R']
  for (let c = 0; c < 8; c++) {
    b[0][c] = { type: order[c], color: 'b' }
    b[1][c] = { type: 'P',      color: 'b' }
    b[6][c] = { type: 'P',      color: 'w' }
    b[7][c] = { type: order[c], color: 'w' }
  }
  return b
}

function cloneBoard(b: Board): Board { return b.map(r => r.map(c => c ? {...c} : null)) }

// ── Raw moves (no check filter) ───────────────────────────
function rawMoves(board: Board, r: number, c: number, enPassant: Pos|null, castle: CastleRights): Pos[] {
  const piece = board[r][c]
  if (!piece) return []
  const { type, color } = piece
  const opp = color === 'w' ? 'b' : 'w'
  const res: Pos[] = []

  const add = (nr: number, nc: number) => {
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return false
    if (board[nr][nc]?.color === color) return false
    res.push([nr, nc])
    return !board[nr][nc]
  }
  const slide = (dr: number, dc: number) => {
    let nr = r+dr, nc = c+dc
    while (nr>=0&&nr<8&&nc>=0&&nc<8) { if (!add(nr,nc)) break; nr+=dr; nc+=dc }
  }

  switch (type) {
    case 'P': {
      const dir = color==='w' ? -1 : 1
      const start = color==='w' ? 6 : 1
      if (!board[r+dir]?.[c]) { res.push([r+dir,c]); if (r===start && !board[r+2*dir]?.[c]) res.push([r+2*dir,c]) }
      for (const dc of [-1,1]) {
        if (board[r+dir]?.[c+dc]?.color===opp) res.push([r+dir,c+dc])
        if (enPassant && enPassant[0]===r+dir && enPassant[1]===c+dc) res.push([r+dir,c+dc])
      }
      break
    }
    case 'N':
      for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r+dr,c+dc)
      break
    case 'B': slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1); break
    case 'R': slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); break
    case 'Q': slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1); slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); break
    case 'K': {
      for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) add(r+dr,c+dc)
      // castling
      if (color==='w' && r===7 && c===4) {
        if (castle.wK && !board[7][5] && !board[7][6] && board[7][7]?.type==='R' && board[7][7]?.color==='w') res.push([7,6])
        if (castle.wQ && !board[7][3] && !board[7][2] && !board[7][1] && board[7][0]?.type==='R' && board[7][0]?.color==='w') res.push([7,2])
      }
      if (color==='b' && r===0 && c===4) {
        if (castle.bK && !board[0][5] && !board[0][6] && board[0][7]?.type==='R' && board[0][7]?.color==='b') res.push([0,6])
        if (castle.bQ && !board[0][3] && !board[0][2] && !board[0][1] && board[0][0]?.type==='R' && board[0][0]?.color==='b') res.push([0,2])
      }
      break
    }
  }
  return res
}

function isInCheck(board: Board, color: Color, ep: Pos|null, castle: CastleRights): boolean {
  let kr=-1, kc=-1
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (board[r][c]?.type==='K'&&board[r][c]?.color===color) { kr=r; kc=c }
  const opp = color==='w' ? 'b' : 'w'
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    if (board[r][c]?.color===opp) {
      const ms = rawMoves(board,r,c,ep,castle)
      if (ms.some(([mr,mc])=>mr===kr&&mc===kc)) return true
    }
  }
  return false
}

function legalMoves(board: Board, r: number, c: number, ep: Pos|null, castle: CastleRights): Pos[] {
  const piece = board[r][c]
  if (!piece) return []
  return rawMoves(board,r,c,ep,castle).filter(([tr,tc]) => {
    const nb = cloneBoard(board)
    nb[tr][tc] = nb[r][c]; nb[r][c] = null
    if (piece.type==='K' && Math.abs(tc-c)===2) {
      const mid = (tc+c)/2
      const nb2 = cloneBoard(board); nb2[r][mid]=nb2[r][c]; nb2[r][c]=null
      if (isInCheck(nb2,piece.color,ep,castle)) return false
    }
    return !isInCheck(nb,piece.color,ep,castle)
  })
}

function allLegalMoves(board: Board, color: Color, ep: Pos|null, castle: CastleRights): [Pos, Pos][] {
  const moves: [Pos, Pos][] = []
  for (let r=0;r<8;r++) for (let c=0;c<8;c++)
    if (board[r][c]?.color===color) legalMoves(board,r,c,ep,castle).forEach(m => moves.push([[r,c],m]))
  return moves
}

// ── Piece values ──────────────────────────────────────────
const PIECE_VAL: Record<PieceType,number> = { P:100, N:320, B:330, R:500, Q:900, K:20000 }

function evaluate(board: Board): number {
  let score = 0
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p = board[r][c]; if (!p) continue
    const v = PIECE_VAL[p.type]
    score += p.color==='w' ? -v : v
  }
  return score
}

// ── Minimax ───────────────────────────────────────────────
function minimax(board: Board, depth: number, alpha: number, beta: number, maximizing: boolean, ep: Pos|null, castle: CastleRights): number {
  if (depth===0) return evaluate(board)
  const color: Color = maximizing ? 'b' : 'w'
  const moves = allLegalMoves(board,color,ep,castle)
  if (moves.length===0) return isInCheck(board,color,ep,castle) ? (maximizing?-9999:9999) : 0
  if (maximizing) {
    let best=-Infinity
    for (const [from,to] of moves) {
      const nb=cloneBoard(board); nb[to[0]][to[1]]=nb[from[0]][from[1]]; nb[from[0]][from[1]]=null
      best=Math.max(best,minimax(nb,depth-1,alpha,beta,false,null,castle))
      alpha=Math.max(alpha,best); if (beta<=alpha) break
    }
    return best
  } else {
    let best=Infinity
    for (const [from,to] of moves) {
      const nb=cloneBoard(board); nb[to[0]][to[1]]=nb[from[0]][from[1]]; nb[from[0]][from[1]]=null
      best=Math.min(best,minimax(nb,depth-1,alpha,beta,true,null,castle))
      beta=Math.min(beta,best); if (beta<=alpha) break
    }
    return best
  }
}

function botMove(board: Board, depth: number, ep: Pos|null, castle: CastleRights): [Pos,Pos]|null {
  const moves = allLegalMoves(board,'b',ep,castle)
  if (!moves.length) return null
  let best=-Infinity, bestMove=moves[0]
  for (const [from,to] of moves) {
    const nb=cloneBoard(board); nb[to[0]][to[1]]=nb[from[0]][from[1]]; nb[from[0]][from[1]]=null
    const s=minimax(nb,depth-1,-Infinity,Infinity,false,null,castle)
    if (s>best) { best=s; bestMove=[from,to] }
  }
  return bestMove
}

// ── Apply move ────────────────────────────────────────────
function applyMove(state: State, from: Pos, to: Pos): State {
  const board = cloneBoard(state.board)
  const [fr,fc] = from, [tr,tc] = to
  const piece   = board[fr][fc]!
  const captured: Piece[] = []

  // en passant capture
  let ep: Pos|null = null
  if (piece.type==='P') {
    if (state.enPassant && tr===state.enPassant[0] && tc===state.enPassant[1]) {
      const capRow = piece.color==='w' ? tr+1 : tr-1
      const cap = board[capRow][tc]
      if (cap) captured.push(cap)
      board[capRow][tc] = null
    }
    if (Math.abs(tr-fr)===2) ep = [(fr+tr)/2, tc]
  }

  // castle rook
  const castle = {...state.castle}
  if (piece.type==='K') {
    if (piece.color==='w') { castle.wK=false; castle.wQ=false }
    else                   { castle.bK=false; castle.bQ=false }
    if (Math.abs(tc-fc)===2) {
      const rookCol = tc>fc ? 7 : 0
      const newRookCol = tc>fc ? tc-1 : tc+1
      board[tr][newRookCol]=board[tr][rookCol]; board[tr][rookCol]=null
    }
  }
  if (fr===7&&fc===0) castle.wQ=false
  if (fr===7&&fc===7) castle.wK=false
  if (fr===0&&fc===0) castle.bQ=false
  if (fr===0&&fc===7) castle.bK=false

  const cap = board[tr][tc]
  if (cap) captured.push(cap)
  board[tr][tc] = piece; board[fr][fc] = null

  // pawn promotion
  if (piece.type==='P' && (tr===0||tr===7)) board[tr][tc]={type:'Q',color:piece.color}

  const newTurn: Color = state.turn==='w'?'b':'w'
  const allMoves = allLegalMoves(board,newTurn,ep,castle)
  const inCheck  = isInCheck(board,newTurn,ep,castle)
  const status: State['status'] =
    allMoves.length===0 ? (inCheck?'checkmate':'stalemate') :
    inCheck ? 'check' : 'playing'

  const newCap = {...state.captured}
  for (const c of captured) newCap[c.color].push(c)

  const notation = `${GLYPHS[piece.color+piece.type]}${String.fromCharCode(97+fc)}${8-fr}→${String.fromCharCode(97+tc)}${8-tr}`

  return { board, turn:newTurn, selected:null, moves:[], castle, enPassant:ep, status, captured:newCap, history:[...state.history, notation] }
}

// ── Component ─────────────────────────────────────────────
interface Props { config: GameConfig; onGameOver: (r:GameResult)=>void; onExit:()=>void }

export default function Chess({ config, onGameOver, onExit }: Props) {
  const { play } = useSound()
  const depth = config.difficulty==='easy'?1:config.difficulty==='medium'?2:3
  const isBot = config.mode==='vs-bot'
  const p1 = config.players[0], p2 = config.players[1]||'Bot'

  const [state, setState] = useState<State>({
    board: initBoard(), turn:'w', selected:null, moves:[],
    castle:{wK:true,wQ:true,bK:true,bQ:true}, enPassant:null,
    status:'playing', captured:{w:[],b:[]}, history:[],
  })
  const [promotion, setPromotion] = useState<Pos|null>(null)
  const [gameOver,  setGameOver]  = useState(false)

  // bot moves
  useEffect(() => {
    if (!isBot || state.turn!=='b' || gameOver) return
    const timer = setTimeout(() => {
      const move = botMove(state.board, depth, state.enPassant, state.castle)
      if (!move) return
      play('move')
      const next = applyMove(state, move[0], move[1])
      setState(next)
    }, 400)
    return () => clearTimeout(timer)
  }, [state.turn, isBot, gameOver])

  useEffect(() => {
    if (gameOver) return
    if (state.status==='checkmate') {
      const winner = state.turn==='w' ? p2 : p1
      setGameOver(true)
      play('win')
      setTimeout(() => onGameOver({ winner, gameId:'chess', difficulty:config.difficulty }), 800)
    } else if (state.status==='stalemate') {
      setGameOver(true)
      setTimeout(() => onGameOver({ winner:'Draw', gameId:'chess', difficulty:config.difficulty }), 800)
    }
  }, [state.status])

  const handleCell = (r: number, c: number) => {
    if (gameOver || (isBot && state.turn==='b')) return
    const { board, selected, moves, turn } = state
    if (selected) {
      const isLegal = moves.some(([mr,mc])=>mr===r&&mc===c)
      if (isLegal) {
        play(board[r][c] ? 'capture' : 'move')
        const next = applyMove(state, selected, [r,c])
        setState(next)
      } else if (board[r][c]?.color===turn) {
        const ms = legalMoves(board,r,c,state.enPassant,state.castle)
        setState(s=>({...s, selected:[r,c], moves:ms}))
      } else {
        setState(s=>({...s, selected:null, moves:[]}))
      }
    } else if (board[r][c]?.color===turn) {
      const ms = legalMoves(board,r,c,state.enPassant,state.castle)
      setState(s=>({...s, selected:[r,c], moves:ms}))
      play('click')
    }
  }

  const isSelected  = (r:number,c:number) => state.selected?.[0]===r && state.selected?.[1]===c
  const isMovable   = (r:number,c:number) => state.moves.some(([mr,mc])=>mr===r&&mc===c)
  const isLastMove  = (_r:number,_c:number) => false // simplified

  const COLS = ['a','b','c','d','e','f','g','h']
  const ROWS = ['8','7','6','5','4','3','2','1']

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      <div className="flex items-center justify-between w-full max-w-lg mb-4">
        <button onClick={onExit} className="game-btn-ghost text-sm py-2 px-4">← Exit</button>
        <h2 className="font-display text-xl text-white">♟️ Chess</h2>
        <div className={`text-sm font-medium px-3 py-1 rounded-full
          ${state.status==='check'     ? 'bg-red-500/20 text-red-400' :
            state.status==='checkmate' ? 'bg-red-600/30 text-red-300' :
                                         'bg-white/5 text-white/50'}`}>
          {state.status==='check' ? '⚠️ Check!' :
           state.status==='checkmate' ? '♛ Checkmate!' :
           state.status==='stalemate' ? '🤝 Stalemate' :
           state.turn==='w' ? `${p1}'s turn` : `${p2}'s turn`}
        </div>
      </div>

      {/* Captured black pieces */}
      <div className="text-lg mb-1 h-6 text-yellow-300">
        {state.captured.b.map((p,i) => <span key={i}>{GLYPHS['b'+p.type]}</span>)}
      </div>

      {/* Board */}
      <div className="relative border-2 border-white/20 rounded-xl overflow-hidden shadow-2xl">
        {state.board.map((row,r) => (
          <div key={r} className="flex">
            <div className="w-5 flex items-center justify-center text-white/30 text-xs select-none bg-dark-900">
              {ROWS[r]}
            </div>
            {row.map((piece,c) => {
              const light = (r+c)%2===0
              const sel   = isSelected(r,c)
              const mov   = isMovable(r,c)
              return (
                <div
                  key={c}
                  onClick={() => handleCell(r,c)}
                  className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center
                             cursor-pointer relative transition-colors select-none
                             ${light ? 'bg-amber-100' : 'bg-amber-800'}
                             ${sel   ? '!bg-brand-400/70' : ''}
                             hover:brightness-110`}
                >
                  {mov && (
                    <div className={`absolute inset-0 flex items-center justify-center ${piece?'ring-2 ring-inset ring-red-400':''}` }>
                      {!piece && <div className="w-3 h-3 rounded-full bg-black/25 z-10" />}
                    </div>
                  )}
                  {piece && (
                    <span className={`text-2xl md:text-3xl z-10 select-none leading-none
                      ${piece.color==='w'?'drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]':'drop-shadow-[0_1px_2px_rgba(255,255,255,0.3)]'}`}>
                      {GLYPHS[piece.color+piece.type]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        <div className="flex ml-5 bg-dark-900">
          {COLS.map(col => (
            <div key={col} className="w-10 md:w-12 flex items-center justify-center text-white/30 text-xs h-5 select-none">
              {col}
            </div>
          ))}
        </div>
      </div>

      {/* Captured white pieces */}
      <div className="text-lg mt-1 h-6 text-gray-200">
        {state.captured.w.map((p,i) => <span key={i}>{GLYPHS['w'+p.type]}</span>)}
      </div>

      {/* History */}
      <div className="mt-3 card-glass px-4 py-2 w-full max-w-lg text-xs text-white/40 overflow-x-auto whitespace-nowrap">
        {state.history.slice(-8).join('  ') || 'No moves yet'}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback, ReactElement } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'
import HowToPlay from '../components/HowToPlay'
import { HOW_TO_PLAY } from './howToPlayData'

/* ── Types ─────────────────────────────────────────────── */
type Color     = 'w' | 'b'
type PieceType = 'K'|'Q'|'R'|'B'|'N'|'P'
type Piece     = { type: PieceType; color: Color }
type Board     = (Piece | null)[][]
type Pos       = [number, number]
interface CastleRights { wK:boolean; wQ:boolean; bK:boolean; bQ:boolean }
interface State {
  board:     Board
  turn:      Color
  selected:  Pos | null
  moves:     Pos[]
  castle:    CastleRights
  enPassant: Pos | null
  status:    'playing'|'check'|'checkmate'|'stalemate'
  captured:  { w: Piece[]; b: Piece[] }
  history:   string[]
}

/* ── Unicode glyphs (used for move history only) ────────── */
const GLYPHS: Record<string,string> = {
  wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
  bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟',
}

/* ── SVG piece paths ────────────────────────────────────── */
// Each piece rendered as inline SVG for crisp scaling at any board size
function PieceSVG({ type, color, size }: { type: PieceType; color: Color; size: number }) {
  const isWhite = color === 'w'
  const fill    = isWhite ? '#ffffff' : '#111111'
  const stroke  = isWhite ? '#111111' : '#dddddd'
  const sw      = size * 0.045  // stroke-width proportional to cell size

  // Viewbox is 45×45 (standard chess piece proportions)
  const paths: Record<PieceType, ReactElement> = {
    P: (
      <g>
        <ellipse cx="22.5" cy="37" rx="8" ry="3.5" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <circle  cx="22.5" cy="20" r="6" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <path    d="M17 28 Q14 37 30.5 37 Q31 28 28 28 Q24 35 21 28 Z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
        <path    d="M22.5 26 Q17 28 28 28 Z" fill={fill} stroke={stroke} strokeWidth={sw}/>
      </g>
    ),
    R: (
      <g>
        <rect x="9" y="36" width="27" height="4" rx="1" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <rect x="11" y="16" width="23" height="20" rx="1" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <rect x="8" y="11"  width="7"  height="7" rx="1" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <rect x="19" y="11" width="7"  height="7" rx="1" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <rect x="30" y="11" width="7"  height="7" rx="1" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <rect x="8" y="16"  width="29" height="2" rx="0" fill={fill} stroke={stroke} strokeWidth={sw}/>
      </g>
    ),
    N: (
      <g>
        <ellipse cx="22.5" cy="37" rx="8.5" ry="3" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <path d="M22 10 C12 10 10 20 11 24 C12 28 14 30 14 34 L31 34 C31 30 30 26 30 24 C32 20 32 10 22 10Z"
              fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
        <path d="M11 24 C8 24 8 30 12 30" fill="none" stroke={stroke} strokeWidth={sw}/>
        <circle cx="18" cy="17" r="2" fill={stroke}/>
        <path d="M22 10 Q18 8 16 12" fill="none" stroke={stroke} strokeWidth={sw*0.8}/>
      </g>
    ),
    B: (
      <g>
        <ellipse cx="22.5" cy="37" rx="8.5" ry="3" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <path d="M22.5 8 C17 8 13 14 13 20 C13 27 17 31 17 35 L28 35 C28 31 32 27 32 20 C32 14 28 8 22.5 8Z"
              fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
        <circle cx="22.5" cy="8" r="2.5" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <path d="M15 26 L30 26" stroke={stroke} strokeWidth={sw} fill="none"/>
      </g>
    ),
    Q: (
      <g>
        <ellipse cx="22.5" cy="37" rx="9" ry="3" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <path d="M9 34 L12 25 L17 30 L22.5 9 L28 30 L33 25 L36 34 Z"
              fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round"/>
        <ellipse cx="22.5" cy="34" rx="10" ry="2.5" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <circle cx="9"    cy="11" r="2.5" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <circle cx="22.5" cy="8"  r="2.5" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <circle cx="36"   cy="11" r="2.5" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <circle cx="14"   cy="9"  r="2"   fill={fill} stroke={stroke} strokeWidth={sw}/>
        <circle cx="31"   cy="9"  r="2"   fill={fill} stroke={stroke} strokeWidth={sw}/>
      </g>
    ),
    K: (
      <g>
        <ellipse cx="22.5" cy="37" rx="9" ry="3" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <rect x="13" y="29" width="19" height="7" rx="1" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <path d="M11 29 C11 22 17 18 22.5 16 C28 18 34 22 34 29 Z"
              fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
        <rect x="20.5" y="7"  width="4" height="13" rx="1" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <rect x="16"   y="11" width="13" height="4"  rx="1" fill={fill} stroke={stroke} strokeWidth={sw}/>
      </g>
    ),
  }

  return (
    <svg
      viewBox="0 0 45 45"
      width={size * 0.78}
      height={size * 0.78}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display:'block', overflow:'visible', filter: isWhite
        ? 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))'
        : 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' }}
    >
      {paths[type]}
    </svg>
  )
}

/* ── Board init ────────────────────────────────────────── */
function initBoard(): Board {
  const b: Board = Array.from({length:8},()=>Array(8).fill(null))
  const order: PieceType[] = ['R','N','B','Q','K','B','N','R']
  for (let c=0;c<8;c++) {
    b[0][c]={type:order[c],color:'b'}; b[1][c]={type:'P',color:'b'}
    b[6][c]={type:'P',color:'w'};      b[7][c]={type:order[c],color:'w'}
  }
  return b
}
function clone(b:Board):Board { return b.map(r=>r.map(c=>c?{...c}:null)) }

/* ── Move generation ───────────────────────────────────── */
function rawMoves(board:Board,r:number,c:number,ep:Pos|null,castle:CastleRights):Pos[] {
  const piece=board[r][c]; if(!piece) return []
  const {type,color}=piece; const opp=color==='w'?'b':'w'
  const res:Pos[]=[]
  const add=(nr:number,nc:number)=>{
    if(nr<0||nr>7||nc<0||nc>7) return false
    if(board[nr][nc]?.color===color) return false
    res.push([nr,nc]); return !board[nr][nc]
  }
  const slide=(dr:number,dc:number)=>{ let nr=r+dr,nc=c+dc; while(nr>=0&&nr<8&&nc>=0&&nc<8){if(!add(nr,nc))break;nr+=dr;nc+=dc} }
  switch(type){
    case 'P':{
      const dir=color==='w'?-1:1,start=color==='w'?6:1
      if(!board[r+dir]?.[c]){res.push([r+dir,c]);if(r===start&&!board[r+2*dir]?.[c])res.push([r+2*dir,c])}
      for(const dc of[-1,1]){
        if(board[r+dir]?.[c+dc]?.color===opp)res.push([r+dir,c+dc])
        if(ep&&ep[0]===r+dir&&ep[1]===c+dc)res.push([r+dir,c+dc])
      }
      break
    }
    case 'N':for(const[dr,dc]of[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])add(r+dr,c+dc);break
    case 'B':slide(-1,-1);slide(-1,1);slide(1,-1);slide(1,1);break
    case 'R':slide(-1,0);slide(1,0);slide(0,-1);slide(0,1);break
    case 'Q':slide(-1,-1);slide(-1,1);slide(1,-1);slide(1,1);slide(-1,0);slide(1,0);slide(0,-1);slide(0,1);break
    case 'K':{
      for(const[dr,dc]of[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])add(r+dr,c+dc)
      if(color==='w'&&r===7&&c===4){
        if(castle.wK&&!board[7][5]&&!board[7][6]&&board[7][7]?.type==='R')res.push([7,6])
        if(castle.wQ&&!board[7][3]&&!board[7][2]&&!board[7][1]&&board[7][0]?.type==='R')res.push([7,2])
      }
      if(color==='b'&&r===0&&c===4){
        if(castle.bK&&!board[0][5]&&!board[0][6]&&board[0][7]?.type==='R')res.push([0,6])
        if(castle.bQ&&!board[0][3]&&!board[0][2]&&!board[0][1]&&board[0][0]?.type==='R')res.push([0,2])
      }
    }
  }
  return res
}

function inCheck(board:Board,color:Color,ep:Pos|null,castle:CastleRights):boolean {
  let kr=-1,kc=-1
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(board[r][c]?.type==='K'&&board[r][c]?.color===color){kr=r;kc=c}
  const opp=color==='w'?'b':'w'
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(board[r][c]?.color===opp)if(rawMoves(board,r,c,ep,castle).some(([mr,mc])=>mr===kr&&mc===kc))return true
  return false
}

function legalMoves(board:Board,r:number,c:number,ep:Pos|null,castle:CastleRights):Pos[] {
  const piece=board[r][c]; if(!piece) return []
  return rawMoves(board,r,c,ep,castle).filter(([tr,tc])=>{
    const nb=clone(board); nb[tr][tc]=nb[r][c]; nb[r][c]=null
    if(piece.type==='K'&&Math.abs(tc-c)===2){
      const mid=(tc+c)/2; const nb2=clone(board); nb2[r][mid]=nb2[r][c]; nb2[r][c]=null
      if(inCheck(nb2,piece.color,ep,castle))return false
    }
    return !inCheck(nb,piece.color,ep,castle)
  })
}

function allLegal(board:Board,color:Color,ep:Pos|null,castle:CastleRights):[Pos,Pos][] {
  const moves:[Pos,Pos][]=[]
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(board[r][c]?.color===color)legalMoves(board,r,c,ep,castle).forEach(m=>moves.push([[r,c],m]))
  return moves
}

const PV:Record<PieceType,number>={P:100,N:320,B:330,R:500,Q:900,K:20000}
function evaluate(board:Board):number {
  let s=0
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=board[r][c];if(!p)continue;s+=p.color==='w'?-PV[p.type]:PV[p.type]}
  return s
}

function minimax(board:Board,depth:number,alpha:number,beta:number,max:boolean,ep:Pos|null,castle:CastleRights):number {
  if(depth===0)return evaluate(board)
  const color:Color=max?'b':'w'
  const moves=allLegal(board,color,ep,castle)
  if(!moves.length)return inCheck(board,color,ep,castle)?(max?-9999:9999):0
  if(max){let best=-Infinity;for(const[from,to]of moves){const nb=clone(board);nb[to[0]][to[1]]=nb[from[0]][from[1]];nb[from[0]][from[1]]=null;best=Math.max(best,minimax(nb,depth-1,alpha,beta,false,null,castle));alpha=Math.max(alpha,best);if(beta<=alpha)break}return best}
  else{let best=Infinity;for(const[from,to]of moves){const nb=clone(board);nb[to[0]][to[1]]=nb[from[0]][from[1]];nb[from[0]][from[1]]=null;best=Math.min(best,minimax(nb,depth-1,alpha,beta,true,null,castle));beta=Math.min(beta,best);if(beta<=alpha)break}return best}
}

function botMove(board:Board,depth:number,ep:Pos|null,castle:CastleRights):[Pos,Pos]|null {
  const moves=allLegal(board,'b',ep,castle); if(!moves.length)return null
  let best=-Infinity,bm=moves[0]
  for(const[from,to]of moves){const nb=clone(board);nb[to[0]][to[1]]=nb[from[0]][from[1]];nb[from[0]][from[1]]=null;const s=minimax(nb,depth-1,-Infinity,Infinity,false,null,castle);if(s>best){best=s;bm=[from,to]}}
  return bm
}

function applyMove(state:State,from:Pos,to:Pos):State {
  const board=clone(state.board)
  const[fr,fc]=[from[0],from[1]]; const[tr,tc]=[to[0],to[1]]
  const piece=board[fr][fc]!
  const captured:{w:Piece[];b:Piece[]}={w:[...state.captured.w],b:[...state.captured.b]}
  let ep:Pos|null=null
  if(piece.type==='P'){
    if(state.enPassant&&tr===state.enPassant[0]&&tc===state.enPassant[1]){
      const cr=piece.color==='w'?tr+1:tr-1; const cap=board[cr][tc]
      if(cap)captured[cap.color].push(cap); board[cr][tc]=null
    }
    if(Math.abs(tr-fr)===2)ep=[(fr+tr)/2,tc]
  }
  const castle={...state.castle}
  if(piece.type==='K'){
    if(piece.color==='w'){castle.wK=false;castle.wQ=false}else{castle.bK=false;castle.bQ=false}
    if(Math.abs(tc-fc)===2){const rc=tc>fc?7:0,nrc=tc>fc?tc-1:tc+1;board[tr][nrc]=board[tr][rc];board[tr][rc]=null}
  }
  if(fr===7&&fc===0)castle.wQ=false;if(fr===7&&fc===7)castle.wK=false
  if(fr===0&&fc===0)castle.bQ=false;if(fr===0&&fc===7)castle.bK=false
  const cap=board[tr][tc]; if(cap)captured[cap.color].push(cap)
  board[tr][tc]=piece; board[fr][fc]=null
  if(piece.type==='P'&&(tr===0||tr===7))board[tr][tc]={type:'Q',color:piece.color}
  const newTurn:Color=state.turn==='w'?'b':'w'
  const hasLegal=allLegal(board,newTurn,ep,castle).length>0
  const chk=inCheck(board,newTurn,ep,castle)
  const status:State['status']=!hasLegal?(chk?'checkmate':'stalemate'):chk?'check':'playing'
  const note=`${GLYPHS[piece.color+piece.type]}${String.fromCharCode(97+fc)}${8-fr}→${String.fromCharCode(97+tc)}${8-tr}`
  return{board,turn:newTurn,selected:null,moves:[],castle,enPassant:ep,status,captured,history:[...state.history,note]}
}

/* ── Component ──────────────────────────────────────────── */
interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

export default function Chess({ config, onGameOver, onExit }: Props) {
  const { play } = useSound()
  const depth   = config.difficulty==='easy' ? 1 : config.difficulty==='medium' ? 2 : 3
  const isBot   = config.mode === 'vs-bot'
  const p1      = config.players[0]
  const p2      = config.players[1] || 'Bot'

  const [state, setState] = useState<State>({
    board: initBoard(), turn:'w', selected:null, moves:[],
    castle:{wK:true,wQ:true,bK:true,bQ:true}, enPassant:null,
    status:'playing', captured:{w:[],b:[]}, history:[],
  })
  const [gameOver, setGameOver]   = useState(false)
  const [showHelp, setShowHelp]   = useState(false)

  /* ── Dynamic cell size ─────────────────────────────────── */
  const containerRef = useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize]   = useState(56)

  const updateSize = useCallback(() => {
    // available height: screen minus toolbar + status bar + captured rows + history ≈ 220px
    const availH = window.innerHeight - 220
    const availW = window.innerWidth  - 48   // 24px padding each side
    // board needs 8 cells + 20px label column
    const maxFromH = Math.floor((availH) / 8)
    const maxFromW = Math.floor((availW - 20) / 8)
    const cell = Math.max(36, Math.min(72, maxFromH, maxFromW))
    setCellSize(cell)
  }, [])

  useEffect(() => {
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [updateSize])

  /* ── Bot move ──────────────────────────────────────────── */
  useEffect(() => {
    if (!isBot || state.turn !== 'b' || gameOver) return
    const t = setTimeout(() => {
      const mv = botMove(state.board, depth, state.enPassant, state.castle)
      if (!mv) return
      play('move')
      setState(s => applyMove(s, mv[0], mv[1]))
    }, 420)
    return () => clearTimeout(t)
  }, [state.turn, isBot, gameOver])

  /* ── End-game ──────────────────────────────────────────── */
  useEffect(() => {
    if (gameOver) return
    if (state.status === 'checkmate') {
      const winner = state.turn === 'w' ? p2 : p1
      setGameOver(true); play('win')
      setTimeout(() => onGameOver({ winner, gameId:'chess', difficulty:config.difficulty }), 800)
    } else if (state.status === 'stalemate') {
      setGameOver(true)
      setTimeout(() => onGameOver({ winner:'Draw', gameId:'chess', difficulty:config.difficulty }), 600)
    }
  }, [state.status])

  /* ── Click handler ─────────────────────────────────────── */
  const click = (r: number, c: number) => {
    if (gameOver || (isBot && state.turn === 'b')) return
    const { board, selected, moves, turn } = state
    if (selected) {
      if (moves.some(([mr,mc]) => mr===r && mc===c)) {
        play(board[r][c] ? 'capture' : 'move')
        setState(s => applyMove(s, selected, [r,c]))
      } else if (board[r][c]?.color === turn) {
        setState(s => ({...s, selected:[r,c], moves: legalMoves(board,r,c,s.enPassant,s.castle)}))
      } else {
        setState(s => ({...s, selected:null, moves:[]}))
      }
    } else if (board[r][c]?.color === turn) {
      setState(s => ({...s, selected:[r,c], moves: legalMoves(board,r,c,s.enPassant,s.castle)}))
      play('click')
    }
  }

  const COLS = ['a','b','c','d','e','f','g','h']
  const ROWS = ['8','7','6','5','4','3','2','1']

  /* coordinate label width = 20px, fixed */
  const labelW = 20
  const boardPx = cellSize * 8 + labelW

  const statusColor =
    state.status === 'check' || state.status === 'checkmate'
      ? '#f87171' : '#e5e7eb'

  const statusBg =
    state.status === 'check' || state.status === 'checkmate'
      ? 'rgba(155,42,68,0.4)' : 'rgba(20,20,20,0.75)'

  /* ── Captured pieces strip ─────────────────────────────── */
  const CapturedStrip = ({ pieces, label }: { pieces: Piece[]; label: string }) => (
    <div style={{ width: boardPx, minHeight: 22, display:'flex', alignItems:'center', gap:2, padding:'2px 0' }}>
      <span style={{ fontSize: cellSize * 0.18, color:'#888', fontFamily:'Cinzel,serif', minWidth:40 }}>{label}</span>
      {pieces.map((p,i) => (
        <span key={i} style={{ fontSize: cellSize * 0.32, lineHeight:1 }}>
          {GLYPHS[p.color + p.type]}
        </span>
      ))}
    </div>
  )

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col items-center justify-center p-3 relative z-10"
      style={{ gap: 6 }}
    >
      {showHelp && <HowToPlay data={HOW_TO_PLAY.chess} onClose={() => setShowHelp(false)} />}

      {/* ── Toolbar ── */}
      <div style={{ width: boardPx, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={onExit} className="btn-ghost text-xs py-1 px-3">← Exit</button>
        <h2 style={{ fontFamily:'Cinzel Decorative,serif', color:'#ffffff', fontSize:'1rem', margin:0 }}>
          ♟ Chess
        </h2>
        <button onClick={() => setShowHelp(true)} className="btn-ghost text-xs py-1 px-3">📜 Rules</button>
      </div>

      {/* ── Status banner ── */}
      <div style={{
        width: boardPx,
        textAlign:'center',
        fontSize: Math.max(11, cellSize * 0.2),
        fontFamily:'Cinzel,serif',
        letterSpacing:'0.04em',
        fontWeight:600,
        background: statusBg,
        border:'1px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
        padding:'4px 12px',
        color: statusColor,
        transition:'background 0.3s',
      }}>
        {state.status==='check'     ? '⚠ Check!'
        :state.status==='checkmate' ? '♛ Checkmate!'
        :state.status==='stalemate' ? '🤝 Stalemate'
        :state.turn==='w'           ? `${p1}'s Turn — White`
                                    : `${p2}'s Turn — Black`}
      </div>

      {/* ── Captured black pieces (taken by white, shown above board) ── */}
      <CapturedStrip pieces={state.captured.b} label="Captured:" />

      {/* ── Board ── */}
      <div className="chess-frame" style={{ width: boardPx }}>
        {state.board.map((row, r) => (
          <div key={r} style={{ display:'flex', height: cellSize }}>

            {/* rank label */}
            <div
              className="chess-coord"
              style={{
                width: labelW,
                height: cellSize,
                background: '#111',
                fontSize: Math.max(9, cellSize * 0.19),
                color:'#aaa',
              }}
            >
              {ROWS[r]}
            </div>

            {row.map((piece, c) => {
              const isLight  = (r + c) % 2 === 0
              const isSel    = state.selected?.[0]===r && state.selected?.[1]===c
              const isMov    = state.moves.some(([mr,mc]) => mr===r && mc===c)

              /* cell background */
              let bg = isLight ? '#ffffff' : '#1a1a1a'
              if (isSel) bg = '#ffe066'

              return (
                <div
                  key={c}
                  onClick={() => click(r, c)}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    background: bg,
                    position:'relative',
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    cursor:'pointer',
                    transition:'background 0.1s',
                    boxSizing:'border-box',
                    // subtle border-right/bottom to define cells
                    borderRight:  c < 7 ? `1px solid ${isLight ? '#ccc' : '#333'}` : 'none',
                    borderBottom: r < 7 ? `1px solid ${isLight ? '#ccc' : '#333'}` : 'none',
                  }}
                >
                  {/* move indicator */}
                  {isMov && !piece && (
                    <div style={{
                      position:'absolute', inset:0,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      pointerEvents:'none',
                    }}>
                      <div style={{
                        width: cellSize * 0.3,
                        height: cellSize * 0.3,
                        borderRadius:'50%',
                        background:'rgba(60,180,60,0.55)',
                      }}/>
                    </div>
                  )}

                  {/* capture ring */}
                  {isMov && piece && (
                    <div style={{
                      position:'absolute', inset:0,
                      borderRadius:'50%',
                      boxShadow:`inset 0 0 0 ${Math.max(3, cellSize * 0.07)}px rgba(60,180,60,0.7)`,
                      pointerEvents:'none',
                    }}/>
                  )}

                  {/* king-in-check highlight */}
                  {piece?.type==='K' && piece.color===state.turn && state.status==='check' && (
                    <div style={{
                      position:'absolute', inset:0,
                      background:'rgba(220,50,50,0.35)',
                      pointerEvents:'none',
                    }}/>
                  )}

                  {/* piece */}
                  {piece && (
                    <div style={{ position:'relative', zIndex:2 }}>
                      <PieceSVG type={piece.type} color={piece.color} size={cellSize} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* file labels row */}
        <div style={{ display:'flex', background:'#111', height: labelW }}>
          <div style={{ width: labelW }} />
          {COLS.map(col => (
            <div
              key={col}
              className="chess-coord"
              style={{
                width: cellSize,
                height: labelW,
                fontSize: Math.max(9, cellSize * 0.19),
                color:'#aaa',
              }}
            >
              {col}
            </div>
          ))}
        </div>
      </div>

      {/* ── Captured white pieces (taken by black, shown below board) ── */}
      <CapturedStrip pieces={state.captured.w} label="Captured:" />

      {/* ── Move history ── */}
      <div style={{
        width: boardPx,
        background:'rgba(15,15,15,0.85)',
        border:'1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding:'4px 10px',
        fontFamily:'Cinzel,serif',
        fontSize: Math.max(10, cellSize * 0.16),
        color:'rgba(200,200,200,0.55)',
        overflowX:'auto',
        whiteSpace:'nowrap',
      }}>
        {state.history.slice(-10).join('  ') || 'No moves yet'}
      </div>
    </div>
  )
}

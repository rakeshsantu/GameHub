import { useState, useEffect } from 'react'
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

const GLYPHS: Record<string,string> = {
  wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
  bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟',
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
  const {play}=useSound()
  const depth=config.difficulty==='easy'?1:config.difficulty==='medium'?2:3
  const isBot=config.mode==='vs-bot'
  const p1=config.players[0], p2=config.players[1]||'Bot'
  const [state,setState]=useState<State>({
    board:initBoard(),turn:'w',selected:null,moves:[],
    castle:{wK:true,wQ:true,bK:true,bQ:true},enPassant:null,
    status:'playing',captured:{w:[],b:[]},history:[],
  })
  const [gameOver,setGameOver]=useState(false)
  const [showHelp,setShowHelp]=useState(false)

  useEffect(()=>{
    if(!isBot||state.turn!=='b'||gameOver)return
    const t=setTimeout(()=>{
      const mv=botMove(state.board,depth,state.enPassant,state.castle)
      if(!mv)return; play('move'); setState(applyMove(state,mv[0],mv[1]))
    },420)
    return()=>clearTimeout(t)
  },[state.turn,isBot,gameOver])

  useEffect(()=>{
    if(gameOver)return
    if(state.status==='checkmate'){
      const winner=state.turn==='w'?p2:p1; setGameOver(true); play('win')
      setTimeout(()=>onGameOver({winner,gameId:'chess',difficulty:config.difficulty}),800)
    } else if(state.status==='stalemate'){
      setGameOver(true)
      setTimeout(()=>onGameOver({winner:'Draw',gameId:'chess',difficulty:config.difficulty}),600)
    }
  },[state.status])

  const click=(r:number,c:number)=>{
    if(gameOver||(isBot&&state.turn==='b'))return
    const{board,selected,moves,turn}=state
    if(selected){
      if(moves.some(([mr,mc])=>mr===r&&mc===c)){play(board[r][c]?'capture':'move');setState(applyMove(state,selected,[r,c]))}
      else if(board[r][c]?.color===turn){setState(s=>({...s,selected:[r,c],moves:legalMoves(board,r,c,s.enPassant,s.castle)}))}
      else setState(s=>({...s,selected:null,moves:[]}))
    } else if(board[r][c]?.color===turn){
      setState(s=>({...s,selected:[r,c],moves:legalMoves(board,r,c,s.enPassant,s.castle)}))
      play('click')
    }
  }

  const COLS=['a','b','c','d','e','f','g','h']
  const ROWS=['8','7','6','5','4','3','2','1']

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      {showHelp && <HowToPlay data={HOW_TO_PLAY.chess} onClose={()=>setShowHelp(false)} />}

      {/* Toolbar */}
      <div className="flex items-center justify-between w-full max-w-[440px] mb-4">
        <button onClick={onExit} className="btn-ghost text-xs py-1.5 px-3">← Exit</button>
        <h2 style={{fontFamily:'Cinzel Decorative,serif',color:'#d4a843',fontSize:'1rem'}}>♟ Chess</h2>
        <button onClick={()=>setShowHelp(true)} className="btn-ghost text-xs py-1.5 px-3">📜 How to Play</button>
      </div>

      {/* Status banner */}
      <div className={`text-sm mb-3 px-4 py-1.5 rounded-full font-semibold transition-all`}
           style={{
             fontFamily:'Cinzel,serif',letterSpacing:'0.04em',
             background: state.status==='check'||state.status==='checkmate'?'rgba(155,42,68,0.3)':'rgba(42,21,9,0.7)',
             border: '1px solid rgba(212,168,67,0.25)',
             color: state.status==='check'||state.status==='checkmate'?'#fca5a5':'rgba(245,240,232,0.7)',
           }}>
        {state.status==='check'?'⚠ Check!':state.status==='checkmate'?'♛ Checkmate!':state.status==='stalemate'?'🤝 Stalemate':state.turn==='w'?`${p1}'s Turn (White)`:`${p2}'s Turn (Black)`}
      </div>

      {/* Captured black pieces */}
      <div className="text-base mb-1 h-6 opacity-70">
        {state.captured.b.map((p,i)=><span key={i}>{GLYPHS['b'+p.type]}</span>)}
      </div>

      {/* Board */}
      <div className="rounded-xl overflow-hidden shadow-2xl"
           style={{border:'2px solid rgba(212,168,67,0.35)',boxShadow:'0 8px 40px rgba(0,0,0,0.7)'}}>
        {state.board.map((row,r)=>(
          <div key={r} className="flex">
            <div className="w-5 flex items-center justify-center text-xs select-none"
                 style={{background:'#3a1f0d',color:'rgba(212,168,67,0.5)',fontFamily:'Cinzel,serif'}}>
              {ROWS[r]}
            </div>
            {row.map((piece,c)=>{
              const light=(r+c)%2===0
              const sel=state.selected?.[0]===r&&state.selected?.[1]===c
              const mov=state.moves.some(([mr,mc])=>mr===r&&mc===c)
              return(
                <div key={c} onClick={()=>click(r,c)}
                  className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center
                             cursor-pointer relative transition-colors select-none
                             ${light?'chess-light':'chess-dark'}
                             ${sel?(light?'chess-light-sel':'chess-dark-sel'):''}
                             hover:brightness-110`}>
                  {mov&&(
                    piece
                      ? <div className={light?'chess-light-cap':'chess-dark-cap'} style={{position:'absolute',inset:0}}/>
                      : <div className={light?'chess-light-move':'chess-dark-move'} style={{position:'absolute',inset:0}}/>
                  )}
                  {piece&&(
                    <span className={`text-2xl md:text-3xl z-10 select-none leading-none
                      ${piece.color==='w'?'drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]':'drop-shadow-[0_1px_2px_rgba(255,255,255,0.2)]'}`}>
                      {GLYPHS[piece.color+piece.type]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        <div className="flex ml-5" style={{background:'#3a1f0d'}}>
          {COLS.map(col=>(
            <div key={col} className="w-10 md:w-12 flex items-center justify-center text-xs h-4 select-none"
                 style={{color:'rgba(212,168,67,0.5)',fontFamily:'Cinzel,serif'}}>
              {col}
            </div>
          ))}
        </div>
      </div>

      {/* Captured white pieces */}
      <div className="text-base mt-1 h-6 opacity-70">
        {state.captured.w.map((p,i)=><span key={i}>{GLYPHS['w'+p.type]}</span>)}
      </div>

      {/* Move history */}
      <div className="mt-3 w-full max-w-[440px] px-4 py-2 rounded-lg text-xs overflow-x-auto whitespace-nowrap"
           style={{background:'rgba(26,12,6,0.7)',border:'1px solid rgba(212,168,67,0.15)',color:'rgba(212,168,67,0.4)',fontFamily:'Cinzel,serif'}}>
        {state.history.slice(-8).join('  ')||'No moves yet'}
      </div>
    </div>
  )
}

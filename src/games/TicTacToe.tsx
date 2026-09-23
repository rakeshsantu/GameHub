import { useState, useEffect } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'
import HowToPlay from '../components/HowToPlay'
import { HOW_TO_PLAY } from './howToPlayData'

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

type Cell = 'X'|'O'|null
const WINS=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]

function checkWin(b:Cell[]):number[]|null {
  for(const l of WINS){const[a,c,d]=l;if(b[a]&&b[a]===b[c]&&b[a]===b[d])return l}
  return null
}

function minimax(b:Cell[],isMax:boolean,alpha:number,beta:number,depth:number):number {
  const win=checkWin(b)
  if(win)return isMax?-10+depth:10-depth
  if(b.every(c=>c!==null))return 0
  let best=isMax?-Infinity:Infinity
  for(let i=0;i<9;i++){
    if(b[i])continue; b[i]=isMax?'O':'X'
    const v=minimax(b,!isMax,alpha,beta,depth+1); b[i]=null
    if(isMax){best=Math.max(best,v);alpha=Math.max(alpha,best)}
    else{best=Math.min(best,v);beta=Math.min(beta,best)}
    if(beta<=alpha)break
  }
  return best
}

function getBotMove(b:Cell[],diff:string):number {
  const empty=b.map((_,i)=>i).filter(i=>!b[i])
  if(diff==='easy')return empty[Math.floor(Math.random()*empty.length)]
  if(diff==='medium'&&Math.random()<0.4)return empty[Math.floor(Math.random()*empty.length)]
  let best=-Infinity,move=empty[0]
  for(const i of empty){const nb=[...b];nb[i]='O';const v=minimax(nb,false,-Infinity,Infinity,0);if(v>best){best=v;move=i}}
  return move
}

export default function TicTacToe({config,onGameOver,onExit}:Props){
  const{play}=useSound()
  const[board,setBoard]=useState<Cell[]>(Array(9).fill(null))
  const[turn,setTurn]=useState<'X'|'O'>('X')
  const[winLine,setWinLine]=useState<number[]|null>(null)
  const[done,setDone]=useState(false)
  const[showHelp,setShowHelp]=useState(false)
  const isBot=config.mode==='vs-bot'
  const p1=config.players[0],p2=config.players[1]||'Bot'

  const doMove=(idx:number,b:Cell[],t:'X'|'O')=>{
    const nb=[...b];nb[idx]=t
    const win=checkWin(nb);setBoard(nb);play(win?'win':'move')
    if(win){setWinLine(win);setDone(true);setTimeout(()=>onGameOver({winner:t==='X'?p1:p2,gameId:'tictactoe',difficulty:config.difficulty}),700)}
    else if(nb.every(c=>c)){setDone(true);setTimeout(()=>onGameOver({winner:'Draw',gameId:'tictactoe',difficulty:config.difficulty}),500)}
    else setTurn(t==='X'?'O':'X')
    return nb
  }

  const click=(i:number)=>{if(done||board[i]||(isBot&&turn==='O'))return;doMove(i,board,turn)}

  useEffect(()=>{
    if(!isBot||turn!=='O'||done)return
    const t=setTimeout(()=>{const m=getBotMove(board,config.difficulty);if(m!==undefined)doMove(m,board,'O')},350)
    return()=>clearTimeout(t)
  },[turn,isBot,done])

  const BORDERS=['border-r-2 border-b-2','border-b-2','border-l-2 border-b-2','border-r-2','','border-l-2','border-r-2 border-t-2','border-t-2','border-l-2 border-t-2']

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      {showHelp&&<HowToPlay data={HOW_TO_PLAY.tictactoe} onClose={()=>setShowHelp(false)}/>}

      <div className="flex items-center justify-between w-full max-w-sm mb-5">
        <button onClick={onExit} className="btn-ghost text-xs py-1.5 px-3">← Exit</button>
        <h2 style={{fontFamily:'Cinzel Decorative,serif',color:'#d4a843',fontSize:'1rem'}}>✕ Tic-Tac-Toe</h2>
        <button onClick={()=>setShowHelp(true)} className="btn-ghost text-xs py-1.5 px-3">📜 How to Play</button>
      </div>

      <div className="text-sm mb-5 px-4 py-1.5 rounded-full font-semibold"
           style={{fontFamily:'Cinzel,serif',background:'rgba(42,21,9,0.7)',border:'1px solid rgba(212,168,67,0.25)',
                   color:turn==='X'?'#93c5fd':'#fdba74'}}>
        {done?'Game Over':`${turn==='X'?p1:p2}'s Turn (${turn})`}
      </div>

      <div className="rounded-2xl overflow-hidden p-3 shadow-2xl"
           style={{background:'rgba(26,12,6,0.85)',border:'1px solid rgba(212,168,67,0.3)'}}>
        <div className="grid grid-cols-3 gap-0">
          {board.map((_,i)=>(
            <div key={i} className={`${BORDERS[i]} border-gold`}>
              <button onClick={()=>click(i)}
                className={`w-24 h-24 md:w-28 md:h-28 flex items-center justify-center text-5xl md:text-6xl
                           font-bold cursor-pointer transition-all duration-200 select-none rounded-xl m-0.5
                           ${winLine?.includes(i)?'win-cell':''}
                           ${!board[i]&&!done?'hover:bg-white/5 active:scale-95':''}
                           ${board[i]==='X'?'text-blue-300':'text-amber-300'}`}>
                {board[i]&&<span className="animate-bounce-in">{board[i]}</span>}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mt-6 text-xs"
           style={{color:'rgba(212,168,67,0.45)',fontFamily:'Cinzel,serif',letterSpacing:'0.06em'}}>
        <span className="text-blue-300">✕ {p1}</span>
        <span className="opacity-40">vs</span>
        <span className="text-amber-300">○ {p2}</span>
      </div>

      <button onClick={()=>{setBoard(Array(9).fill(null));setTurn('X');setWinLine(null);setDone(false)}}
        className="btn-ghost mt-5 text-sm">🔄 New Game</button>
    </div>
  )
}

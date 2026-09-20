import { useState, useEffect } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

type Cell = 'X'|'O'|null
type Board = Cell[]

const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]

function checkWin(b:Board): number[]|null {
  for (const line of WINS) {
    const [a,c,d]=line
    if (b[a]&&b[a]===b[c]&&b[a]===b[d]) return line
  }
  return null
}

function minimax(b:Board, isMax:boolean, alpha:number, beta:number, depth:number): number {
  const win=checkWin(b)
  if (win) return isMax?-10+depth:10-depth
  if (b.every(c=>c!==null)) return 0
  let best=isMax?-Infinity:Infinity
  for (let i=0;i<9;i++) {
    if (b[i]) continue
    b[i]=isMax?'O':'X'
    const v=minimax(b,!isMax,alpha,beta,depth+1)
    b[i]=null
    if (isMax){best=Math.max(best,v);alpha=Math.max(alpha,best)}
    else{best=Math.min(best,v);beta=Math.min(beta,best)}
    if(beta<=alpha)break
  }
  return best
}

function getBotMove(b:Board,diff:string):number {
  const empty=b.map((_,i)=>i).filter(i=>!b[i])
  if(diff==='easy')return empty[Math.floor(Math.random()*empty.length)]
  if(diff==='medium'&&Math.random()<0.4)return empty[Math.floor(Math.random()*empty.length)]
  let best=-Infinity,move=empty[0]
  for(const i of empty){
    const nb=[...b];nb[i]='O'
    const v=minimax(nb,false,-Infinity,Infinity,0)
    if(v>best){best=v;move=i}
  }
  return move
}

export default function TicTacToe({config,onGameOver,onExit}:Props){
  const {play}=useSound()
  const [board,setBoard]=useState<Board>(Array(9).fill(null))
  const [turn,setTurn]=useState<'X'|'O'>('X')
  const [winLine,setWinLine]=useState<number[]|null>(null)
  const [done,setDone]=useState(false)
  const isBot=config.mode==='vs-bot'
  const p1=config.players[0],p2=config.players[1]||'Bot'

  const doMove=(idx:number,b:Board,t:'X'|'O')=>{
    const nb=[...b];nb[idx]=t
    const win=checkWin(nb)
    setBoard(nb)
    play(win?'win':'move')
    if(win){setWinLine(win);setDone(true);setTimeout(()=>onGameOver({winner:t==='X'?p1:p2,gameId:'tictactoe',difficulty:config.difficulty}),700)}
    else if(nb.every(c=>c)){setDone(true);setTimeout(()=>onGameOver({winner:'Draw',gameId:'tictactoe',difficulty:config.difficulty}),500)}
    else setTurn(t==='X'?'O':'X')
    return nb
  }

  const click=(i:number)=>{
    if(done||board[i]||(isBot&&turn==='O'))return
    const nb=doMove(i,board,turn)
    if(isBot&&!checkWin(nb)&&nb.some(c=>!c)){/* bot moves via useEffect */}
  }

  useEffect(()=>{
    if(!isBot||turn!=='O'||done)return
    const t=setTimeout(()=>{
      const m=getBotMove(board,config.difficulty)
      if(m!==undefined)doMove(m,board,'O')
    },350)
    return()=>clearTimeout(t)
  },[turn,isBot,done])

  const cellStyle=(i:number)=>{
    const base='w-24 h-24 md:w-28 md:h-28 flex items-center justify-center text-5xl md:text-6xl font-bold cursor-pointer transition-all duration-200 select-none rounded-2xl'
    const win = winLine?.includes(i)
    const val = board[i]
    return `${base} ${win?'win-cell':''} ${!val&&!done?'hover:bg-white/10 active:scale-95':''} ${val?'':'bg-white/5'} ${val==='X'?'bg-blue-500/10 text-blue-400':val==='O'?'bg-orange-500/10 text-orange-400':''}`
  }

  const BORDERS=['border-r-2 border-b-2','border-b-2','border-l-2 border-b-2',
                 'border-r-2','','border-l-2',
                 'border-r-2 border-t-2','border-t-2','border-l-2 border-t-2']

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      <div className="flex items-center justify-between w-full max-w-sm mb-6">
        <button onClick={onExit} className="game-btn-ghost text-sm py-2 px-4">← Exit</button>
        <h2 className="font-display text-xl text-white">❌ Tic-Tac-Toe</h2>
        <div className="text-sm text-white/50">
          <span className="text-blue-400">X={p1}</span> <span className="text-white/30">vs</span> <span className="text-orange-400">O={p2}</span>
        </div>
      </div>

      <div className={`text-sm mb-6 px-4 py-1.5 rounded-full font-medium
        ${turn==='X'?'bg-blue-500/20 text-blue-300':'bg-orange-500/20 text-orange-300'}`}>
        {done?'Game over!':`${turn==='X'?p1:p2}'s turn (${turn})`}
      </div>

      <div className="grid grid-cols-3 gap-0 border-2 border-white/10 rounded-3xl overflow-hidden p-3 bg-white/5 backdrop-blur-sm shadow-2xl">
        {board.map((_,i)=>(
          <div key={i} className={`${BORDERS[i]} border-white/20 p-1`}>
            <button className={cellStyle(i)} onClick={()=>click(i)}>
              {board[i]&&<span className={`animate-bounce-in`}>{board[i]}</span>}
            </button>
          </div>
        ))}
      </div>

      <button onClick={()=>{setBoard(Array(9).fill(null));setTurn('X');setWinLine(null);setDone(false)}}
        className="game-btn-ghost mt-8 text-sm">
        🔄 New Game
      </button>
    </div>
  )
}

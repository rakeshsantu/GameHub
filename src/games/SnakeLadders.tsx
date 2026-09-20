import { useState, useEffect, useRef } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

const SNAKES: Record<number,number> = { 99:54, 70:55, 52:42, 36:6, 95:24, 78:16, 47:26, 58:8 }
const LADDERS: Record<number,number> = { 4:14, 9:31, 20:38, 28:84, 40:59, 51:67, 63:81, 71:91 }
const MAX_SQ = 100

const P_EMOJI = ['🔴','🔵','🟢','🟡']
const P_TEXT  = ['text-red-400','text-blue-400','text-green-400','text-yellow-400']
const P_BG    = ['bg-red-500/20','bg-blue-500/20','bg-green-500/20','bg-yellow-500/20']

function getBoardPos(sq:number):{row:number;col:number}{
  if(sq<1) return {row:9,col:0}
  const idx=sq-1
  const row=Math.floor(idx/10)
  const col=row%2===0?idx%10:9-(idx%10)
  return {row:9-row,col}
}

export default function SnakeLadders({config,onGameOver,onExit}:Props){
  const {play}=useSound()
  const np=config.mode==='multiplayer'?2:2
  const names=Array.from({length:np},(_,i)=>config.players[i]||(i===1?'Bot':`P${i+1}`))
  const [pos,setPos]=useState(Array(np).fill(0))
  const [turn,setTurn]=useState(0)
  const [dice,setDice]=useState(0)
  const [rolling,setRolling]=useState(false)
  const [msg,setMsg]=useState(`${names[0]}'s turn — Roll!`)
  const [done,setDone]=useState(false)
  const [animCell,setAnimCell]=useState(-1)
  const isBot=config.mode==='vs-bot'

  const doRoll=()=>{
    if(rolling||done) return
    setRolling(true); play('dice')
    const frames=[...Array(8)].map((_,i)=>Math.floor(Math.random()*6)+1)
    let fi=0
    const anim=setInterval(()=>{
      setDice(frames[fi++])
      if(fi>=frames.length){
        clearInterval(anim)
        const d=frames[frames.length-1]
        let newPos=pos[turn]+d
        let info=''

        if(newPos>MAX_SQ){ newPos=pos[turn]; info='Too high! Stay put.'; play('error') }
        else if(newPos===MAX_SQ){
          const np2=[...pos]; np2[turn]=newPos; setPos(np2)
          setDone(true); play('win')
          setTimeout(()=>onGameOver({winner:names[turn],score:newPos,gameId:'snakeladders',difficulty:config.difficulty}),600)
          setRolling(false); return
        } else if(SNAKES[newPos]){
          const dest=SNAKES[newPos]; info=`🐍 Snake! ${newPos}→${dest}`; newPos=dest; play('error')
        } else if(LADDERS[newPos]){
          const dest=LADDERS[newPos]; info=`🪜 Ladder! ${newPos}→${dest}`; newPos=dest; play('capture')
        } else { play('move') }

        setAnimCell(newPos)
        const np2=[...pos]; np2[turn]=newPos; setPos(np2)
        const nextTurn=(turn+1)%np2.length
        setTurn(nextTurn)
        setMsg(info||`${names[nextTurn]}'s turn!`)
        setRolling(false)
        setTimeout(()=>setAnimCell(-1),800)
      }
    },80)
  }

  // Bot
  useEffect(()=>{
    if(!isBot||turn!==1||done) return
    const t=setTimeout(doRoll,600)
    return()=>clearTimeout(t)
  },[turn,isBot,done])

  // Build board cells 100..1
  const cells=Array.from({length:100},(_,i)=>{
    const sq=100-i
    const {row,col}=getBoardPos(sq)
    const players=pos.map((p,pi)=>p===sq?P_EMOJI[pi]:null).filter(Boolean)
    const hasSnake=!!SNAKES[sq]
    const hasLadder=!!LADDERS[sq]
    return{sq,row,col,players,hasSnake,hasLadder}
  })

  const DICE_FACES=['','⚀','⚁','⚂','⚃','⚄','⚅']

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      <div className="flex items-center justify-between w-full max-w-xl mb-3">
        <button onClick={onExit} className="game-btn-ghost text-sm py-2 px-4">← Exit</button>
        <h2 className="font-display text-xl text-white">🐍 Snake & Ladders</h2>
        <div className="text-sm text-white/50">{names[turn]}'s turn</div>
      </div>

      <div className={`text-sm mb-3 px-4 py-1.5 rounded-full ${P_BG[turn]} ${P_TEXT[turn]}`}>
        {msg}
      </div>

      {/* Board */}
      <div className="border border-white/10 rounded-xl overflow-hidden shadow-2xl"
           style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',maxWidth:'min(420px,95vw)'}}>
        {cells.map(({sq,players,hasSnake,hasLadder})=>(
          <div key={sq}
            className={`aspect-square flex flex-col items-center justify-center text-center
              border border-white/5 relative cursor-default select-none transition-colors
              ${(Math.floor((sq-1)/10)+((sq-1)%10))%2===0?'bg-slate-800/60':'bg-slate-700/40'}
              ${hasSnake?'bg-red-900/40':''}
              ${hasLadder?'bg-green-900/40':''}
              ${animCell===sq?'ring-2 ring-inset ring-yellow-400 bg-yellow-400/20':''}`}>
            <span className="text-[7px] text-white/25 leading-none">{sq}</span>
            {hasSnake&&<span className="text-[10px] absolute top-0 right-0">🐍</span>}
            {hasLadder&&<span className="text-[10px] absolute top-0 right-0">🪜</span>}
            {players.length>0&&(
              <span className="text-[10px] leading-none">{players.join('')}</span>
            )}
          </div>
        ))}
      </div>

      {/* Players */}
      <div className="flex gap-4 mt-4">
        {names.map((n,i)=>(
          <div key={i} className={`card-glass px-4 py-2 text-center ${turn===i?'border-white/25 scale-105':''}`}>
            <div className="text-xs text-white/40">{P_EMOJI[i]} {n}</div>
            <div className={`text-xl font-bold ${P_TEXT[i]}`}>{pos[i]===0?'Start':pos[i]}</div>
          </div>
        ))}
      </div>

      {(!isBot||turn===0)&&!done&&(
        <button onClick={doRoll} disabled={rolling} className="game-btn-gold mt-5 px-8 py-4 text-xl">
          {rolling?'🎲':'🎲 Roll!'} {dice>0&&!rolling?DICE_FACES[dice]:''}
        </button>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'

// Pallanguzhi / Katta Mane — 2 rows × 7 pits + stores
// Each pit starts with 6 seeds. Players sow anti-clockwise.
// Capture: if last seed falls in empty pit opposite a non-empty opponent pit.

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

const PITS      = 7
const INIT_SEEDS = 6

function initBoard(){
  // pits[0][0..6] = player 0 (bottom row), pits[1][0..6] = player 1 (top row)
  return [Array(PITS).fill(INIT_SEEDS), Array(PITS).fill(INIT_SEEDS)]
}

export default function KattaMane({config,onGameOver,onExit}:Props){
  const {play}=useSound()
  const [pits, setPits]     = useState(initBoard)
  const [store,setStore]    = useState([0,0])
  const [turn, setTurn]     = useState(0)
  const [done, setDone]     = useState(false)
  const [last, setLast]     = useState(-1)
  const [msg,  setMsg]      = useState("Player 1's turn — pick a pit")
  const isBot = config.mode==='vs-bot'
  const p0=config.players[0], p1=config.players[1]||'Bot'
  const names=[p0,p1]

  const sow=(player:number,pit:number)=>{
    if(done||player!==turn) return
    if(pits[player][pit]===0){ play('error'); return }

    const np=pits.map(r=>[...r])
    const ns=[...store]
    let seeds=np[player][pit]
    np[player][pit]=0
    let row=player, col=pit
    // sow anti-clockwise: same row right→wrap to opposite row right-to-left→repeat
    while(seeds>0){
      if(row===player){
        col++
        if(col>=PITS){ row=1-player; col=PITS-1 }
      } else {
        col--
        if(col<0){ row=player; col=0 }
      }
      np[row][col]++; seeds--
    }

    // capture: last seed in empty pit on own row & opposite has seeds
    const opp=1-player
    if(row===player&&np[row][col]===1&&np[opp][col]>0){
      ns[player]+=np[opp][col]+1
      np[opp][col]=0; np[player][col]=0
      play('capture')
    } else { play('move') }

    // check end
    const p0Empty=np[0].every(s=>s===0)
    const p1Empty=np[1].every(s=>s===0)
    if(p0Empty||p1Empty){
      ns[0]+=np[0].reduce((a,b)=>a+b,0)
      ns[1]+=np[1].reduce((a,b)=>a+b,0)
      setPits([[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]])
      setStore(ns)
      setDone(true)
      const winner=ns[0]>=ns[1]?names[0]:names[1]
      play('win')
      setTimeout(()=>onGameOver({winner,score:Math.max(...ns),gameId:'kattamane',difficulty:config.difficulty}),700)
      return
    }

    const nextTurn=1-turn
    setPits(np); setStore(ns); setTurn(nextTurn); setLast(pit)
    setMsg(`${names[nextTurn]}'s turn`)
  }

  // Bot
  useEffect(()=>{
    if(!isBot||turn!==1||done) return
    const valid=pits[1].map((_,i)=>i).filter(i=>pits[1][i]>0)
    if(!valid.length) return
    const t=setTimeout(()=>sow(1,valid[Math.floor(Math.random()*valid.length)]),500)
    return()=>clearTimeout(t)
  },[turn,isBot,done,pits])

  const pitBtn=(player:number,pit:number)=>{
    const seeds=pits[player][pit]
    const active=player===turn&&!done&&seeds>0&&!(isBot&&turn===1)
    return(
      <button key={pit}
        onClick={()=>sow(player,pit)}
        className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex flex-col items-center justify-center
          text-sm font-bold select-none transition-all
          ${active?'bg-brand-600/40 border-2 border-brand-400 hover:bg-brand-500/50 cursor-pointer active:scale-95':'bg-white/5 border border-white/10 cursor-default'}
          ${last===pit&&player===1-turn?'border-gold-400/50':''}`}>
        <div className="flex flex-wrap gap-0.5 justify-center items-center w-10 h-8">
          {Array.from({length:Math.min(seeds,9)},(_,i)=>(
            <span key={i} className={`text-[8px] ${player===0?'text-red-300':'text-blue-300'}`}>●</span>
          ))}
          {seeds>9&&<span className="text-[8px] text-white/40">+{seeds-9}</span>}
        </div>
        <span className={`text-xs ${seeds>0?'text-white/70':'text-white/20'}`}>{seeds}</span>
      </button>
    )
  }

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      <div className="flex items-center justify-between w-full max-w-xl mb-4">
        <button onClick={onExit} className="game-btn-ghost text-sm py-2 px-4">← Exit</button>
        <h2 className="font-display text-lg text-white">🪨 Katta Mane</h2>
        <div className="text-xs text-white/40">Pallanguzhi</div>
      </div>

      <div className={`text-sm mb-6 px-4 py-1.5 rounded-full font-medium
        ${turn===0?'bg-red-500/20 text-red-300':'bg-blue-500/20 text-blue-300'}`}>
        {msg}
      </div>

      <div className="card-glass p-5 w-full max-w-xl">
        {/* Player 1 (top, reversed) */}
        <div className="flex items-center gap-3 mb-3">
          <div className="card-glass px-3 py-2 text-center min-w-[60px]">
            <div className="text-xs text-white/40">{p1}</div>
            <div className="text-xl font-bold text-blue-400">{store[1]}</div>
          </div>
          <div className="flex gap-1 flex-1 justify-center">
            {[...Array(PITS)].map((_,i)=>pitBtn(1, PITS-1-i))}
          </div>
        </div>

        <div className="border-t border-b border-white/10 my-2 py-1 text-center text-xs text-white/30">
          ← Player 1 sows left-to-right / Player 0 sows right-to-left →
        </div>

        {/* Player 0 (bottom) */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex gap-1 flex-1 justify-center">
            {[...Array(PITS)].map((_,i)=>pitBtn(0,i))}
          </div>
          <div className="card-glass px-3 py-2 text-center min-w-[60px]">
            <div className="text-xs text-white/40">{p0}</div>
            <div className="text-xl font-bold text-red-400">{store[0]}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-white/30 text-center max-w-sm">
        Pick a pit to sow seeds anti-clockwise.<br/>
        Last seed in empty pit = capture opponent's opposite pit!
      </div>
    </div>
  )
}

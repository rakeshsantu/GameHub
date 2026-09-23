import { useState, useEffect } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'
import HowToPlay from '../components/HowToPlay'
import { HOW_TO_PLAY } from './howToPlayData'

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

const PITS=7,INIT=6

function initBoard(){return[Array(PITS).fill(INIT),Array(PITS).fill(INIT)]}

export default function KattaMane({config,onGameOver,onExit}:Props){
  const{play}=useSound()
  const[pits,setPits]=useState(initBoard)
  const[store,setStore]=useState([0,0])
  const[turn,setTurn]=useState(0)
  const[done,setDone]=useState(false)
  const[last,setLast]=useState(-1)
  const[msg,setMsg]=useState("Player 1's turn — pick a pit")
  const[showHelp,setShowHelp]=useState(false)
  const isBot=config.mode==='vs-bot'
  const names=[config.players[0],config.players[1]||'Bot']

  const sow=(player:number,pit:number)=>{
    if(done||player!==turn)return
    if(pits[player][pit]===0){play('error');return}
    const np=pits.map(r=>[...r]);const ns=[...store]
    let seeds=np[player][pit];np[player][pit]=0;let row=player,col=pit
    while(seeds>0){
      if(row===player){col++;if(col>=PITS){row=1-player;col=PITS-1}}
      else{col--;if(col<0){row=player;col=0}}
      np[row][col]++;seeds--
    }
    if(row===player&&np[row][col]===1&&np[1-player][col]>0){
      ns[player]+=np[1-player][col]+1;np[1-player][col]=0;np[player][col]=0;play('capture')
    } else play('move')
    const p0E=np[0].every(s=>s===0),p1E=np[1].every(s=>s===0)
    if(p0E||p1E){
      ns[0]+=np[0].reduce((a,b)=>a+b,0);ns[1]+=np[1].reduce((a,b)=>a+b,0)
      setPits([[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]);setStore(ns);setDone(true)
      const winner=ns[0]>=ns[1]?names[0]:names[1];play('win')
      setTimeout(()=>onGameOver({winner,score:Math.max(...ns),gameId:'kattamane',difficulty:config.difficulty}),700);return
    }
    const next=1-turn;setPits(np);setStore(ns);setTurn(next);setLast(pit);setMsg(`${names[next]}'s turn`)
  }

  useEffect(()=>{
    if(!isBot||turn!==1||done)return
    const valid=pits[1].map((_,i)=>i).filter(i=>pits[1][i]>0)
    if(!valid.length)return
    const t=setTimeout(()=>sow(1,valid[Math.floor(Math.random()*valid.length)]),500)
    return()=>clearTimeout(t)
  },[turn,isBot,done,pits])

  const pitBtn=(player:number,pit:number)=>{
    const seeds=pits[player][pit]
    const active=player===turn&&!done&&seeds>0&&!(isBot&&turn===1)
    return(
      <button key={pit} onClick={()=>sow(player,pit)}
        className="w-14 h-14 md:w-16 md:h-16 rounded-xl flex flex-col items-center justify-center text-sm font-bold select-none transition-all"
        style={{
          background:active?'rgba(155,42,68,0.3)':'rgba(26,12,6,0.7)',
          border:`2px solid ${active?'rgba(212,168,67,0.6)':last===pit&&player===1-turn?'rgba(212,168,67,0.3)':'rgba(212,168,67,0.15)'}`,
          cursor:active?'pointer':'default',
          transform:active?'scale(1.05)':'scale(1)',
        }}>
        <div className="flex flex-wrap gap-0.5 justify-center items-center w-10 h-8">
          {Array.from({length:Math.min(seeds,9)},(_,i)=>(
            <span key={i} style={{fontSize:'7px',color:player===0?'#fca5a5':'#93c5fd'}}>●</span>
          ))}
          {seeds>9&&<span style={{fontSize:'7px',color:'rgba(245,240,232,0.4)'}}>+{seeds-9}</span>}
        </div>
        <span style={{fontSize:'11px',color:seeds>0?'rgba(245,240,232,0.6)':'rgba(245,240,232,0.2)',fontFamily:'Cinzel,serif'}}>{seeds}</span>
      </button>
    )
  }

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      {showHelp&&<HowToPlay data={HOW_TO_PLAY.kattamane} onClose={()=>setShowHelp(false)}/>}
      <div className="flex items-center justify-between w-full max-w-xl mb-4">
        <button onClick={onExit} className="btn-ghost text-xs py-1.5 px-3">← Exit</button>
        <h2 style={{fontFamily:'Cinzel Decorative,serif',color:'#d4a843',fontSize:'1rem'}}>🪨 Katta Mane</h2>
        <button onClick={()=>setShowHelp(true)} className="btn-ghost text-xs py-1.5 px-3">📜 How to Play</button>
      </div>
      <div className="text-sm mb-5 px-4 py-1.5 rounded-full"
           style={{fontFamily:'Cinzel,serif',background:turn===0?'rgba(239,68,68,0.15)':'rgba(59,130,246,0.15)',border:'1px solid rgba(212,168,67,0.25)',color:'rgba(245,240,232,0.8)'}}>
        {msg}
      </div>
      <div className="rounded-xl p-5 w-full max-w-xl"
           style={{background:'rgba(26,12,6,0.85)',border:'1px solid rgba(212,168,67,0.3)'}}>
        {/* Player 1 row (top, reversed) */}
        <div className="flex items-center gap-3 mb-3">
          <div className="rounded-xl px-3 py-2 text-center min-w-[60px]"
               style={{background:'rgba(42,21,9,0.8)',border:'1px solid rgba(59,130,246,0.3)'}}>
            <div style={{fontSize:'10px',color:'rgba(212,168,67,0.45)',fontFamily:'Cinzel,serif'}}>{names[1]}</div>
            <div className="text-xl font-bold" style={{color:'#93c5fd',fontFamily:'Cinzel Decorative,serif'}}>{store[1]}</div>
          </div>
          <div className="flex gap-1 flex-1 justify-center">{[...Array(PITS)].map((_,i)=>pitBtn(1,PITS-1-i))}</div>
        </div>
        <div className="border-t border-b my-2 py-1 text-center text-xs" style={{borderColor:'rgba(212,168,67,0.2)',color:'rgba(212,168,67,0.35)',fontFamily:'Cinzel,serif',letterSpacing:'0.08em'}}>
          ← PALLANGUZHI · SOW ANTI-CLOCKWISE →
        </div>
        {/* Player 0 row (bottom) */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex gap-1 flex-1 justify-center">{[...Array(PITS)].map((_,i)=>pitBtn(0,i))}</div>
          <div className="rounded-xl px-3 py-2 text-center min-w-[60px]"
               style={{background:'rgba(42,21,9,0.8)',border:'1px solid rgba(239,68,68,0.3)'}}>
            <div style={{fontSize:'10px',color:'rgba(212,168,67,0.45)',fontFamily:'Cinzel,serif'}}>{names[0]}</div>
            <div className="text-xl font-bold" style={{color:'#fca5a5',fontFamily:'Cinzel Decorative,serif'}}>{store[0]}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

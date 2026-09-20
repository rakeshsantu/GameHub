import { useState, useEffect, useRef } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

// Simplified 2-player Ludo: each player has 4 tokens on a 52-step track
// Home column = steps 53-58, HOME = 59
// Enter with dice=6, move normally, capture on shared squares, safe squares every 13

const TRACK_LEN = 52
const HOME_COL  = 6
const HOME_POS  = TRACK_LEN + HOME_COL
const TOKENS    = 4
const SAFE_EVERY= 13

const P_COLORS  = ['#ef4444','#3b82f6']
const P_EMOJI   = ['🔴','🔵']
const P_TEXT    = ['text-red-400','text-blue-400']
const P_BG      = ['bg-red-500/20','bg-blue-500/20']

// Entry squares on the 52-track (offset per player)
const ENTRY = [0, 26]

function isHome(pos:number){ return pos>=HOME_POS }
function isSafe(pos:number){ return pos%SAFE_EVERY===0||pos===0 }

interface GS {
  pos:   number[][] // [player][token]  -1=yard
  turn:  number
  dice:  number
  phase: 'roll'|'move'
  extra: boolean // extra turn on 6 or home
}

function initGS():GS{
  return{ pos:[Array(TOKENS).fill(-1),Array(TOKENS).fill(-1)], turn:0, dice:0, phase:'roll', extra:false }
}

export default function Ludo({config,onGameOver,onExit}:Props){
  const {play}=useSound()
  const [gs,setGs]=useState<GS>(initGS)
  const [msg,setMsg]=useState('Roll the dice!')
  const [done,setDone]=useState(false)
  const [rolling,setRolling]=useState(false)
  const isBot=config.mode==='vs-bot'
  const names=[config.players[0],config.players[1]||'Bot']

  const canMove=(g:GS,p:number,t:number):boolean=>{
    const pos=g.pos[p][t]
    if(pos===-1) return g.dice===6
    if(isHome(pos)) return false
    const newPos=pos+g.dice
    const global=((pos+ENTRY[p])%TRACK_LEN)
    // entering home column
    if(pos>=TRACK_LEN-HOME_COL&&pos+g.dice>TRACK_LEN+HOME_COL) return false
    return true
  }

  const moveToken=(tokenIdx:number)=>{
    if(done||gs.phase!=='move') return
    const p=gs.turn
    if(!canMove(gs,p,tokenIdx)){ play('error'); return }

    const ng:GS={...gs,pos:gs.pos.map(a=>[...a])}
    const pos=ng.pos[p][tokenIdx]
    let newPos:number
    if(pos===-1){ newPos=1 }
    else { newPos=pos+gs.dice }

    // cap at home
    if(newPos>HOME_POS) return
    ng.pos[p][tokenIdx]=newPos
    play('move')

    // capture
    const opponent=1-p
    if(!isSafe((newPos+ENTRY[p])%TRACK_LEN)&&newPos<TRACK_LEN){
      for(let i=0;i<TOKENS;i++){
        const oPos=ng.pos[opponent][i]
        if(oPos>0&&!isHome(oPos)){
          // convert to global for comparison
          const oppGlobal=(oPos+ENTRY[opponent])%TRACK_LEN
          const myGlobal=(newPos+ENTRY[p])%TRACK_LEN
          if(oppGlobal===myGlobal){ ng.pos[opponent][i]=-1; play('capture'); setMsg(`Captured!`) }
        }
      }
    }

    // win check
    if(ng.pos[p].every(pos=>pos===HOME_POS)){
      setGs(ng); setDone(true); play('win')
      setTimeout(()=>onGameOver({winner:names[p],gameId:'ludo',difficulty:config.difficulty}),600)
      return
    }

    const gotHome=isHome(newPos)
    const extra=gs.dice===6||gotHome
    const nextTurn=extra?p:(1-p)
    ng.turn=nextTurn; ng.phase='roll'; ng.dice=0; ng.extra=extra
    setGs(ng)
    setMsg(extra?`${names[p]} goes again!`:`${names[nextTurn]}'s turn!`)
  }

  const doRoll=()=>{
    if(gs.phase!=='roll'||rolling||done) return
    setRolling(true); play('dice')
    setTimeout(()=>{
      const d=Math.floor(Math.random()*6)+1
      const ng={...gs,dice:d,phase:'move' as const}
      const p=ng.turn
      const hasMoves=ng.pos[p].some((_,i)=>canMove(ng,p,i))
      if(!hasMoves){
        const ng2:GS={...ng,phase:'roll' as GS['phase']}
        if(d===6){ setMsg('Rolled 6 but no valid move — roll again.'); setGs(ng2) }
        else{ setMsg(`Rolled ${d} — no valid moves.`); setGs({...ng2,turn:1-p,dice:0}) }
      } else {
        setGs(ng); setMsg(`Rolled ${d}! Select a token.`)
      }
      setRolling(false)
    },500)
  }

  // Bot
  useEffect(()=>{
    if(!isBot||gs.turn!==1||done) return
    if(gs.phase==='roll'){ const t=setTimeout(doRoll,400); return()=>clearTimeout(t) }
    if(gs.phase==='move'){
      const t=setTimeout(()=>{
        const movable=gs.pos[1].map((_,i)=>i).filter(i=>canMove(gs,1,i))
        if(movable.length) moveToken(movable[Math.floor(Math.random()*movable.length)])
      },600)
      return()=>clearTimeout(t)
    }
  },[gs,isBot,done])

  const posLabel=(pos:number)=>{
    if(pos===-1) return '🏠'
    if(isHome(pos)) return '🏆'
    return `${pos}`
  }

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      <div className="flex items-center justify-between w-full max-w-lg mb-4">
        <button onClick={onExit} className="game-btn-ghost text-sm py-2 px-4">← Exit</button>
        <h2 className="font-display text-xl text-white">🎮 Ludo</h2>
        <div className="text-sm text-white/50">{names[gs.turn]}'s turn</div>
      </div>

      <div className={`text-sm mb-4 px-4 py-1.5 rounded-full ${P_BG[gs.turn]} ${P_TEXT[gs.turn]}`}>
        {msg}
      </div>

      {/* Visual board — simplified 52-cell strip showing positions */}
      <div className="card-glass p-3 w-full max-w-lg mb-4">
        <div className="text-xs text-white/30 mb-2">Track (0–52 + home)</div>
        <div className="flex flex-wrap gap-1">
          {Array.from({length:26},(_,i)=>{
            const tokens:string[]=[]
            for(let p=0;p<2;p++) for(let t=0;t<TOKENS;t++) if(gs.pos[p][t]===i+1) tokens.push(P_EMOJI[p])
            return(
              <div key={i} className={`w-6 h-6 rounded text-[9px] flex items-center justify-center border
                ${isSafe(i+1)?'border-gold-400/40 bg-gold-400/10':'border-white/10 bg-white/5'}`}>
                {tokens.length?tokens.join(''):<span className="text-white/20">{i+1}</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Player panels */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
        {[0,1].map(p=>(
          <div key={p} className={`card-glass p-3 ${gs.turn===p?'border-white/25':''}`}>
            <div className={`text-sm font-medium mb-2 ${P_TEXT[p]}`}>{P_EMOJI[p]} {names[p]}</div>
            <div className="flex gap-1 flex-wrap">
              {gs.pos[p].map((pos,i)=>(
                <button key={i}
                  onClick={()=>p===gs.turn&&gs.phase==='move'&&moveToken(i)}
                  className={`w-12 h-12 rounded-xl text-xs font-bold flex flex-col items-center justify-center
                    select-none transition-all
                    ${isHome(pos)?'bg-gold-400/20 text-gold-400 border border-gold-400/30':'bg-white/5 border border-white/10 text-white/70'}
                    ${gs.turn===p&&gs.phase==='move'&&canMove(gs,p,i)?'ring-2 ring-yellow-400 cursor-pointer scale-110':'cursor-default'}`}>
                  <span>{P_EMOJI[p]}</span>
                  <span className="text-[10px]">{posLabel(pos)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {gs.phase==='roll'&&gs.turn===0&&!done&&(
        <button onClick={doRoll} disabled={rolling} className="game-btn-gold mt-6 px-8 py-4 text-lg">
          {rolling?'🎲 Rolling…':'🎲 Roll Dice!'}
        </button>
      )}
      {gs.dice>0&&(
        <div className="mt-3 text-5xl font-bold text-gold-400">
          {['','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'][gs.dice]}
        </div>
      )}
    </div>
  )
}

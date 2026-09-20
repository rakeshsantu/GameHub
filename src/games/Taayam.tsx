import { useState, useEffect } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'

// Taayam — traditional Kerala dice race game
// 2-4 players, 3 pieces each, track of 40 squares, 4 cowries (0-4)
// Enter with roll 1 or 4; safe squares every 5 steps; capture by landing on opponent

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

const TRACK     = 40
const HOME      = TRACK
const PIECES    = 3
const SAFE_SQ   = new Set([0,5,10,15,20,25,30,35,40])
const P_COLORS  = ['bg-red-500','bg-blue-500','bg-green-500','bg-yellow-500']
const P_TEXT    = ['text-red-400','text-blue-400','text-green-400','text-yellow-400']
const P_EMOJI   = ['🔴','🔵','🟢','🟡']

function rollCowries():number{
  const faces=Array.from({length:4},()=>Math.random()<0.5?1:0) as number[]
  const r=faces.reduce((a:number,b:number)=>a+b,0)
  return r===0?4:r===4?8:r
}

interface GS {
  pos:     number[][]  // [player][piece]
  entered: boolean[][] // [player][piece]
  turn:    number
  roll:    number
  phase:   'roll'|'move'
}

function initGS(np:number):GS{
  return{
    pos:     Array.from({length:np},()=>Array(PIECES).fill(0)),
    entered: Array.from({length:np},()=>Array(PIECES).fill(false)),
    turn:0, roll:0, phase:'roll'
  }
}

export default function Taayam({config,onGameOver,onExit}:Props){
  const {play}=useSound()
  const np=config.mode==='multiplayer'?2:2
  const [gs,setGs]=useState<GS>(()=>initGS(np))
  const [msg,setMsg]=useState('Roll the cowries!')
  const [done,setDone]=useState(false)
  const [rolling,setRolling]=useState(false)
  const isBot=config.mode==='vs-bot'
  const names=Array.from({length:np},(_,i)=>config.players[i]||(i===1&&isBot?'Bot':`P${i+1}`))

  const canMove=(g:GS,p:number,i:number)=>{
    const pos=g.pos[p][i]
    if(pos===HOME) return false
    if(!g.entered[p][i]) return g.roll===1||g.roll===4
    return pos+g.roll<=HOME
  }

  const movePiece=(pieceIdx:number)=>{
    if(done||gs.phase!=='move') return
    const t=gs.turn
    if(!canMove(gs,t,pieceIdx)){ play('error'); return }

    const ng:GS={...gs,pos:gs.pos.map(a=>[...a]),entered:gs.entered.map(a=>[...a])}
    if(!ng.entered[t][pieceIdx]){
      ng.entered[t][pieceIdx]=true; ng.pos[t][pieceIdx]=ng.roll
    } else { ng.pos[t][pieceIdx]+=ng.roll; if(ng.pos[t][pieceIdx]>HOME)ng.pos[t][pieceIdx]=HOME }

    // capture
    const sq=ng.pos[t][pieceIdx]
    if(!SAFE_SQ.has(sq)){
      for(let p2=0;p2<np;p2++){
        if(p2===t) continue
        for(let j=0;j<PIECES;j++){
          if(ng.pos[p2][j]===sq&&ng.entered[p2][j]&&sq!==HOME){
            ng.pos[p2][j]=0; ng.entered[p2][j]=false
            play('capture'); setMsg(`${names[t]} captured ${names[p2]}'s piece!`)
          }
        }
      }
    }
    play('move')

    if(ng.pos[t].every(p=>p===HOME)){
      setGs(ng); setDone(true); play('win')
      setTimeout(()=>onGameOver({winner:names[t],gameId:'taayam',difficulty:config.difficulty}),600)
      return
    }

    ng.turn=(ng.turn+1)%np; ng.phase='roll'; ng.roll=0
    setGs(ng); setMsg(`${names[ng.turn]}'s turn — Roll!`)
  }

  const doRoll=()=>{
    if(gs.phase!=='roll'||rolling||done) return
    setRolling(true); play('dice')
    setTimeout(()=>{
      const r=rollCowries()
      const ng={...gs,roll:r,phase:'move' as const}
      const hasMoves=ng.pos[ng.turn].some((_,i)=>canMove(ng,ng.turn,i))
      if(!hasMoves){
        setMsg(`Rolled ${r} — No valid moves!`)
        setGs({...ng,turn:(ng.turn+1)%np,phase:'roll',roll:0})
      } else {
        setGs(ng); setMsg(`Rolled ${r}! Select a piece.`)
      }
      setRolling(false)
    },500)
  }

  useEffect(()=>{
    if(!isBot||gs.turn!==1||done) return
    if(gs.phase==='roll'){const t=setTimeout(doRoll,500);return()=>clearTimeout(t)}
    if(gs.phase==='move'){
      const t=setTimeout(()=>{
        const movable=gs.pos[1].map((_,i)=>i).filter(i=>canMove(gs,1,i))
        if(movable.length) movePiece(movable[0])
      },600)
      return()=>clearTimeout(t)
    }
  },[gs,isBot,done])

  // Track visualiser (simplified strip)
  const trackCells=Array.from({length:Math.min(TRACK,20)},(_,i)=>i+1)

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      <div className="flex items-center justify-between w-full max-w-lg mb-4">
        <button onClick={onExit} className="game-btn-ghost text-sm py-2 px-4">← Exit</button>
        <h2 className="font-display text-xl text-white">🎲 Taayam</h2>
        <div className="text-sm text-white/50">{names[gs.turn]}'s turn</div>
      </div>

      <div className={`text-sm mb-4 px-4 py-1.5 rounded-full font-medium ${P_TEXT[gs.turn]} bg-white/5`}>
        {msg}
      </div>

      {/* Track strip */}
      <div className="card-glass p-3 w-full max-w-lg mb-4">
        <div className="text-xs text-white/30 mb-2 text-center">Track (1–20 shown, total 40)</div>
        <div className="flex flex-wrap gap-1 justify-center">
          {trackCells.map(sq=>{
            const pieces:string[]=[]
            for(let p=0;p<np;p++){
              for(let i=0;i<PIECES;i++){
                if(gs.pos[p][i]===sq&&gs.entered[p][i]) pieces.push(P_EMOJI[p])
              }
            }
            return(
              <div key={sq} className={`w-7 h-7 rounded-md flex flex-wrap items-center justify-center
                text-[10px] select-none border
                ${SAFE_SQ.has(sq)?'border-gold-400/40 bg-gold-400/10':'border-white/10 bg-white/5'}`}>
                {pieces.length?pieces.join(''):<span className="text-white/20">{sq}</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Player panels */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
        {names.map((name,pi)=>(
          <div key={pi} className={`card-glass p-3 ${gs.turn===pi?'border-white/30':''}`}>
            <div className={`text-sm font-medium mb-2 ${P_TEXT[pi]}`}>{P_EMOJI[pi]} {name}</div>
            <div className="flex gap-2">
              {gs.pos[pi].map((pos,i)=>(
                <button key={i}
                  onClick={()=>pi===gs.turn&&gs.phase==='move'&&movePiece(i)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all select-none
                    ${pos===HOME?'bg-gold-400/20 text-gold-400':'bg-white/5 text-white/70'}
                    ${gs.turn===pi&&gs.phase==='move'&&canMove(gs,pi,i)?'ring-2 ring-yellow-400 cursor-pointer scale-105':'cursor-default'}`}>
                  {pos===HOME?'🏠':!gs.entered[pi][i]?P_EMOJI[pi]:`${P_EMOJI[pi]} ${pos}`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {gs.phase==='roll'&&gs.turn===0&&(
        <button onClick={doRoll} disabled={rolling} className="game-btn-gold mt-6 px-8 py-4 text-lg">
          {rolling?'🎲 Rolling…':'🎲 Roll Cowries!'}
        </button>
      )}
      {gs.roll>0&&(
        <div className="mt-3 text-3xl font-bold text-gold-400">
          {Array.from({length:4},(_,i)=><span key={i}>{i<Math.min(gs.roll,4)?'🐚':'○'}</span>)}
          <span className="text-xl ml-2">= {gs.roll}</span>
        </div>
      )}
    </div>
  )
}

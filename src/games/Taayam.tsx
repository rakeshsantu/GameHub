import { useState, useEffect } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'
import HowToPlay from '../components/HowToPlay'
import { HOW_TO_PLAY } from './howToPlayData'

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

const TRACK=40,HOME=TRACK,PIECES=3,SAFE=new Set([0,5,10,15,20,25,30,35,40])
const P_EMOJI=['🔴','🔵'],P_COLORS=['text-red-400','text-blue-400']
const P_BG=['rgba(239,68,68,0.15)','rgba(59,130,246,0.15)']

function rollCowries():number{
  const f=Array.from({length:4},()=>Math.random()<0.5?1:0) as number[]
  const r=f.reduce((a:number,b:number)=>a+b,0)
  return r===0?4:r===4?8:r
}

interface GS{pos:number[][];entered:boolean[][];turn:number;roll:number;phase:'roll'|'move'}

function initGS(np:number):GS{
  return{pos:Array.from({length:np},()=>Array(PIECES).fill(0)),entered:Array.from({length:np},()=>Array(PIECES).fill(false)),turn:0,roll:0,phase:'roll'}
}

export default function Taayam({config,onGameOver,onExit}:Props){
  const{play}=useSound()
  const np=2
  const[gs,setGs]=useState<GS>(()=>initGS(np))
  const[msg,setMsg]=useState('Roll the cowries!')
  const[done,setDone]=useState(false)
  const[rolling,setRolling]=useState(false)
  const[showHelp,setShowHelp]=useState(false)
  const isBot=config.mode==='vs-bot'
  const names=Array.from({length:np},(_,i)=>config.players[i]||(i===1&&isBot?'Bot':`P${i+1}`))

  const canMove=(g:GS,p:number,i:number)=>{
    const pos=g.pos[p][i];if(pos===HOME)return false
    if(!g.entered[p][i])return g.roll===1||g.roll===4
    return pos+g.roll<=HOME
  }

  const movePiece=(pieceIdx:number)=>{
    if(done||gs.phase!=='move')return
    const t=gs.turn;if(!canMove(gs,t,pieceIdx)){play('error');return}
    const ng:GS={...gs,pos:gs.pos.map(a=>[...a]),entered:gs.entered.map(a=>[...a])}
    if(!ng.entered[t][pieceIdx]){ng.entered[t][pieceIdx]=true;ng.pos[t][pieceIdx]=ng.roll}
    else{ng.pos[t][pieceIdx]+=ng.roll;if(ng.pos[t][pieceIdx]>HOME)ng.pos[t][pieceIdx]=HOME}
    const sq=ng.pos[t][pieceIdx]
    if(!SAFE.has(sq)){
      for(let p2=0;p2<np;p2++){
        if(p2===t)continue
        for(let j=0;j<PIECES;j++){
          if(ng.pos[p2][j]===sq&&ng.entered[p2][j]&&sq!==HOME){ng.pos[p2][j]=0;ng.entered[p2][j]=false;play('capture');setMsg(`Captured!`)}
        }
      }
    }
    play('move')
    if(ng.pos[t].every(p=>p===HOME)){setGs(ng);setDone(true);play('win');setTimeout(()=>onGameOver({winner:names[t],gameId:'taayam',difficulty:config.difficulty}),600);return}
    ng.turn=(ng.turn+1)%np;ng.phase='roll';ng.roll=0
    setGs(ng);setMsg(`${names[ng.turn]}'s turn — Roll!`)
  }

  const doRoll=()=>{
    if(gs.phase!=='roll'||rolling||done)return
    setRolling(true);play('dice')
    setTimeout(()=>{
      const r=rollCowries()
      const ng:GS={...gs,roll:r,phase:'move'}
      const has=ng.pos[ng.turn].some((_,i)=>canMove(ng,ng.turn,i))
      if(!has){setMsg(`Rolled ${r} — no valid moves!`);setGs({...ng,turn:(ng.turn+1)%np,phase:'roll',roll:0})}
      else{setGs(ng);setMsg(`Rolled ${r}! Select a piece.`)}
      setRolling(false)
    },500)
  }

  useEffect(()=>{
    if(!isBot||gs.turn!==1||done)return
    if(gs.phase==='roll'){const t=setTimeout(doRoll,500);return()=>clearTimeout(t)}
    if(gs.phase==='move'){const t=setTimeout(()=>{const m=gs.pos[1].map((_,i)=>i).filter(i=>canMove(gs,1,i));if(m.length)movePiece(m[0])},600);return()=>clearTimeout(t)}
  },[gs,isBot,done])

  const trackCells=Array.from({length:20},(_,i)=>i+1)

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      {showHelp&&<HowToPlay data={HOW_TO_PLAY.taayam} onClose={()=>setShowHelp(false)}/>}
      <div className="flex items-center justify-between w-full max-w-lg mb-4">
        <button onClick={onExit} className="btn-ghost text-xs py-1.5 px-3">← Exit</button>
        <h2 style={{fontFamily:'Cinzel Decorative,serif',color:'#d4a843',fontSize:'1rem'}}>🎲 Taayam</h2>
        <button onClick={()=>setShowHelp(true)} className="btn-ghost text-xs py-1.5 px-3">📜 How to Play</button>
      </div>
      <div className="text-sm mb-4 px-4 py-1.5 rounded-full"
           style={{fontFamily:'Cinzel,serif',background:P_BG[gs.turn],border:'1px solid rgba(212,168,67,0.25)',color:'rgba(245,240,232,0.8)'}}>
        {msg}
      </div>
      {/* Mini track */}
      <div className="rounded-xl p-3 w-full max-w-lg mb-4"
           style={{background:'rgba(26,12,6,0.8)',border:'1px solid rgba(212,168,67,0.2)'}}>
        <div className="text-xs mb-2 text-center" style={{color:'rgba(212,168,67,0.35)',fontFamily:'Cinzel,serif',letterSpacing:'0.08em'}}>TRACK (1–20 SHOWN)</div>
        <div className="flex flex-wrap gap-1 justify-center">
          {trackCells.map(sq=>{
            const tokens:string[]=[]
            for(let p=0;p<np;p++)for(let i=0;i<PIECES;i++)if(gs.pos[p][i]===sq&&gs.entered[p][i])tokens.push(P_EMOJI[p])
            return(
              <div key={sq} className="w-7 h-7 rounded flex items-center justify-center select-none"
                   style={{background:SAFE.has(sq)?'rgba(212,168,67,0.12)':'rgba(42,21,9,0.7)',border:`1px solid ${SAFE.has(sq)?'rgba(212,168,67,0.35)':'rgba(212,168,67,0.1)'}`,fontSize:'10px'}}>
                {tokens.length?tokens.join(''):<span style={{color:'rgba(212,168,67,0.2)',fontSize:'8px',fontFamily:'Cinzel,serif'}}>{sq}</span>}
              </div>
            )
          })}
        </div>
      </div>
      {/* Player panels */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
        {names.map((name,pi)=>(
          <div key={pi} className="rounded-xl p-3"
               style={{background:'rgba(26,12,6,0.8)',border:`1px solid ${gs.turn===pi?'rgba(212,168,67,0.4)':'rgba(212,168,67,0.15)'}`}}>
            <div className={`text-sm font-semibold mb-2 ${P_COLORS[pi]}`} style={{fontFamily:'Cinzel,serif'}}>{P_EMOJI[pi]} {name}</div>
            <div className="flex gap-1">
              {gs.pos[pi].map((pos,i)=>(
                <button key={i} onClick={()=>pi===gs.turn&&gs.phase==='move'&&movePiece(i)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold transition-all select-none"
                  style={{background:pos===HOME?'rgba(251,191,36,0.2)':'rgba(42,21,9,0.7)',border:`1px solid ${gs.turn===pi&&gs.phase==='move'&&canMove(gs,pi,i)?'#fbbf24':'rgba(212,168,67,0.2)'}`,color:pos===HOME?'#fbbf24':'rgba(245,240,232,0.7)',transform:gs.turn===pi&&gs.phase==='move'&&canMove(gs,pi,i)?'scale(1.08)':'scale(1)',cursor:gs.turn===pi&&gs.phase==='move'&&canMove(gs,pi,i)?'pointer':'default'}}>
                  {pos===HOME?'🏠':!gs.entered[pi][i]?P_EMOJI[pi]:`${P_EMOJI[pi]}${pos}`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {gs.phase==='roll'&&gs.turn===0&&(
        <button onClick={doRoll} disabled={rolling} className="btn-gold mt-6 px-8 py-4 text-lg">
          {rolling?'🎲 Rolling…':'🎲 Roll Cowries!'}
        </button>
      )}
      {gs.roll>0&&(
        <div className="mt-3 text-3xl font-bold" style={{color:'#fbbf24'}}>
          {Array.from({length:4},(_,i)=><span key={i}>{i<Math.min(gs.roll,4)?'🐚':'○'}</span>)}
          <span className="text-xl ml-2">= {gs.roll}</span>
        </div>
      )}
    </div>
  )
}

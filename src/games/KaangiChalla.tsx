import { useState, useRef, useEffect } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'
import HowToPlay from '../components/HowToPlay'
import { HOW_TO_PLAY } from './howToPlayData'

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

const W=400,H=400,CENTER_X=W/2,CENTER_Y=H/2
const PEGS=[
  {x:200,y:200,val:10,r:14,color:'#f59e0b'},
  {x:200,y:120,val:5,r:12,color:'#60a5fa'},
  {x:280,y:200,val:5,r:12,color:'#60a5fa'},
  {x:200,y:280,val:5,r:12,color:'#60a5fa'},
  {x:120,y:200,val:5,r:12,color:'#60a5fa'},
  {x:140,y:140,val:3,r:10,color:'#34d399'},
  {x:260,y:140,val:3,r:10,color:'#34d399'},
  {x:260,y:260,val:3,r:10,color:'#34d399'},
  {x:140,y:260,val:3,r:10,color:'#34d399'},
  {x:200,y:60,val:2,r:9,color:'#f87171'},
  {x:340,y:200,val:2,r:9,color:'#f87171'},
  {x:200,y:340,val:2,r:9,color:'#f87171'},
  {x:60,y:200,val:2,r:9,color:'#f87171'},
]
const ROUNDS=3,THROWS_PER_TURN=3

interface Ring{x:number;y:number;r:number;alpha:number}

export default function KaangiChalla({config,onGameOver,onExit}:Props){
  const{play}=useSound()
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const[scores,setScores]=useState([0,0])
  const[round,setRound]=useState(1)
  const[turn,setTurn]=useState(0)
  const[throwsLeft,setThrowsLeft]=useState(THROWS_PER_TURN)
  const[rings,setRings]=useState<Ring[]>([])
  const ringsRef=useRef<Ring[]>([])
  const[msg,setMsg]=useState('Click anywhere on the board to throw a ring!')
  const[done,setDone]=useState(false)
  const[showHelp,setShowHelp]=useState(false)
  const isBot=config.mode==='vs-bot'
  const names=[config.players[0],config.players[1]||'Bot']

  const getPos=(e:React.MouseEvent)=>{
    const rect=canvasRef.current!.getBoundingClientRect(),scale=W/rect.width
    return{x:(e.clientX-rect.left)*scale,y:(e.clientY-rect.top)*scale}
  }

  const throwRing=(tx:number,ty:number)=>{
    if(done)return
    let hitPeg:number|null=null,hitVal=0
    for(let i=0;i<PEGS.length;i++){if(Math.hypot(tx-PEGS[i].x,ty-PEGS[i].y)<PEGS[i].r+8){hitPeg=i;hitVal=PEGS[i].val;break}}
    ringsRef.current=[...ringsRef.current,{x:tx,y:ty,r:22,alpha:1}]
    setRings([...ringsRef.current])
    if(hitPeg!==null){play('capture');setMsg(`${names[turn]} scored ${hitVal} pts! 🎯`);setScores(prev=>{const n=[...prev];n[turn]+=hitVal;return n})}
    else{play('error');setMsg('Missed!')}
    const newT=throwsLeft-1
    if(newT>0){setThrowsLeft(newT)}
    else{
      const nextTurn=1-turn
      if(nextTurn===0){
        const nextRound=round+1
        if(nextRound>ROUNDS){
          setDone(true)
          setTimeout(()=>{
            const sc=[...scores];if(hitPeg!==null)sc[turn]+=hitVal
            const winner=sc[0]>=sc[1]?names[0]:names[1];play('win')
            onGameOver({winner,score:Math.max(...sc),gameId:'kaangichalla',difficulty:config.difficulty})
          },800);return
        }
        setRound(nextRound);setMsg(`Round ${nextRound}!`)
      } else{setMsg(`${names[nextTurn]}'s turn!`)}
      setTurn(nextTurn);setThrowsLeft(THROWS_PER_TURN);ringsRef.current=[];setRings([])
    }
  }

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const ctx=canvas.getContext('2d')!
    ctx.clearRect(0,0,W,H)
    const grad=ctx.createRadialGradient(CENTER_X,CENTER_Y,10,CENTER_X,CENTER_Y,200)
    grad.addColorStop(0,'#3a1f0d');grad.addColorStop(1,'#1a0a04')
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H)
    for(const r of[60,100,140,180]){ctx.beginPath();ctx.arc(CENTER_X,CENTER_Y,r,0,Math.PI*2);ctx.strokeStyle='rgba(212,168,67,0.1)';ctx.lineWidth=1;ctx.stroke()}
    for(const p of PEGS){
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2)
      ctx.fillStyle=p.color+'66';ctx.fill();ctx.strokeStyle=p.color;ctx.lineWidth=2;ctx.stroke()
      ctx.fillStyle='rgba(245,240,232,0.9)';ctx.font=`bold ${p.r}px Cinzel,serif`;ctx.textAlign='center';ctx.textBaseline='middle'
      ctx.fillText(String(p.val),p.x,p.y)
    }
    for(const ring of ringsRef.current){
      ctx.beginPath();ctx.arc(ring.x,ring.y,ring.r,0,Math.PI*2)
      ctx.strokeStyle=`rgba(212,168,67,${ring.alpha})`;ctx.lineWidth=4;ctx.stroke()
    }
  },[rings])

  useEffect(()=>{
    if(!isBot||turn!==1||done)return
    const acc=config.difficulty==='easy'?42:config.difficulty==='medium'?20:8
    const t=setTimeout(()=>{const peg=PEGS[Math.floor(Math.random()*PEGS.length)];throwRing(peg.x+(Math.random()-.5)*acc*2,peg.y+(Math.random()-.5)*acc*2)},700)
    return()=>clearTimeout(t)
  },[turn,throwsLeft,isBot,done])

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      {showHelp&&<HowToPlay data={HOW_TO_PLAY.kaangichalla} onClose={()=>setShowHelp(false)}/>}
      <div className="flex items-center justify-between w-full max-w-sm mb-4">
        <button onClick={onExit} className="btn-ghost text-xs py-1.5 px-3">← Exit</button>
        <h2 style={{fontFamily:'Cinzel Decorative,serif',color:'#d4a843',fontSize:'1rem'}}>💫 Kaangi Challa</h2>
        <button onClick={()=>setShowHelp(true)} className="btn-ghost text-xs py-1.5 px-3">📜 How to Play</button>
      </div>
      <div className="flex gap-2 items-center mb-3">
        <div className="text-xs px-3 py-1 rounded-full" style={{fontFamily:'Cinzel,serif',background:'rgba(42,21,9,0.7)',border:'1px solid rgba(212,168,67,0.2)',color:'rgba(212,168,67,0.6)'}}>
          Round {round}/{ROUNDS}
        </div>
        <div className="text-xs px-3 py-1 rounded-full" style={{fontFamily:'Cinzel,serif',background:'rgba(42,21,9,0.7)',border:'1px solid rgba(212,168,67,0.2)',color:'rgba(245,240,232,0.6)'}}>
          {msg}
        </div>
      </div>
      <canvas ref={canvasRef} width={W} height={H}
        className="rounded-2xl shadow-2xl cursor-crosshair"
        style={{maxWidth:'min(400px,95vw)',border:'2px solid rgba(212,168,67,0.35)'}}
        onClick={e=>{if(!done&&!(isBot&&turn===1)){const{x,y}=getPos(e);throwRing(x,y)}}}/>
      <div className="flex gap-6 mt-4">
        {names.map((n,i)=>(
          <div key={i} className="rounded-xl px-5 py-2 text-center"
               style={{background:'rgba(26,12,6,0.7)',border:`1px solid ${turn===i?'rgba(212,168,67,0.45)':'rgba(212,168,67,0.15)'}`}}>
            <div style={{fontSize:'10px',color:'rgba(212,168,67,0.45)',fontFamily:'Cinzel,serif'}}>{n}</div>
            <div className="text-2xl font-bold" style={{color:'#fbbf24',fontFamily:'Cinzel Decorative,serif'}}>{scores[i]}</div>
          </div>
        ))}
      </div>
      {!done&&<div className="mt-2 text-xs" style={{color:'rgba(212,168,67,0.35)',fontFamily:'Cinzel,serif'}}>Throws left: {throwsLeft}</div>}
    </div>
  )
}

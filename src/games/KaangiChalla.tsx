import { useState, useRef, useEffect } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'

// Kaangi Challa — Ring toss skill game
// Players take turns throwing a ring onto pegs. 3 rounds, highest score wins.
// Rendered as a canvas-based top-down peg board with animated ring throw.

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

const W=400, H=400
const CENTER_X=W/2, CENTER_Y=H/2
const PEGS=[
  {x:200,y:200,val:10,r:14,color:'#f59e0b'},  // center gold
  {x:200,y:120,val:5, r:12,color:'#60a5fa'},
  {x:280,y:200,val:5, r:12,color:'#60a5fa'},
  {x:200,y:280,val:5, r:12,color:'#60a5fa'},
  {x:120,y:200,val:5, r:12,color:'#60a5fa'},
  {x:140,y:140,val:3, r:10,color:'#34d399'},
  {x:260,y:140,val:3, r:10,color:'#34d399'},
  {x:260,y:260,val:3, r:10,color:'#34d399'},
  {x:140,y:260,val:3, r:10,color:'#34d399'},
  {x:200, y:60, val:2,r:9, color:'#f87171'},
  {x:340, y:200,val:2,r:9, color:'#f87171'},
  {x:200, y:340,val:2,r:9, color:'#f87171'},
  {x:60,  y:200,val:2,r:9, color:'#f87171'},
]
const ROUNDS=3
const THROWS_PER_TURN=3

interface Ring { x:number; y:number; r:number; landed:boolean; peg:number|null; alpha:number }

export default function KaangiChalla({config,onGameOver,onExit}:Props){
  const {play}=useSound()
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const [scores,setScores]=useState([0,0])
  const [round,setRound]=useState(1)
  const [turn,setTurn]=useState(0)
  const [throwsLeft,setThrowsLeft]=useState(THROWS_PER_TURN)
  const [rings,setRings]=useState<Ring[]>([])
  const [aiming,setAiming]=useState(false)
  const [aimPos,setAimPos]=useState({x:200,y:360})
  const [msg,setMsg]=useState('Click anywhere on the board to throw a ring!')
  const [done,setDone]=useState(false)
  const isBot=config.mode==='vs-bot'
  const names=[config.players[0],config.players[1]||'Bot']
  const rafRef=useRef(0)
  const ringsRef=useRef<Ring[]>([])

  const getPos=(e:React.MouseEvent):{x:number,y:number}=>{
    const rect=canvasRef.current!.getBoundingClientRect()
    const scale=W/rect.width
    return {x:(e.clientX-rect.left)*scale,y:(e.clientY-rect.top)*scale}
  }

  const throwRing=(tx:number,ty:number)=>{
    if(done) return
    // find if ring lands on a peg
    let hitPeg: number|null=null
    let hitVal=0
    for(let i=0;i<PEGS.length;i++){
      const p=PEGS[i]
      const dist=Math.hypot(tx-p.x,ty-p.y)
      if(dist<p.r+8){ hitPeg=i; hitVal=p.val; break }
    }

    const ring:Ring={ x:tx, y:ty, r:22, landed:true, peg:hitPeg, alpha:1 }
    ringsRef.current=[...ringsRef.current,ring]
    setRings([...ringsRef.current])

    if(hitPeg!==null){
      play('capture')
      setMsg(`${names[turn]} scored ${hitVal} points! 🎯`)
      setScores(prev=>{const n=[...prev];n[turn]+=hitVal;return n})
    } else {
      play('error')
      setMsg('Missed! Try again.')
    }

    const newThrows=throwsLeft-1
    if(newThrows>0){
      setThrowsLeft(newThrows)
    } else {
      // switch turn / round
      const nextTurn=1-turn
      if(nextTurn===0){
        const nextRound=round+1
        if(nextRound>ROUNDS){
          setDone(true)
          setTimeout(()=>{
            const winner=scores[0]>=scores[1]?names[0]:names[1]
            play('win')
            onGameOver({winner,score:Math.max(...scores),gameId:'kaangichalla',difficulty:config.difficulty})
          },800)
          return
        }
        setRound(nextRound); setMsg(`Round ${nextRound}!`)
      } else { setMsg(`${names[nextTurn]}'s turn!`) }
      setTurn(nextTurn)
      setThrowsLeft(THROWS_PER_TURN)
      ringsRef.current=[]
      setRings([])
    }
  }

  const onClick=(e:React.MouseEvent)=>{
    if(done||(isBot&&turn===1)) return
    const {x,y}=getPos(e)
    throwRing(x,y)
  }

  // Bot
  useEffect(()=>{
    if(!isBot||turn!==1||done) return
    const t=setTimeout(()=>{
      // aim at random peg with some accuracy based on difficulty
      const acc=config.difficulty==='easy'?40:config.difficulty==='medium'?20:8
      const peg=PEGS[Math.floor(Math.random()*PEGS.length)]
      const tx=peg.x+(Math.random()-0.5)*acc*2
      const ty=peg.y+(Math.random()-0.5)*acc*2
      throwRing(tx,ty)
    },700)
    return()=>clearTimeout(t)
  },[turn,throwsLeft,isBot,done])

  // Draw
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return
    const ctx=canvas.getContext('2d')!
    ctx.clearRect(0,0,W,H)

    // board bg
    const grad=ctx.createRadialGradient(CENTER_X,CENTER_Y,10,CENTER_X,CENTER_Y,200)
    grad.addColorStop(0,'#2d1b69'); grad.addColorStop(1,'#1a0a3d')
    ctx.fillStyle=grad; ctx.fillRect(0,0,W,H)

    // concentric guide circles
    for(const r of [60,100,140,180]){
      ctx.beginPath(); ctx.arc(CENTER_X,CENTER_Y,r,0,Math.PI*2)
      ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=1; ctx.stroke()
    }

    // pegs
    for(const p of PEGS){
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2)
      ctx.fillStyle=p.color+'88'; ctx.fill()
      ctx.strokeStyle=p.color; ctx.lineWidth=2; ctx.stroke()
      ctx.fillStyle='white'; ctx.font=`bold ${p.r}px Inter`
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(String(p.val),p.x,p.y)
    }

    // rings
    for(const ring of ringsRef.current){
      ctx.beginPath(); ctx.arc(ring.x,ring.y,ring.r,0,Math.PI*2)
      ctx.strokeStyle=`rgba(251,191,36,${ring.alpha})`; ctx.lineWidth=4; ctx.stroke()
      ctx.beginPath(); ctx.arc(ring.x,ring.y,ring.r-4,0,Math.PI*2)
      ctx.strokeStyle=`rgba(255,255,255,${ring.alpha*0.3})`; ctx.lineWidth=1; ctx.stroke()
    }
  },[rings])

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      <div className="flex items-center justify-between w-full max-w-sm mb-4">
        <button onClick={onExit} className="game-btn-ghost text-sm py-2 px-4">← Exit</button>
        <h2 className="font-display text-xl text-white">💫 Kaangi Challa</h2>
        <div className="text-sm text-white/50">Round {round}/{ROUNDS}</div>
      </div>

      <div className="text-sm mb-3 px-4 py-1.5 rounded-full bg-white/5 text-white/70">{msg}</div>

      <canvas ref={canvasRef} width={W} height={H}
        className="rounded-2xl border border-white/10 shadow-2xl cursor-crosshair"
        style={{maxWidth:'min(400px,95vw)'}}
        onClick={onClick}/>

      <div className="flex gap-6 mt-4">
        {names.map((n,i)=>(
          <div key={i} className={`card-glass px-5 py-2 text-center ${turn===i?'border-brand-500/40':''}`}>
            <div className="text-xs text-white/40">{n}</div>
            <div className="text-2xl font-bold text-white">{scores[i]}</div>
          </div>
        ))}
      </div>

      {!done&&<div className="mt-2 text-xs text-white/30">
        Throws left: {throwsLeft} · {turn===0?names[0]:names[1]}'s turn
      </div>}
    </div>
  )
}

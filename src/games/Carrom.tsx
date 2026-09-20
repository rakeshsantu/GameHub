import { useEffect, useRef, useState, useCallback } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'

interface Props { config: GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

interface Disk { x:number; y:number; vx:number; vy:number; r:number; color:'black'|'white'|'red'|'striker'; pocketed:boolean }

const SIZE   = 480
const BORDER = 48
const INNER  = SIZE - BORDER*2
const CENTER = SIZE/2
const POCKET_R = 22
const POCKETS: [number,number][] = [[BORDER,BORDER],[SIZE-BORDER,BORDER],[BORDER,SIZE-BORDER],[SIZE-BORDER,SIZE-BORDER]]
const FRICTION = 0.985
const COIN_R = 14
const STRIKER_R = 18

function mkCoins(): Disk[] {
  const coins: Disk[] = []
  // center red
  coins.push({ x:CENTER, y:CENTER, vx:0, vy:0, r:COIN_R, color:'red', pocketed:false })
  // ring of 9 black + 9 white alternating
  for (let i=0;i<18;i++) {
    const angle = (i/18)*Math.PI*2
    const dist  = COIN_R*2.4
    coins.push({ x:CENTER+Math.cos(angle)*dist, y:CENTER+Math.sin(angle)*dist,
                 vx:0, vy:0, r:COIN_R, color:i%2===0?'black':'white', pocketed:false })
  }
  return coins
}

export default function Carrom({ config, onGameOver, onExit }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const stateRef   = useRef({ disks: mkCoins() as Disk[], striker:null as Disk|null, moving:false })
  const aimRef     = useRef({ active:false, startX:0, startY:0, angle:0, power:0, strikerX:CENTER })
  const rafRef     = useRef(0)
  const { play }   = useSound()
  const isBot      = config.mode === 'vs-bot'
  const botDelay   = config.difficulty==='easy'?600:config.difficulty==='medium'?400:200

  const [turn,      setTurn]    = useState<0|1>(0)
  const [score,     setScore]   = useState([0,0])
  const [message,   setMessage] = useState('Drag the striker to aim & release!')
  const [gameOver,  setGameOver]= useState(false)
  const [strikerX,  setStrikerX]= useState(CENTER)
  const players = [config.players[0], config.players[1]||'Bot']

  const STRIKER_ROW = (t:number) => t===0 ? SIZE-BORDER-30 : BORDER+30

  // ── physics tick ──────────────────────────────────────────
  const tick = useCallback(() => {
    const s = stateRef.current
    if (!s.moving) return
    let anyMoving = false
    const disks = s.disks.filter(d=>!d.pocketed)
    if (s.striker) disks.push(s.striker)

    // move
    for (const d of disks) {
      d.x += d.vx; d.y += d.vy
      d.vx *= FRICTION; d.vy *= FRICTION
      if (Math.abs(d.vx)<0.05) d.vx=0
      if (Math.abs(d.vy)<0.05) d.vy=0
      if (Math.abs(d.vx)>0.01||Math.abs(d.vy)>0.01) anyMoving=true

      // walls
      if (d.x-d.r < BORDER)      { d.x=BORDER+d.r;      d.vx=Math.abs(d.vx)*0.8  }
      if (d.x+d.r > SIZE-BORDER)  { d.x=SIZE-BORDER-d.r; d.vx=-Math.abs(d.vx)*0.8 }
      if (d.y-d.r < BORDER)      { d.y=BORDER+d.r;      d.vy=Math.abs(d.vy)*0.8  }
      if (d.y+d.r > SIZE-BORDER)  { d.y=SIZE-BORDER-d.r; d.vy=-Math.abs(d.vy)*0.8 }
    }

    // disk-disk collisions
    for (let i=0;i<disks.length;i++) for (let j=i+1;j<disks.length;j++) {
      const a=disks[i], b=disks[j]
      const dx=b.x-a.x, dy=b.y-a.y, dist=Math.sqrt(dx*dx+dy*dy)
      const minDist=a.r+b.r
      if (dist<minDist&&dist>0) {
        play('move')
        const nx=dx/dist, ny=dy/dist
        const overlap=(minDist-dist)/2
        a.x-=nx*overlap; a.y-=ny*overlap
        b.x+=nx*overlap; b.y+=ny*overlap
        const dvx=a.vx-b.vx, dvy=a.vy-b.vy
        const dot=dvx*nx+dvy*ny
        if (dot>0) {
          const impulse=dot*0.9
          a.vx-=impulse*nx; a.vy-=impulse*ny
          b.vx+=impulse*nx; b.vy+=impulse*ny
        }
      }
    }

    // pockets
    let scored = false
    for (const d of s.disks) {
      if (d.pocketed) continue
      for (const [px,py] of POCKETS) {
        const dx=d.x-px, dy=d.y-py
        if (Math.sqrt(dx*dx+dy*dy)<POCKET_R+2) {
          d.pocketed=true; d.vx=0; d.vy=0
          if (d.color!=='striker') {
            const pts = d.color==='red'?3:1
            setScore(prev => {
              const n=[...prev]; n[turn]+=pts; return n
            })
            play('capture'); scored=true
          }
        }
      }
    }

    // striker pocketed
    if (s.striker) {
      for (const [px,py] of POCKETS) {
        const dx=s.striker.x-px, dy=s.striker.y-py
        if (Math.sqrt(dx*dx+dy*dy)<POCKET_R+STRIKER_R) {
          s.striker=null; s.moving=false; anyMoving=false
          play('error')
          setTurn(t => (t===0?1:0) as 0|1)
          setMessage('Striker pocketed! Opponent\'s turn.')
          break
        }
      }
    }

    draw()

    if (!anyMoving) {
      s.moving=false
      if (!gameOver) {
        // check win
        const remaining = s.disks.filter(d=>!d.pocketed&&d.color!=='red').length
        const redGone   = s.disks.find(d=>d.color==='red')?.pocketed
        if (remaining===0 && redGone) {
          setGameOver(true)
          const winner = score[0]>=score[1] ? players[0] : players[1]
          play('win')
          setTimeout(()=>onGameOver({winner, score:Math.max(...score), gameId:'carrom', difficulty:config.difficulty}),600)
          return
        }
        if (!scored) setTurn(t=>(t===0?1:0) as 0|1)
        setMessage(scored ? 'Great shot! Play again.' : 'Drag the striker to aim!')
      }
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [turn, gameOver, score])

  // ── draw ──────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx    = canvas.getContext('2d')!
    const s      = stateRef.current
    ctx.clearRect(0,0,SIZE,SIZE)

    // board
    ctx.fillStyle='#c8a87a'; ctx.fillRect(0,0,SIZE,SIZE)
    ctx.fillStyle='#b89060'; ctx.fillRect(BORDER,BORDER,INNER,INNER)

    // border lines
    ctx.strokeStyle='#8b6a3a'; ctx.lineWidth=2
    ctx.strokeRect(BORDER,BORDER,INNER,INNER)

    // center circle
    ctx.beginPath(); ctx.arc(CENTER,CENTER,COIN_R*3.5,0,Math.PI*2)
    ctx.strokeStyle='#a0783a'; ctx.lineWidth=1.5; ctx.stroke()
    ctx.beginPath(); ctx.arc(CENTER,CENTER,COIN_R*5.5,0,Math.PI*2)
    ctx.stroke()

    // pockets
    for (const [px,py] of POCKETS) {
      ctx.beginPath(); ctx.arc(px,py,POCKET_R,0,Math.PI*2)
      ctx.fillStyle='#4a2c0a'; ctx.fill()
      ctx.strokeStyle='#8b6a3a'; ctx.lineWidth=2; ctx.stroke()
    }

    // diagonal lines
    ctx.strokeStyle='#a0783a'; ctx.lineWidth=1; ctx.setLineDash([4,4])
    ctx.beginPath(); ctx.moveTo(BORDER+POCKET_R,BORDER+POCKET_R); ctx.lineTo(CENTER-20,CENTER-20); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(SIZE-BORDER-POCKET_R,BORDER+POCKET_R); ctx.lineTo(CENTER+20,CENTER-20); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(BORDER+POCKET_R,SIZE-BORDER-POCKET_R); ctx.lineTo(CENTER-20,CENTER+20); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(SIZE-BORDER-POCKET_R,SIZE-BORDER-POCKET_R); ctx.lineTo(CENTER+20,CENTER+20); ctx.stroke()
    ctx.setLineDash([])

    // striker lane line
    const sy = STRIKER_ROW(turn)
    ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1
    ctx.beginPath(); ctx.moveTo(BORDER+30,sy); ctx.lineTo(SIZE-BORDER-30,sy); ctx.stroke()

    // aim line
    if (aimRef.current.active && !s.moving) {
      const sx2=aimRef.current.strikerX, sy2=STRIKER_ROW(turn)
      const ang=aimRef.current.angle, pow=aimRef.current.power
      ctx.beginPath(); ctx.moveTo(sx2,sy2)
      ctx.lineTo(sx2+Math.cos(ang)*pow*6,sy2+Math.sin(ang)*pow*6)
      ctx.strokeStyle='rgba(255,200,0,0.7)'; ctx.lineWidth=2; ctx.stroke()
      // dots
      for (let i=1;i<=5;i++) {
        const t2=i/5
        ctx.beginPath(); ctx.arc(sx2+Math.cos(ang)*pow*6*t2, sy2+Math.sin(ang)*pow*6*t2,2,0,Math.PI*2)
        ctx.fillStyle='rgba(255,200,0,0.5)'; ctx.fill()
      }
    }

    // coins
    for (const d of s.disks) {
      if (d.pocketed) continue
      ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2)
      const col = d.color==='black'?'#1a1a1a':d.color==='white'?'#f0ede0':'#c0392b'
      ctx.fillStyle=col; ctx.fill()
      ctx.strokeStyle=d.color==='white'?'#888':'rgba(255,255,255,0.3)'
      ctx.lineWidth=1.5; ctx.stroke()
      // shine
      ctx.beginPath(); ctx.arc(d.x-d.r*0.3,d.y-d.r*0.3,d.r*0.3,0,Math.PI*2)
      ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.fill()
    }

    // striker
    const strikerY = STRIKER_ROW(turn)
    const sx = s.striker ? s.striker.x : aimRef.current.strikerX
    const sy2 = s.striker ? s.striker.y : strikerY
    if (!s.moving || s.striker) {
      ctx.beginPath(); ctx.arc(sx, sy2, STRIKER_R, 0, Math.PI*2)
      ctx.fillStyle=turn===0?'#4a9eff':'#ff6b4a'; ctx.fill()
      ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=2; ctx.stroke()
      ctx.beginPath(); ctx.arc(sx-6,sy2-6,6,0,Math.PI*2)
      ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fill()
    }
  }, [turn])

  useEffect(() => { draw() }, [turn, strikerX, draw])

  // ── mouse / touch ─────────────────────────────────────────
  const getPos = (e: React.MouseEvent|React.TouchEvent): [number,number] => {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const scale  = SIZE/rect.width
    const client = 'touches' in e ? e.touches[0] : e
    return [(client.clientX-rect.left)*scale, (client.clientY-rect.top)*scale]
  }

  const onDown = (e: React.MouseEvent|React.TouchEvent) => {
    if (stateRef.current.moving || gameOver) return
    if (isBot && turn===1) return
    const [mx,my] = getPos(e)
    const sy = STRIKER_ROW(turn)
    const dx = mx-aimRef.current.strikerX, dy=my-sy
    if (Math.sqrt(dx*dx+dy*dy)<STRIKER_R+10) {
      aimRef.current.active=true
      aimRef.current.startX=mx; aimRef.current.startY=my
    }
  }

  const onMove = (e: React.MouseEvent|React.TouchEvent) => {
    if (!aimRef.current.active) return
    const [mx,my] = getPos(e)
    const dx=aimRef.current.startX-mx, dy=aimRef.current.startY-my
    const newSx = Math.max(BORDER+STRIKER_R+30, Math.min(SIZE-BORDER-STRIKER_R-30, mx))
    aimRef.current.strikerX = newSx
    aimRef.current.angle    = Math.atan2(dy,dx)
    aimRef.current.power    = Math.min(Math.sqrt(dx*dx+dy*dy), 120)
    setStrikerX(newSx)
    draw()
  }

  const shoot = useCallback((angle:number, power:number, sx:number) => {
    const s = stateRef.current
    s.striker = { x:sx, y:STRIKER_ROW(turn), vx:Math.cos(angle)*power*0.22, vy:Math.sin(angle)*power*0.22,
                  r:STRIKER_R, color:'striker', pocketed:false }
    s.moving=true
    play('move')
    rafRef.current=requestAnimationFrame(tick)
  }, [turn, tick, play])

  const onUp = () => {
    if (!aimRef.current.active) return
    aimRef.current.active=false
    const { angle, power, strikerX:sx } = aimRef.current
    if (power>5) shoot(angle, power, sx)
    draw()
  }

  // ── Bot AI ────────────────────────────────────────────────
  useEffect(() => {
    if (!isBot || turn!==1 || stateRef.current.moving || gameOver) return
    const timer = setTimeout(() => {
      const targets = stateRef.current.disks.filter(d=>!d.pocketed&&d.color!=='striker')
      if (!targets.length) return
      // aim at nearest coin toward nearest pocket
      const target = targets[0]
      const [px,py] = POCKETS.reduce((best,p) => {
        const d1=Math.hypot(target.x-p[0],target.y-p[1])
        const d2=Math.hypot(target.x-best[0],target.y-best[1])
        return d1<d2?p:best
      }, POCKETS[0])
      const botSx = target.x + (config.difficulty==='easy'?(Math.random()-0.5)*60:0)
      const angle  = Math.atan2(STRIKER_ROW(1)-target.y, botSx-target.x) + Math.PI
      const power  = 80 + Math.random()*20
      shoot(angle, power, Math.max(BORDER+STRIKER_R+30,Math.min(SIZE-BORDER-STRIKER_R-30,botSx)))
    }, botDelay)
    return ()=>clearTimeout(timer)
  }, [turn, isBot, gameOver, shoot])

  useEffect(()=>()=>cancelAnimationFrame(rafRef.current),[])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      <div className="flex items-center justify-between w-full max-w-lg mb-3">
        <button onClick={onExit} className="game-btn-ghost text-sm py-2 px-4">← Exit</button>
        <h2 className="font-display text-xl text-white">🎯 Carrom</h2>
        <div className="text-sm text-white/50">
          {players[0]} {score[0]} — {score[1]} {players[1]}
        </div>
      </div>

      <div className={`text-sm mb-3 px-4 py-1.5 rounded-full font-medium
        ${turn===0?'bg-blue-500/20 text-blue-300':'bg-orange-500/20 text-orange-300'}`}>
        {isBot&&turn===1?'🤖 Bot is thinking…':message}
      </div>

      <canvas
        ref={canvasRef}
        width={SIZE} height={SIZE}
        className="rounded-2xl shadow-2xl border border-white/10 touch-none"
        style={{ maxWidth:'min(480px,95vw)', cursor: stateRef.current.moving?'default':'crosshair' }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      />

      <div className="mt-4 flex gap-6">
        {players.map((p,i)=>(
          <div key={i} className={`card-glass px-5 py-2 text-center ${turn===i?'border-brand-500/50':''}`}>
            <div className="text-xs text-white/40">{p}</div>
            <div className="text-2xl font-bold text-white">{score[i]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState, useCallback } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'
import HowToPlay from '../components/HowToPlay'
import { HOW_TO_PLAY } from './howToPlayData'

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }
interface Disk  { x:number;y:number;vx:number;vy:number;r:number;color:'black'|'white'|'red'|'striker';pocketed:boolean }

const SIZE=480,BORDER=48,INNER=SIZE-BORDER*2,CENTER=SIZE/2,POCKET_R=22,COIN_R=14,STRIKER_R=18
const FRICTION=0.985
const POCKETS:[number,number][]=[[BORDER,BORDER],[SIZE-BORDER,BORDER],[BORDER,SIZE-BORDER],[SIZE-BORDER,SIZE-BORDER]]

function mkCoins():Disk[]{
  const c:Disk[]=[{x:CENTER,y:CENTER,vx:0,vy:0,r:COIN_R,color:'red',pocketed:false}]
  for(let i=0;i<18;i++){const a=(i/18)*Math.PI*2,d=COIN_R*2.4;c.push({x:CENTER+Math.cos(a)*d,y:CENTER+Math.sin(a)*d,vx:0,vy:0,r:COIN_R,color:i%2===0?'black':'white',pocketed:false})}
  return c
}

export default function Carrom({config,onGameOver,onExit}:Props){
  const{play}=useSound()
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const stateRef=useRef({disks:mkCoins() as Disk[],striker:null as Disk|null,moving:false})
  const aimRef=useRef({active:false,startX:0,startY:0,angle:0,power:0,strikerX:CENTER})
  const rafRef=useRef(0)
  const isBot=config.mode==='vs-bot'
  const botDelay=config.difficulty==='easy'?600:config.difficulty==='medium'?400:200
  const[turn,setTurn]=useState<0|1>(0)
  const[score,setScore]=useState([0,0])
  const[message,setMessage]=useState('Drag the striker to aim & release!')
  const[gameOver,setGameOver]=useState(false)
  const[showHelp,setShowHelp]=useState(false)
  const players=[config.players[0],config.players[1]||'Bot']
  const STRIKER_ROW=(t:number)=>t===0?SIZE-BORDER-30:BORDER+30

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const ctx=canvas.getContext('2d')!;const s=stateRef.current
    ctx.clearRect(0,0,SIZE,SIZE)
    ctx.fillStyle='#c8a87a';ctx.fillRect(0,0,SIZE,SIZE)
    ctx.fillStyle='#b89060';ctx.fillRect(BORDER,BORDER,INNER,INNER)
    ctx.strokeStyle='#8b6a3a';ctx.lineWidth=2;ctx.strokeRect(BORDER,BORDER,INNER,INNER)
    ctx.beginPath();ctx.arc(CENTER,CENTER,COIN_R*3.5,0,Math.PI*2);ctx.strokeStyle='#a0783a';ctx.lineWidth=1.5;ctx.stroke()
    ctx.beginPath();ctx.arc(CENTER,CENTER,COIN_R*5.5,0,Math.PI*2);ctx.stroke()
    for(const[px,py]of POCKETS){ctx.beginPath();ctx.arc(px,py,POCKET_R,0,Math.PI*2);ctx.fillStyle='#4a2c0a';ctx.fill();ctx.strokeStyle='#8b6a3a';ctx.lineWidth=2;ctx.stroke()}
    ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=1
    const sy=STRIKER_ROW(turn);ctx.beginPath();ctx.moveTo(BORDER+30,sy);ctx.lineTo(SIZE-BORDER-30,sy);ctx.stroke()
    if(aimRef.current.active&&!s.moving){
      const{strikerX:sx,angle:ang,power:pow}=aimRef.current
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+Math.cos(ang)*pow*6,sy+Math.sin(ang)*pow*6)
      ctx.strokeStyle='rgba(255,200,100,0.7)';ctx.lineWidth=2;ctx.stroke()
    }
    for(const d of s.disks){
      if(d.pocketed)continue
      ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2)
      ctx.fillStyle=d.color==='black'?'#1a1a1a':d.color==='white'?'#f0ede0':'#c0392b';ctx.fill()
      ctx.strokeStyle=d.color==='white'?'#888':'rgba(255,255,255,0.3)';ctx.lineWidth=1.5;ctx.stroke()
      ctx.beginPath();ctx.arc(d.x-d.r*.3,d.y-d.r*.3,d.r*.3,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.25)';ctx.fill()
    }
    const strikerY=STRIKER_ROW(turn)
    const sx2=s.striker?s.striker.x:aimRef.current.strikerX
    const sy2=s.striker?s.striker.y:strikerY
    if(!s.moving||s.striker){
      ctx.beginPath();ctx.arc(sx2,sy2,STRIKER_R,0,Math.PI*2)
      ctx.fillStyle=turn===0?'#7c5a2a':'#4a7c5a';ctx.fill()
      ctx.strokeStyle='rgba(212,168,67,0.8)';ctx.lineWidth=2;ctx.stroke()
    }
  },[turn])

  const tick=useCallback(()=>{
    const s=stateRef.current;if(!s.moving)return
    let any=false
    const disks=s.disks.filter(d=>!d.pocketed)
    if(s.striker)disks.push(s.striker)
    for(const d of disks){
      d.x+=d.vx;d.y+=d.vy;d.vx*=FRICTION;d.vy*=FRICTION
      if(Math.abs(d.vx)<0.05)d.vx=0;if(Math.abs(d.vy)<0.05)d.vy=0
      if(Math.abs(d.vx)>0.01||Math.abs(d.vy)>0.01)any=true
      if(d.x-d.r<BORDER){d.x=BORDER+d.r;d.vx=Math.abs(d.vx)*.8}
      if(d.x+d.r>SIZE-BORDER){d.x=SIZE-BORDER-d.r;d.vx=-Math.abs(d.vx)*.8}
      if(d.y-d.r<BORDER){d.y=BORDER+d.r;d.vy=Math.abs(d.vy)*.8}
      if(d.y+d.r>SIZE-BORDER){d.y=SIZE-BORDER-d.r;d.vy=-Math.abs(d.vy)*.8}
    }
    for(let i=0;i<disks.length;i++)for(let j=i+1;j<disks.length;j++){
      const a=disks[i],b=disks[j],dx=b.x-a.x,dy=b.y-a.y,dist=Math.sqrt(dx*dx+dy*dy),min=a.r+b.r
      if(dist<min&&dist>0){
        play('move');const nx=dx/dist,ny=dy/dist,ov=(min-dist)/2
        a.x-=nx*ov;a.y-=ny*ov;b.x+=nx*ov;b.y+=ny*ov
        const dvx=a.vx-b.vx,dvy=a.vy-b.vy,dot=dvx*nx+dvy*ny
        if(dot>0){const imp=dot*.9;a.vx-=imp*nx;a.vy-=imp*ny;b.vx+=imp*nx;b.vy+=imp*ny}
      }
    }
    let scored=false
    for(const d of s.disks){
      if(d.pocketed)continue
      for(const[px,py]of POCKETS){
        if(Math.hypot(d.x-px,d.y-py)<POCKET_R+2){
          d.pocketed=true;d.vx=0;d.vy=0
          if(d.color!=='striker'){const pts=d.color==='red'?3:1;setScore(prev=>{const n=[...prev];n[turn]+=pts;return n});play('capture');scored=true}
        }
      }
    }
    if(s.striker){
      for(const[px,py]of POCKETS){
        if(Math.hypot(s.striker.x-px,s.striker.y-py)<POCKET_R+STRIKER_R){
          s.striker=null;s.moving=false;any=false;play('error')
          setTurn(t=>(t===0?1:0) as 0|1);setMessage('Striker pocketed! Opponent\'s turn.'); break
        }
      }
    }
    draw()
    if(!any){
      s.moving=false
      if(!gameOver){
        const rem=s.disks.filter(d=>!d.pocketed&&d.color!=='red').length
        const redGone=s.disks.find(d=>d.color==='red')?.pocketed
        if(rem===0&&redGone){
          setGameOver(true);const winner=score[0]>=score[1]?players[0]:players[1];play('win')
          setTimeout(()=>onGameOver({winner,score:Math.max(...score),gameId:'carrom',difficulty:config.difficulty}),600);return
        }
        if(!scored)setTurn(t=>(t===0?1:0) as 0|1)
        setMessage(scored?'Great shot! Play again.':'Drag the striker to aim!')
      }
      return
    }
    rafRef.current=requestAnimationFrame(tick)
  },[turn,gameOver,score,draw])

  useEffect(()=>{draw()},[turn,draw])

  const getPos=(e:React.MouseEvent|React.TouchEvent):[number,number]=>{
    const rect=canvasRef.current!.getBoundingClientRect(),scale=SIZE/rect.width
    const cl='touches' in e?e.touches[0]:e
    return[(cl.clientX-rect.left)*scale,(cl.clientY-rect.top)*scale]
  }
  const onDown=(e:React.MouseEvent|React.TouchEvent)=>{
    if(stateRef.current.moving||gameOver||(isBot&&turn===1))return
    const[mx,my]=getPos(e),sy=STRIKER_ROW(turn)
    if(Math.hypot(mx-aimRef.current.strikerX,my-sy)<STRIKER_R+10){aimRef.current.active=true;aimRef.current.startX=mx;aimRef.current.startY=my}
  }
  const onMove=(e:React.MouseEvent|React.TouchEvent)=>{
    if(!aimRef.current.active)return
    const[mx,my]=getPos(e)
    aimRef.current.strikerX=Math.max(BORDER+STRIKER_R+30,Math.min(SIZE-BORDER-STRIKER_R-30,mx))
    aimRef.current.angle=Math.atan2(aimRef.current.startY-my,aimRef.current.startX-mx)
    aimRef.current.power=Math.min(Math.hypot(aimRef.current.startX-mx,aimRef.current.startY-my),120)
    draw()
  }
  const shoot=useCallback((angle:number,power:number,sx:number)=>{
    const s=stateRef.current
    s.striker={x:sx,y:STRIKER_ROW(turn),vx:Math.cos(angle)*power*0.22,vy:Math.sin(angle)*power*0.22,r:STRIKER_R,color:'striker',pocketed:false}
    s.moving=true;play('move');rafRef.current=requestAnimationFrame(tick)
  },[turn,tick,play])
  const onUp=()=>{
    if(!aimRef.current.active)return;aimRef.current.active=false
    const{angle,power,strikerX:sx}=aimRef.current;if(power>5)shoot(angle,power,sx);draw()
  }
  useEffect(()=>{
    if(!isBot||turn!==1||stateRef.current.moving||gameOver)return
    const t=setTimeout(()=>{
      const targets=stateRef.current.disks.filter(d=>!d.pocketed&&d.color!=='striker')
      if(!targets.length)return
      const target=targets[0]
      const acc=config.difficulty==='easy'?45:config.difficulty==='medium'?22:8
      const angle=Math.atan2(STRIKER_ROW(1)-target.y,aimRef.current.strikerX-target.x)+Math.PI
      const power=80+Math.random()*20
      const sx=Math.max(BORDER+STRIKER_R+30,Math.min(SIZE-BORDER-STRIKER_R-30,target.x+(Math.random()-.5)*acc*2))
      shoot(angle,power,sx)
    },botDelay)
    return()=>clearTimeout(t)
  },[turn,isBot,gameOver,shoot])
  useEffect(()=>()=>cancelAnimationFrame(rafRef.current),[])

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      {showHelp&&<HowToPlay data={HOW_TO_PLAY.carrom} onClose={()=>setShowHelp(false)}/>}
      <div className="flex items-center justify-between w-full max-w-lg mb-3">
        <button onClick={onExit} className="btn-ghost text-xs py-1.5 px-3">← Exit</button>
        <h2 style={{fontFamily:'Cinzel Decorative,serif',color:'#d4a843',fontSize:'1rem'}}>🎯 Carrom</h2>
        <button onClick={()=>setShowHelp(true)} className="btn-ghost text-xs py-1.5 px-3">📜 How to Play</button>
      </div>
      <div className="text-sm mb-3 px-4 py-1.5 rounded-full"
           style={{fontFamily:'Cinzel,serif',background:'rgba(42,21,9,0.7)',border:'1px solid rgba(212,168,67,0.25)',
                   color:turn===0?'rgba(245,240,232,0.8)':'rgba(245,240,232,0.8)'}}>
        {isBot&&turn===1?'🤖 Bot is aiming…':message}
      </div>
      <canvas ref={canvasRef} width={SIZE} height={SIZE}
        className="rounded-2xl shadow-2xl touch-none"
        style={{maxWidth:'min(480px,95vw)',border:'2px solid rgba(212,168,67,0.35)',cursor:stateRef.current.moving?'default':'crosshair'}}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}/>
      <div className="mt-4 flex gap-6">
        {players.map((p,i)=>(
          <div key={i} className="rounded-xl px-5 py-2 text-center"
               style={{background:'rgba(26,12,6,0.7)',border:`1px solid ${turn===i?'rgba(212,168,67,0.5)':'rgba(212,168,67,0.15)'}`}}>
            <div className="text-xs mb-0.5" style={{color:'rgba(212,168,67,0.45)',fontFamily:'Cinzel,serif'}}>{p}</div>
            <div className="text-2xl font-bold" style={{color:'#fbbf24',fontFamily:'Cinzel Decorative,serif'}}>{score[i]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

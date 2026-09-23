import { useState, useEffect } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'
import HowToPlay from '../components/HowToPlay'
import { HOW_TO_PLAY } from './howToPlayData'

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

const TOTAL_STEPS=24,HOME_POS=TOTAL_STEPS,NUM_PIECES=4
const P_COLORS=['text-red-400','text-blue-400','text-green-400','text-yellow-400']
const P_BG=['rgba(239,68,68,0.15)','rgba(59,130,246,0.15)','rgba(34,197,94,0.15)','rgba(234,179,8,0.15)']
const P_EMOJI=['🔴','🔵','🟢','🟡']

function rollCowrie():number{
  const f=Array.from({length:4},()=>Math.random()<0.5?1:0) as number[]
  const c=f.reduce((a:number,b:number)=>a+b,0)
  return c===0?4:c===4?8:c
}

interface GS{pos:number[][];entered:boolean[][];turn:number;roll:number;phase:'roll'|'move'}

function initGS(np:number):GS{
  return{pos:Array.from({length:np},()=>Array(NUM_PIECES).fill(0)),entered:Array.from({length:np},()=>Array(NUM_PIECES).fill(false)),turn:0,roll:0,phase:'roll'}
}

export default function ChowkaBara({config,onGameOver,onExit}:Props){
  const{play}=useSound()
  const np=config.mode==='multiplayer'?2:2
  const[gs,setGs]=useState<GS>(()=>initGS(np))
  const[rolling,setRolling]=useState(false)
  const[msg,setMsg]=useState('Roll the cowrie shells!')
  const[done,setDone]=useState(false)
  const[showHelp,setShowHelp]=useState(false)
  const isBot=config.mode==='vs-bot'
  const names=Array.from({length:np},(_,i)=>config.players[i]||(i===1&&isBot?'Bot':`P${i+1}`))

  const canMove=(g:GS,pi:number,i:number)=>{
    const pos=g.pos[pi][i]
    if(pos===HOME_POS)return false
    if(!g.entered[pi][i])return g.roll===1||g.roll===4
    return pos+g.roll<=HOME_POS
  }

  const movePiece=(pieceIdx:number)=>{
    if(done||gs.phase!=='move')return
    const t=gs.turn
    if(!canMove(gs,t,pieceIdx)){play('error');return}
    const ng:GS={...gs,pos:gs.pos.map(a=>[...a]),entered:gs.entered.map(a=>[...a])}
    if(!ng.entered[t][pieceIdx]){ng.entered[t][pieceIdx]=true;ng.pos[t][pieceIdx]=ng.roll}
    else{ng.pos[t][pieceIdx]+=ng.roll;if(ng.pos[t][pieceIdx]>=HOME_POS)ng.pos[t][pieceIdx]=HOME_POS}
    const sq=ng.pos[t][pieceIdx]
    for(let p2=0;p2<np;p2++){
      if(p2===t)continue
      for(let j=0;j<NUM_PIECES;j++){
        if(ng.pos[p2][j]===sq&&ng.entered[p2][j]&&sq!==HOME_POS){ng.pos[p2][j]=0;ng.entered[p2][j]=false;play('capture');setMsg(`${names[t]} captured ${names[p2]}'s piece!`)}
      }
    }
    play('move')
    if(ng.pos[t].every(p=>p===HOME_POS)){setGs(ng);setDone(true);play('win');setTimeout(()=>onGameOver({winner:names[t],gameId:'chowkabara',difficulty:config.difficulty}),600);return}
    ng.turn=(ng.turn+1)%np;ng.phase='roll';ng.roll=0
    setGs(ng);setMsg(`${names[ng.turn]}'s turn — Roll!`)
  }

  const doRoll=()=>{
    if(gs.phase!=='roll'||rolling||done)return
    setRolling(true);play('dice')
    setTimeout(()=>{
      const r=rollCowrie()
      const ng:GS={...gs,roll:r,phase:'move'}
      const hasMoves=ng.pos[ng.turn].some((_,i)=>canMove(ng,ng.turn,i))
      if(!hasMoves){setMsg(`Rolled ${r} — no valid moves!`);setGs({...ng,turn:(ng.turn+1)%np,phase:'roll',roll:0})}
      else{setGs(ng);setMsg(`Rolled ${r}! Select a piece.`)}
      setRolling(false)
    },600)
  }

  useEffect(()=>{
    if(!isBot||gs.turn!==1||done)return
    if(gs.phase==='roll'){const t=setTimeout(doRoll,500);return()=>clearTimeout(t)}
    if(gs.phase==='move'){const t=setTimeout(()=>{const m=gs.pos[1].map((_,i)=>i).filter(i=>canMove(gs,1,i));if(m.length)movePiece(m[0])},600);return()=>clearTimeout(t)}
  },[gs,isBot,done])

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      {showHelp&&<HowToPlay data={HOW_TO_PLAY.chowkabara} onClose={()=>setShowHelp(false)}/>}
      <div className="flex items-center justify-between w-full max-w-lg mb-4">
        <button onClick={onExit} className="btn-ghost text-xs py-1.5 px-3">← Exit</button>
        <h2 style={{fontFamily:'Cinzel Decorative,serif',color:'#d4a843',fontSize:'1rem'}}>🎲 Chowka Bara</h2>
        <button onClick={()=>setShowHelp(true)} className="btn-ghost text-xs py-1.5 px-3">📜 How to Play</button>
      </div>
      <div className="text-sm mb-4 px-4 py-1.5 rounded-full"
           style={{fontFamily:'Cinzel,serif',background:P_BG[gs.turn],border:'1px solid rgba(212,168,67,0.25)',color:P_COLORS[gs.turn].replace('text-','#')}}>
        {msg}
      </div>
      <div className="grid grid-cols-1 gap-3 w-full max-w-lg">
        {names.map((name,pi)=>(
          <div key={pi} className="rounded-xl p-4"
               style={{background:'rgba(26,12,6,0.8)',border:`1px solid ${gs.turn===pi?'rgba(212,168,67,0.4)':'rgba(212,168,67,0.15)'}`}}>
            <div className={`text-sm font-semibold mb-3 flex items-center gap-2 ${P_COLORS[pi]}`}
                 style={{fontFamily:'Cinzel,serif'}}>
              {P_EMOJI[pi]} {name}
              {gs.pos[pi].every(p=>p===HOME_POS)&&<span style={{color:'#fbbf24'}}>🏆 Home!</span>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {gs.pos[pi].map((pos,i)=>(
                <button key={i} onClick={()=>pi===gs.turn&&gs.phase==='move'&&movePiece(i)}
                  className="w-16 h-12 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-all select-none"
                  style={{
                    background:pos===HOME_POS?'rgba(251,191,36,0.2)':'rgba(42,21,9,0.7)',
                    border:`1px solid ${gs.turn===pi&&gs.phase==='move'&&canMove(gs,pi,i)?'#fbbf24':'rgba(212,168,67,0.2)'}`,
                    color:pos===HOME_POS?'#fbbf24':'rgba(245,240,232,0.7)',
                    transform:gs.turn===pi&&gs.phase==='move'&&canMove(gs,pi,i)?'scale(1.08)':'scale(1)',
                    cursor:gs.turn===pi&&gs.phase==='move'&&canMove(gs,pi,i)?'pointer':'default',
                  }}>
                  <span>{pos===HOME_POS?'🏠':!gs.entered[pi][i]?P_EMOJI[pi]:P_EMOJI[pi]}</span>
                  <span style={{fontSize:'9px',color:'rgba(212,168,67,0.4)',fontFamily:'Cinzel,serif'}}>{pos===HOME_POS?'Home':pos===0?'Start':`Sq ${pos}`}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-col items-center gap-3">
        {gs.roll>0&&gs.phase==='move'&&(
          <div className="text-3xl font-bold" style={{color:'#fbbf24'}}>
            {Array.from({length:4},(_,i)=><span key={i}>{i<Math.min(gs.roll,4)?'🐚':'○'}</span>)}
            <span className="text-xl ml-2">= {gs.roll}</span>
          </div>
        )}
        {gs.phase==='roll'&&(gs.turn===0||!isBot)&&(
          <button onClick={doRoll} disabled={rolling} className="btn-gold text-lg px-8 py-4">
            {rolling?'🎲 Rolling…':'🎲 Roll Cowries!'}
          </button>
        )}
      </div>
    </div>
  )
}

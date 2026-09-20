import { useState, useEffect } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'

// Kaana Dua — Traditional 2-faced cowrie dice betting game
// Each round: roll 4 cowries. Kaana=face-down(0), Dua=face-up(1)
// 0 Dua = lose 4 points; 1=1pt; 2=2pt; 3=3pt; 4 Dua = win 8 pts
// First to 30 points wins (or lowest score after 10 rounds)

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

const ROUNDS=10
const WIN_SCORE=30

function rollDice(n=4):number[]{
  return Array.from({length:n},()=>Math.random()<0.5?1:0)
}

function scoreRoll(faces:number[]):number{
  const dua=faces.filter(f=>f===1).length
  if(dua===0) return -4
  if(dua===4) return 8
  return dua
}

const FACE_LABEL=['🪨 Kaana','🐚 Dua']

export default function KaanaDua({config,onGameOver,onExit}:Props){
  const {play}=useSound()
  const np=config.mode==='multiplayer'?2:2
  const names=Array.from({length:np},(_,i)=>config.players[i]||(i===1&&config.mode==='vs-bot'?'Bot':`P${i+1}`))
  const [scores,setScores]=useState(Array(np).fill(0))
  const [roundNum,setRoundNum]=useState(1)
  const [turn,setTurn]=useState(0)
  const [faces,setFaces]=useState<number[]|null>(null)
  const [rolling,setRolling]=useState(false)
  const [msg,setMsg]=useState('Roll the cowrie dice!')
  const [done,setDone]=useState(false)
  const [history,setHistory]=useState<string[]>([])
  const isBot=config.mode==='vs-bot'

  const doRoll=()=>{
    if(rolling||done) return
    setRolling(true); play('dice')
    setTimeout(()=>{
      const f=rollDice(4)
      const pts=scoreRoll(f)
      const dua=f.filter(x=>x===1).length
      setFaces(f)
      const ns=[...scores]; ns[turn]+=pts
      setScores(ns)
      play(pts>0?'move':pts===8?'win':'error')
      const result=pts===8?'🎰 ALL DUA! +8 pts!':pts<0?`☠️ ALL KAANA! ${pts} pts`:`${dua} Dua = +${pts} pts`
      setHistory(h=>[`${names[turn]}: ${result}`,...h].slice(0,10))
      setMsg(result)

      // check win
      if(ns[turn]>=WIN_SCORE){
        setDone(true); play('win')
        setTimeout(()=>onGameOver({winner:names[turn],score:ns[turn],gameId:'kaanadua',difficulty:config.difficulty}),700)
        setRolling(false); return
      }

      // next
      const nextTurn=(turn+1)%np
      if(nextTurn===0&&roundNum>=ROUNDS){
        const winner=ns.indexOf(Math.max(...ns))
        setDone(true); play('win')
        setTimeout(()=>onGameOver({winner:names[winner],score:ns[winner],gameId:'kaanadua',difficulty:config.difficulty}),700)
        setRolling(false); return
      }
      if(nextTurn===0) setRoundNum(r=>r+1)
      setTurn(nextTurn)
      setTimeout(()=>setMsg(`${names[nextTurn]}'s turn!`),800)
      setRolling(false)
    },700)
  }

  // Bot
  useEffect(()=>{
    if(!isBot||turn!==1||done) return
    const t=setTimeout(doRoll,600)
    return()=>clearTimeout(t)
  },[turn,isBot,done])

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      <div className="flex items-center justify-between w-full max-w-sm mb-4">
        <button onClick={onExit} className="game-btn-ghost text-sm py-2 px-4">← Exit</button>
        <h2 className="font-display text-xl text-white">🎰 Kaana Dua</h2>
        <div className="text-sm text-white/50">Round {roundNum}/{ROUNDS}</div>
      </div>

      <div className="text-sm mb-4 px-4 py-1.5 rounded-full bg-white/5 text-white/70 text-center">
        {msg}
      </div>

      {/* Scores */}
      <div className="flex gap-4 mb-6">
        {names.map((n,i)=>(
          <div key={i} className={`card-glass px-6 py-3 text-center transition-all
            ${turn===i?'border-brand-400/50 scale-105':''}`}>
            <div className="text-xs text-white/40 mb-1">{n}</div>
            <div className={`text-3xl font-bold ${scores[i]>=WIN_SCORE?'text-gold-400':'text-white'}`}>{scores[i]}</div>
            <div className="text-xs text-white/30">pts</div>
          </div>
        ))}
      </div>

      {/* Dice display */}
      <div className="card-glass p-6 mb-6 min-h-[120px] flex flex-col items-center gap-4 w-full max-w-xs">
        {faces ? (
          <>
            <div className="flex gap-3">
              {faces.map((f,i)=>(
                <div key={i} className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center
                  text-2xl font-bold border-2 transition-all
                  ${f===1?'bg-amber-500/20 border-amber-400 text-amber-300':'bg-slate-700/40 border-slate-500 text-slate-400'}`}>
                  {f===1?'🐚':'🪨'}
                </div>
              ))}
            </div>
            <div className={`text-sm font-semibold ${scoreRoll(faces)>0?'text-green-400':scoreRoll(faces)===8?'text-gold-400':'text-red-400'}`}>
              {scoreRoll(faces)>0?'+':''}{scoreRoll(faces)} points
            </div>
          </>
        ) : (
          <div className="flex gap-3 opacity-30">
            {Array(4).fill(0).map((_,i)=>(
              <div key={i} className="w-14 h-14 rounded-2xl border-2 border-white/10 bg-white/5" />
            ))}
          </div>
        )}
      </div>

      {(!isBot||turn===0)&&!done&&(
        <button onClick={doRoll} disabled={rolling}
          className={`game-btn-gold text-lg px-10 py-4 ${rolling?'opacity-70':''}`}>
          {rolling?'🎲 Rolling…':'🎲 Roll Cowries!'}
        </button>
      )}

      {/* History */}
      {history.length>0&&(
        <div className="mt-6 card-glass p-3 w-full max-w-sm">
          <div className="text-xs text-white/30 mb-1">Recent rolls:</div>
          {history.map((h,i)=>(
            <div key={i} className="text-xs text-white/50">{h}</div>
          ))}
        </div>
      )}

      <div className="mt-4 text-xs text-white/25 text-center">
        First to {WIN_SCORE} pts wins · All Kaana = –4 · All Dua = +8
      </div>
    </div>
  )
}

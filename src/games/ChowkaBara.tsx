import { useState, useEffect } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

// Chowka Bara: 5x5 cross board, 4 cowrie shells (0-4), players race pieces home
// Simplified 2-player version with 4 pieces each on a linear track of 24 steps

const TOTAL_STEPS = 24
const HOME_POS    = TOTAL_STEPS
const NUM_PIECES  = 4

const PLAYER_COLORS = ['text-red-400','text-blue-400','text-green-400','text-yellow-400']
const PLAYER_BG     = ['bg-red-500/20','bg-blue-500/20','bg-green-500/20','bg-yellow-500/20']
const PLAYER_EMOJI  = ['🔴','🔵','🟢','🟡']

// Board path indices for visual layout (5x5 cross)
// We use a simple list-based rendering for clarity
function rollCowrie(diff:string):number{
  const faces = Array.from({length:4},()=>Math.random()<0.5?1:0) as number[]
  const count = faces.reduce((a:number,b:number)=>a+b, 0)
  // 0 heads = 4 moves (special), 1=1, 2=2, 3=3, 4=8 (special)
  if(count===0) return 4
  if(count===4) return 8
  return count
}

interface GameState {
  pieces:   number[][] // [player][piece] = position (0=start, HOME_POS=home)
  turn:     number
  roll:     number
  phase:    'roll'|'move'
  entered:  boolean[][] // whether piece has entered the board
}

function initState(numPlayers:number):GameState{
  return{
    pieces:    Array.from({length:numPlayers},()=>Array(NUM_PIECES).fill(0)),
    turn:      0,
    roll:      0,
    phase:     'roll',
    entered:   Array.from({length:numPlayers},()=>Array(NUM_PIECES).fill(false)),
  }
}

export default function ChowkaBara({config,onGameOver,onExit}:Props){
  const {play}=useSound()
  const numPlayers = config.mode==='multiplayer'?Math.min(Number(config.players.length)||2,4):2
  const [state,setState]=useState<GameState>(()=>initState(numPlayers))
  const [rolling,setRolling]=useState(false)
  const [msg,setMsg]=useState('Roll the cowrie shells!')
  const [done,setDone]=useState(false)
  const isBot=config.mode==='vs-bot'
  const players=Array.from({length:numPlayers},(_,i)=>config.players[i]||(i===1&&isBot?'Bot':`P${i+1}`))

  const canMove=(st:GameState,pIdx:number,pieceIdx:number):boolean=>{
    const pos=st.pieces[st.turn][pieceIdx]
    const roll=st.roll
    // can enter with roll of 1 or 4
    if(pos===0&&!st.entered[st.turn][pieceIdx]){
      return roll===1||roll===4
    }
    if(pos===HOME_POS) return false
    if(pos+roll>HOME_POS) return false
    return true
  }

  const movePiece=(pieceIdx:number)=>{
    if(state.phase!=='move'||done) return
    const t=state.turn
    if(!canMove(state,t,pieceIdx)){ play('error'); return }

    const ns={...state, pieces:state.pieces.map(a=>[...a]), entered:state.entered.map(a=>[...a])}
    if(ns.pieces[t][pieceIdx]===0&&!ns.entered[t][pieceIdx]){
      ns.entered[t][pieceIdx]=true
      ns.pieces[t][pieceIdx]=ns.roll
    } else {
      ns.pieces[t][pieceIdx]+=ns.roll
      if(ns.pieces[t][pieceIdx]>=HOME_POS) ns.pieces[t][pieceIdx]=HOME_POS
    }

    // capture: check if any opponent lands on same spot
    for(let p=0;p<numPlayers;p++){
      if(p===t) continue
      for(let i=0;i<NUM_PIECES;i++){
        if(ns.pieces[p][i]===ns.pieces[t][pieceIdx]&&ns.pieces[p][i]!==HOME_POS&&ns.pieces[p][i]!==0){
          ns.pieces[p][i]=0; ns.entered[p][i]=false
          play('capture')
          setMsg(`${players[t]} captured ${players[p]}'s piece!`)
        }
      }
    }
    play('move')

    // win check
    if(ns.pieces[t].every(p=>p===HOME_POS)){
      setDone(true); play('win')
      setTimeout(()=>onGameOver({winner:players[t],gameId:'chowkabara',difficulty:config.difficulty}),600)
      return
    }

    // next turn
    ns.turn=(ns.turn+1)%numPlayers
    ns.phase='roll'
    setState(ns)
    setMsg(`${players[ns.turn]}'s turn — Roll!`)
  }

  const doRoll=()=>{
    if(state.phase!=='roll'||rolling||done) return
    setRolling(true)
    play('dice')
    setTimeout(()=>{
      const r=rollCowrie(config.difficulty)
      const ns={...state,roll:r,phase:'move' as const}
      setState(ns)
      setRolling(false)
      const t=ns.turn
      const hasMoves=ns.pieces[t].some((_,i)=>canMove(ns,t,i))
      if(!hasMoves){
        setMsg(`Rolled ${r} — No valid moves! Next player.`)
        setTimeout(()=>{
          setState(prev=>({...prev,turn:(prev.turn+1)%numPlayers,phase:'roll'}))
        },1000)
      } else {
        setMsg(`Rolled ${r}! Select a piece to move.`)
      }
    },600)
  }

  // Bot
  useEffect(()=>{
    if(!isBot||state.turn!==1||state.phase!=='move'||done) return
    const t=setTimeout(()=>{
      const movable=state.pieces[1].map((_,i)=>i).filter(i=>canMove(state,1,i))
      if(movable.length) movePiece(movable[0])
    },600)
    return()=>clearTimeout(t)
  },[state,isBot,done])

  useEffect(()=>{
    if(!isBot||state.turn!==1||state.phase!=='roll'||done) return
    const t=setTimeout(doRoll,500)
    return()=>clearTimeout(t)
  },[state.turn,state.phase,isBot,done])

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      <div className="flex items-center justify-between w-full max-w-lg mb-4">
        <button onClick={onExit} className="game-btn-ghost text-sm py-2 px-4">← Exit</button>
        <h2 className="font-display text-xl text-white">🎲 Chowka Bara</h2>
        <div className="text-sm text-white/50">Turn: {players[state.turn]}</div>
      </div>

      <div className={`text-sm mb-4 px-4 py-1.5 rounded-full font-medium ${PLAYER_BG[state.turn]} ${PLAYER_COLORS[state.turn]}`}>
        {msg}
      </div>

      {/* Player boards */}
      <div className="grid grid-cols-1 gap-4 w-full max-w-lg">
        {players.map((name,pi)=>(
          <div key={pi} className={`card-glass p-4 ${state.turn===pi?'border-white/30':''}`}>
            <div className={`text-sm font-medium mb-3 flex items-center gap-2 ${PLAYER_COLORS[pi]}`}>
              {PLAYER_EMOJI[pi]} {name}
              {state.pieces[pi].every(p=>p===HOME_POS)&&<span className="text-gold-400">🏆 Home!</span>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {state.pieces[pi].map((pos,i)=>(
                <button key={i}
                  onClick={()=>pi===state.turn&&state.phase==='move'&&movePiece(i)}
                  className={`w-14 h-10 rounded-xl text-xs font-bold flex flex-col items-center justify-center
                    transition-all select-none
                    ${pos===HOME_POS?'bg-gold-500/30 text-gold-400 border border-gold-500/30':''}
                    ${pos===0&&!state.entered[pi][i]?'bg-white/5 text-white/30 border border-white/10':''}
                    ${pos>0&&pos<HOME_POS?'border border-white/20 text-white bg-white/10':''}
                    ${state.turn===pi&&state.phase==='move'&&canMove(state,pi,i)?'ring-2 ring-yellow-400 scale-105 cursor-pointer':'cursor-default'}
                    `}>
                  <span>{pos===HOME_POS?'🏠':pos===0&&!state.entered[pi][i]?PLAYER_EMOJI[pi]:`${PLAYER_EMOJI[pi]}`}</span>
                  <span className="text-[10px] text-white/40">{pos===HOME_POS?'Home':pos===0?'Start':`Sq ${pos}`}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Dice roll */}
      <div className="mt-6 flex flex-col items-center gap-3">
        {state.roll>0&&state.phase==='move'&&(
          <div className="text-4xl font-bold text-gold-400">
            {Array.from({length:4},(_,i)=><span key={i}>{i<Math.min(state.roll,4)?'🐚':'○'}</span>)}
            <span className="text-xl ml-2">= {state.roll}</span>
          </div>
        )}
        {state.phase==='roll'&&state.turn===0&&(
          <button onClick={doRoll} disabled={rolling}
            className={`game-btn-gold text-lg px-8 py-4 ${rolling?'animate-spin-slow':''}`}>
            {rolling?'🎲 Rolling…':'🎲 Roll Cowries!'}
          </button>
        )}
        {state.phase==='roll'&&state.turn!==0&&!isBot&&(
          <button onClick={doRoll} disabled={rolling} className="game-btn-gold text-lg px-8 py-4">
            {rolling?'🎲 Rolling…':'🎲 Roll!'}
          </button>
        )}
      </div>
    </div>
  )
}

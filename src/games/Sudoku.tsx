import { useState, useCallback } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'
import HowToPlay from '../components/HowToPlay'
import { HOW_TO_PLAY } from './howToPlayData'

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }
type Grid=number[][]

function emptyGrid():Grid{return Array.from({length:9},()=>Array(9).fill(0))}

function isValid(g:Grid,r:number,c:number,n:number):boolean{
  for(let i=0;i<9;i++)if(g[r][i]===n||g[i][c]===n)return false
  const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(g[br+i][bc+j]===n)return false
  return true
}

function solve(g:Grid):boolean{
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    if(g[r][c]===0){
      const nums=[1,2,3,4,5,6,7,8,9].sort(()=>Math.random()-0.5)
      for(const n of nums){if(isValid(g,r,c,n)){g[r][c]=n;if(solve(g))return true;g[r][c]=0}}
      return false
    }
  }
  return true
}

function generatePuzzle(diff:string):{puzzle:Grid;solution:Grid}{
  const sol=emptyGrid();solve(sol)
  const puzzle=sol.map(r=>[...r])
  const removes=diff==='easy'?35:diff==='medium'?45:55
  let removed=0
  while(removed<removes){const r=Math.floor(Math.random()*9),c=Math.floor(Math.random()*9);if(puzzle[r][c]!==0){puzzle[r][c]=0;removed++}}
  return{puzzle,solution:sol}
}

export default function Sudoku({config,onGameOver,onExit}:Props){
  const{play}=useSound()
  const[data,setData]=useState(()=>generatePuzzle(config.difficulty))
  const[grid,setGrid]=useState<Grid>(()=>data.puzzle.map(r=>[...r]))
  const[fixed]=useState<boolean[][]>(()=>data.puzzle.map(r=>r.map(c=>c!==0)))
  const[selected,setSelected]=useState<[number,number]|null>(null)
  const[errors,setErrors]=useState<Set<string>>(new Set())
  const[hints,setHints]=useState(3)
  const[startTime]=useState(Date.now())
  const[showHelp,setShowHelp]=useState(false)

  const isSel=(r:number,c:number)=>selected?.[0]===r&&selected?.[1]===c
  const isSameNum=(r:number,c:number)=>!!(selected&&grid[selected[0]][selected[1]]!==0&&grid[r][c]===grid[selected[0]][selected[1]])
  const isSameRC=(r:number,c:number)=>!!(selected&&(r===selected[0]||c===selected[1]))
  const isSameBox=(r:number,c:number)=>!!(selected&&Math.floor(r/3)===Math.floor(selected[0]/3)&&Math.floor(c/3)===Math.floor(selected[1]/3))

  const input=(n:number)=>{
    if(!selected)return
    const[r,c]=selected;if(fixed[r][c])return
    const ng=grid.map(row=>[...row]);ng[r][c]=n;setGrid(ng)
    const key=`${r},${c}`
    if(n!==0&&n!==data.solution[r][c]){setErrors(e=>new Set([...e,key]));play('error')}
    else{setErrors(e=>{const ne=new Set(e);ne.delete(key);return ne});play('move')}
    if(ng.every((row,ri)=>row.every((v,ci)=>v===data.solution[ri][ci]))){
      const time=Math.round((Date.now()-startTime)/1000)
      const score=Math.max(1000-errors.size*50-time,100);play('win')
      setTimeout(()=>onGameOver({winner:config.players[0],score,gameId:'sudoku',difficulty:config.difficulty}),500)
    }
  }

  const hint=useCallback(()=>{
    if(hints<=0||!selected)return
    const[r,c]=selected;if(fixed[r][c])return
    const ng=grid.map(row=>[...row]);ng[r][c]=data.solution[r][c];setGrid(ng)
    setHints(h=>h-1);play('capture')
  },[hints,selected,grid,data,fixed])

  const newGame=()=>{
    const d=generatePuzzle(config.difficulty);setData(d)
    setGrid(d.puzzle.map(r=>[...r]));setSelected(null);setErrors(new Set());setHints(3)
  }

  const cellCls=(r:number,c:number)=>{
    const key=`${r},${c}`
    if(errors.has(key))   return 'sudoku-error'
    if(isSel(r,c))        return 'sudoku-selected'
    if(isSameNum(r,c))    return 'sudoku-highlight'
    if(isSameBox(r,c)||isSameRC(r,c)) return 'sudoku-highlight'
    return ''
  }

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      {showHelp&&<HowToPlay data={HOW_TO_PLAY.sudoku} onClose={()=>setShowHelp(false)}/>}

      <div className="flex items-center justify-between w-full max-w-sm mb-4">
        <button onClick={onExit} className="btn-ghost text-xs py-1.5 px-3">← Exit</button>
        <h2 style={{fontFamily:'Cinzel Decorative,serif',color:'#d4a843',fontSize:'1rem'}}>🔢 Sudoku</h2>
        <button onClick={()=>setShowHelp(true)} className="btn-ghost text-xs py-1.5 px-3">📜 How to Play</button>
      </div>

      <div className="text-xs mb-4 px-3 py-1 rounded-full"
           style={{fontFamily:'Cinzel,serif',background:'rgba(42,21,9,0.7)',border:'1px solid rgba(212,168,67,0.2)',
                   color:'rgba(212,168,67,0.6)',letterSpacing:'0.1em',textTransform:'uppercase'}}>
        {config.difficulty === 'easy' ? '🌱 Novice' : config.difficulty === 'medium' ? '📜 Scholar' : '👑 Master'} · {errors.size} Error{errors.size!==1?'s':''}
      </div>

      {/* Grid */}
      <div className="rounded-xl overflow-hidden shadow-2xl"
           style={{border:'2px solid rgba(212,168,67,0.35)'}}>
        {grid.map((row,r)=>(
          <div key={r} className={`flex ${r===2||r===5?'border-b-2':''}`}
               style={{borderColor:'rgba(212,168,67,0.5)'}}>
            {row.map((val,c)=>(
              <div key={c} onClick={()=>{if(!fixed[r][c])setSelected([r,c])}}
                className={`w-9 h-9 md:w-11 md:h-11 flex items-center justify-center text-sm md:text-base
                            font-medium cursor-pointer select-none transition-colors
                            ${c===2||c===5?'border-r-2':'border-r'} ${r>0?'border-t':''}
                            ${cellCls(r,c)}
                            hover:brightness-110`}
                style={{
                  background: cellCls(r,c)===''?'rgba(26,12,6,0.8)':undefined,
                  borderColor:'rgba(212,168,67,0.2)',
                  color: fixed[r][c]?'#f5f0e8':'#fbbf24',
                  fontFamily: fixed[r][c]?'Cinzel,serif':'Crimson Text,serif',
                  fontWeight: fixed[r][c]?700:400,
                  fontSize: fixed[r][c]?'0.85rem':'1rem',
                }}>
                {val||''}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Numpad */}
      <div className="flex gap-1.5 mt-4">
        {[1,2,3,4,5,6,7,8,9].map(n=>(
          <button key={n} onClick={()=>input(n)}
            className="w-9 h-9 md:w-10 md:h-10 rounded-lg text-sm font-bold transition-all active:scale-90"
            style={{background:'rgba(42,21,9,0.7)',border:'1px solid rgba(212,168,67,0.25)',
                    color:'#f5f0e8',fontFamily:'Cinzel,serif'}}>
            {n}
          </button>
        ))}
        <button onClick={()=>input(0)}
          className="w-9 h-9 md:w-10 md:h-10 rounded-lg text-xs font-semibold transition-all active:scale-90"
          style={{background:'rgba(42,21,9,0.7)',border:'1px solid rgba(212,168,67,0.25)',color:'rgba(245,240,232,0.35)'}}>
          ✕
        </button>
      </div>

      <div className="flex gap-3 mt-4">
        <button onClick={hint} disabled={hints<=0||!selected} className="btn-ghost text-sm py-2 px-4 disabled:opacity-30">
          💡 Hint ({hints})
        </button>
        <button onClick={newGame} className="btn-ghost text-sm py-2 px-4">🔄 New</button>
      </div>
    </div>
  )
}

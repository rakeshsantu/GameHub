import { useState, useCallback } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'

interface Props { config:GameConfig; onGameOver:(r:GameResult)=>void; onExit:()=>void }

type Grid = number[][]

function emptyGrid():Grid{ return Array.from({length:9},()=>Array(9).fill(0)) }

function isValid(g:Grid,r:number,c:number,n:number):boolean{
  for(let i=0;i<9;i++) if(g[r][i]===n||g[i][c]===n) return false
  const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) if(g[br+i][bc+j]===n) return false
  return true
}

function solve(g:Grid):boolean{
  for(let r=0;r<9;r++) for(let c=0;c<9;c++){
    if(g[r][c]===0){
      const nums=[1,2,3,4,5,6,7,8,9].sort(()=>Math.random()-0.5)
      for(const n of nums){
        if(isValid(g,r,c,n)){ g[r][c]=n; if(solve(g)) return true; g[r][c]=0 }
      }
      return false
    }
  }
  return true
}

function generatePuzzle(diff:string):{ puzzle:Grid; solution:Grid }{
  const sol=emptyGrid(); solve(sol)
  const puzzle=sol.map(r=>[...r])
  const removes = diff==='easy'?35:diff==='medium'?45:55
  let removed=0
  while(removed<removes){
    const r=Math.floor(Math.random()*9),c=Math.floor(Math.random()*9)
    if(puzzle[r][c]!==0){ puzzle[r][c]=0; removed++ }
  }
  return{ puzzle, solution:sol }
}

export default function Sudoku({config,onGameOver,onExit}:Props){
  const {play}=useSound()
  const [data,setData]=useState(()=>generatePuzzle(config.difficulty))
  const [grid,setGrid]=useState<Grid>(()=>data.puzzle.map(r=>[...r]))
  const [fixed]=useState<boolean[][]>(()=>data.puzzle.map(r=>r.map(c=>c!==0)))
  const [selected,setSelected]=useState<[number,number]|null>(null)
  const [errors,setErrors]=useState<Set<string>>(new Set())
  const [hints,setHints]=useState(3)
  const [startTime]=useState(Date.now())

  const select=(r:number,c:number)=>{ if(!fixed[r][c]) setSelected([r,c]) }

  const input=(n:number)=>{
    if(!selected)return
    const [r,c]=selected
    if(fixed[r][c])return
    const ng=grid.map(row=>[...row])
    ng[r][c]=n
    setGrid(ng)
    const key=`${r},${c}`
    if(n!==0&&n!==data.solution[r][c]){
      setErrors(e=>new Set([...e,key])); play('error')
    } else {
      setErrors(e=>{const ne=new Set(e);ne.delete(key);return ne}); play('move')
    }
    // check complete
    const complete=ng.every((row,ri)=>row.every((v,ci)=>v===data.solution[ri][ci]))
    if(complete){
      const time=Math.round((Date.now()-startTime)/1000)
      const score=Math.max(1000-errors.size*50-time,100)
      play('win')
      setTimeout(()=>onGameOver({winner:config.players[0],score,gameId:'sudoku',difficulty:config.difficulty}),500)
    }
  }

  const hint=useCallback(()=>{
    if(hints<=0||!selected)return
    const [r,c]=selected
    if(fixed[r][c])return
    const ng=grid.map(row=>[...row])
    ng[r][c]=data.solution[r][c]
    setGrid(ng)
    setHints(h=>h-1)
    play('capture')
  },[hints,selected,grid,data,fixed])

  const newGame=()=>{
    const d=generatePuzzle(config.difficulty)
    setData(d); setGrid(d.puzzle.map(r=>[...r]))
    setSelected(null); setErrors(new Set()); setHints(3)
  }

  const isSel=(r:number,c:number)=>selected?.[0]===r&&selected?.[1]===c
  const isSameNum=(r:number,c:number)=>selected&&grid[selected[0]][selected[1]]!==0&&grid[r][c]===grid[selected[0]][selected[1]]
  const isSameBox=(r:number,c:number)=>selected&&Math.floor(r/3)===Math.floor(selected[0]/3)&&Math.floor(c/3)===Math.floor(selected[1]/3)
  const isSameRC=(r:number,c:number)=>selected&&(r===selected[0]||c===selected[1])

  const cellBg=(r:number,c:number)=>{
    const key=`${r},${c}`
    if(errors.has(key))    return 'bg-red-500/30 text-red-400'
    if(isSel(r,c))         return 'bg-brand-500/40 text-white'
    if(isSameNum(r,c))     return 'bg-brand-400/20 text-brand-300'
    if(isSameBox(r,c)||isSameRC(r,c)) return 'bg-white/5'
    return ''
  }

  return(
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10">
      <div className="flex items-center justify-between w-full max-w-sm mb-4">
        <button onClick={onExit} className="game-btn-ghost text-sm py-2 px-4">← Exit</button>
        <h2 className="font-display text-xl text-white">🔢 Sudoku</h2>
        <div className="text-sm text-white/50 capitalize">{config.difficulty}</div>
      </div>

      {/* Grid */}
      <div className="border-2 border-white/30 rounded-xl overflow-hidden shadow-2xl">
        {grid.map((row,r)=>(
          <div key={r} className={`flex ${r===2||r===5?'border-b-2 border-white/30':''}`}>
            {row.map((val,c)=>(
              <div key={c}
                onClick={()=>select(r,c)}
                className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center
                  text-sm md:text-base font-medium cursor-pointer select-none transition-colors
                  ${c===2||c===5?'border-r-2 border-white/30':'border-r border-white/10'}
                  ${r>0?'border-t border-white/10':''}
                  ${cellBg(r,c)}
                  ${fixed[r][c]?'font-bold text-white/90':'text-brand-300'}
                  hover:bg-white/10`}>
                {val||''}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Number pad */}
      <div className="flex gap-1.5 mt-4">
        {[1,2,3,4,5,6,7,8,9].map(n=>(
          <button key={n} onClick={()=>input(n)}
            className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-white/5 border border-white/10
                       hover:bg-brand-600/40 hover:border-brand-500/50 text-white text-sm
                       font-semibold transition-all active:scale-90">
            {n}
          </button>
        ))}
        <button onClick={()=>input(0)}
          className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-white/5 border border-white/10
                     hover:bg-red-600/30 text-white/50 text-xs font-semibold transition-all active:scale-90">
          ✕
        </button>
      </div>

      <div className="flex gap-3 mt-4">
        <button onClick={hint} disabled={hints<=0||!selected}
          className="game-btn-ghost text-sm py-2 px-4 disabled:opacity-30">
          💡 Hint ({hints})
        </button>
        <button onClick={newGame} className="game-btn-ghost text-sm py-2 px-4">
          🔄 New
        </button>
      </div>

      {errors.size>0&&<div className="mt-2 text-red-400 text-xs">⚠️ {errors.size} error{errors.size!==1?'s':''}</div>}
    </div>
  )
}

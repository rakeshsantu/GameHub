import { useState, useEffect } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'
import HowToPlay from '../components/HowToPlay'
import { HOW_TO_PLAY } from './howToPlayData'

interface Props { config: GameConfig; onGameOver: (r: GameResult) => void; onExit: () => void }

const HOME = 40
const PIECES = 3
// Player colors: P0 = Red, P1 = Pink
const P_COLORS = ['#e84040', '#e040a0']
const P_LIGHT  = ['#ff7070', '#ff70c0']
const P_DARK   = ['#8b0000', '#800040']
const P_NAMES_DEFAULT = ['Player 1', 'Player 2']

interface GS { pos: number[][]; entered: boolean[][]; turn: number; roll: number; phase: 'roll' | 'move' }

function initGS(np: number): GS {
  return {
    pos: Array.from({ length: np }, () => Array(PIECES).fill(0)),
    entered: Array.from({ length: np }, () => Array(PIECES).fill(false)),
    turn: 0, roll: 0, phase: 'roll'
  }
}

// ─── Board layout ─────────────────────────────────────────────────────────────
// 9×9 grid. Cross shape:
//   Top arm    : rows 0-2, cols 3-5
//   Left arm   : rows 3-5, cols 0-2
//   Center     : rows 3-5, cols 3-5
//   Right arm  : rows 3-5, cols 6-8
//   Bottom arm : rows 6-8, cols 3-5
// 40 track squares around the cross; position 40 = center = HOME.

function isOnBoard(r: number, c: number): boolean {
  return (r >= 0 && r <= 2 && c >= 3 && c <= 5) ||  // top arm
         (r >= 3 && r <= 5 && c >= 0 && c <= 8) ||  // middle band (left + center + right)
         (r >= 6 && r <= 8 && c >= 3 && c <= 5)     // bottom arm
}

const CENTER: [number, number] = [4, 4]

// 40 track squares in order (0-indexed = pos-1).
// Clockwise starting from bottom-left of bottom arm.
const FINAL_TRACK: [number, number][] = [
  // ── Bottom arm (enter bottom-left, go up left col, across top, down right col) ──
  [8,3],[7,3],[6,3],   // left col going up
  [6,4],               // top-middle
  [6,5],               // top-right
  [7,5],[8,5],         // right col going down
  [8,4],               // bottom-middle → 8 squares

  // ── Right arm (go right, up, back left) ───────────────────────────────────
  [5,5],[5,6],[5,7],[5,8],  // going right (top row of right arm)
  [4,8],               // middle-right
  [3,8],               // top-right
  [3,7],[3,6],         // top row going left
  [4,6],               // middle-inner → 9 squares (total 17)

  // ── Top arm (go up right col, across top, down left col) ──────────────────
  [3,5],[2,5],[1,5],[0,5],  // right col going up
  [0,4],               // top-middle
  [0,3],               // top-left
  [1,3],[2,3],         // left col going down
  [3,3],               // bottom-left → 9 squares (total 26)

  // ── Left arm (go left, down, back right) ──────────────────────────────────
  [4,3],[4,2],[4,1],[4,0],  // going left
  [5,0],               // bottom-left
  [5,1],[5,2],         // bottom row going right
  [5,3],               // junction → 8 squares (total 34)

  // ── Home straight ─────────────────────────────────────────────────────────
  [5,4],               // sq 35
  [4,5],               // sq 36
  [3,4],               // sq 37
  [4,3],               // sq 38  (reused cell is fine — track wraps)
  [5,4],               // sq 39
  [4,4],               // sq 40 = HOME/center
]

// Safe squares at 0-based indices 0, 7, 16, 25, 33 (roughly every ~8)
const SAFE_INDICES = new Set([0, 7, 16, 25, 33, 39])

// ─── Component ───────────────────────────────────────────────────────────────

export default function Taayam({ config, onGameOver, onExit }: Props) {
  const { play } = useSound()
  const np = 2
  const [gs, setGs] = useState<GS>(() => initGS(np))
  const [msg, setMsg] = useState('Roll the cowries!')
  const [done, setDone] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [cowries, setCowries] = useState<number[]>([0, 0, 0, 0])
  const isBot = config.mode === 'vs-bot'
  const names = Array.from({ length: np }, (_, i) =>
    config.players[i] || (i === 1 && isBot ? 'Bot' : P_NAMES_DEFAULT[i])
  )

  const canMove = (g: GS, p: number, i: number) => {
    const pos = g.pos[p][i]
    if (pos === HOME) return false
    if (!g.entered[p][i]) return g.roll === 1 || g.roll === 4
    return pos + g.roll <= HOME
  }

  const movePiece = (pieceIdx: number) => {
    if (done || gs.phase !== 'move') return
    const t = gs.turn
    if (!canMove(gs, t, pieceIdx)) { play('error'); return }
    const ng: GS = { ...gs, pos: gs.pos.map(a => [...a]), entered: gs.entered.map(a => [...a]) }
    if (!ng.entered[t][pieceIdx]) {
      ng.entered[t][pieceIdx] = true
      ng.pos[t][pieceIdx] = ng.roll
    } else {
      ng.pos[t][pieceIdx] += ng.roll
      if (ng.pos[t][pieceIdx] > HOME) ng.pos[t][pieceIdx] = HOME
    }
    const sq = ng.pos[t][pieceIdx]
    // Capture check (not on safe squares or HOME)
    if (!SAFE_INDICES.has(sq - 1) && sq !== HOME) {
      for (let p2 = 0; p2 < np; p2++) {
        if (p2 === t) continue
        for (let j = 0; j < PIECES; j++) {
          if (ng.pos[p2][j] === sq && ng.entered[p2][j]) {
            ng.pos[p2][j] = 0; ng.entered[p2][j] = false
            play('capture'); setMsg('Captured! 🎉')
          }
        }
      }
    }
    play('move')
    if (ng.pos[t].every(p => p === HOME)) {
      setGs(ng); setDone(true); play('win')
      setTimeout(() => onGameOver({ winner: names[t], gameId: 'taayam', difficulty: config.difficulty }), 600)
      return
    }
    ng.turn = (ng.turn + 1) % np; ng.phase = 'roll'; ng.roll = 0
    setGs(ng); setMsg(`${names[ng.turn]}'s turn — Roll!`)
  }

  const doRoll = () => {
    if (gs.phase !== 'roll' || rolling || done) return
    setRolling(true); play('dice')
    const anim = setInterval(() => {
      setCowries(Array.from({ length: 4 }, () => Math.floor(Math.random() * 2)))
    }, 80)
    setTimeout(() => {
      clearInterval(anim)
      const faces = Array.from({ length: 4 }, () => Math.floor(Math.random() * 2)) as number[]
      const raw = faces.reduce((a, b) => a + b, 0)
      const r = raw === 0 ? 4 : raw === 4 ? 8 : raw
      setCowries(faces)
      const ng: GS = { ...gs, roll: r, phase: 'move' }
      const has = ng.pos[ng.turn].some((_, i) => canMove(ng, ng.turn, i))
      if (!has) {
        setMsg(`Rolled ${r} — no valid moves!`)
        setGs({ ...ng, turn: (ng.turn + 1) % np, phase: 'roll', roll: 0 })
      } else {
        setGs(ng); setMsg(`Rolled ${r}! Select a piece.`)
      }
      setRolling(false)
    }, 500)
  }

  useEffect(() => {
    if (!isBot || gs.turn !== 1 || done) return
    if (gs.phase === 'roll') { const t = setTimeout(doRoll, 600); return () => clearTimeout(t) }
    if (gs.phase === 'move') {
      const t = setTimeout(() => {
        const m = gs.pos[1].map((_, i) => i).filter(i => canMove(gs, 1, i))
        if (m.length) movePiece(m[0])
      }, 700)
      return () => clearTimeout(t)
    }
  }, [gs, isBot, done])

  // ─── Board rendering helpers ───────────────────────────────────────────────

  const trackPos = (pos: number): [number, number] | null => {
    if (pos === 0) return null
    if (pos >= HOME) return CENTER
    return FINAL_TRACK[pos - 1] ?? null
  }

  // "r,c" → [{player, pieceIdx}]
  const tokenMap = new Map<string, { player: number; pieceIdx: number }[]>()
  for (let p = 0; p < np; p++) {
    for (let i = 0; i < PIECES; i++) {
      if (!gs.entered[p][i]) continue
      const cell = trackPos(gs.pos[p][i])
      if (!cell) continue
      const key = `${cell[0]},${cell[1]}`
      if (!tokenMap.has(key)) tokenMap.set(key, [])
      tokenMap.get(key)!.push({ player: p, pieceIdx: i })
    }
  }

  // "r,c" → 0-based track index
  const trackIndexMap = new Map<string, number>()
  FINAL_TRACK.forEach(([r, c], idx) => trackIndexMap.set(`${r},${c}`, idx))

  const CELL = 42 // px per cell
  const BOARD_PX = 9 * CELL

  const renderToken = (player: number, pieceIdx: number, size: number) => {
    const isMovable = gs.phase === 'move' && gs.turn === player && canMove(gs, player, pieceIdx)
    return (
      <button
        key={`tok-${player}-${pieceIdx}`}
        onClick={() => player === gs.turn && gs.phase === 'move' && movePiece(pieceIdx)}
        title={`${names[player]} piece ${pieceIdx + 1}`}
        style={{
          width: size, height: size,
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${P_LIGHT[player]}, ${P_COLORS[player]} 55%, ${P_DARK[player]})`,
          border: `2px solid ${isMovable ? '#ffffff' : P_DARK[player]}`,
          cursor: isMovable ? 'pointer' : 'default',
          boxShadow: isMovable
            ? `0 0 10px ${P_LIGHT[player]}, 0 2px 4px #0009`
            : '0 2px 4px #0008',
          transform: isMovable ? 'scale(1.18)' : 'scale(1)',
          transition: 'all 0.15s',
          flexShrink: 0,
          outline: 'none',
          position: 'relative',
          zIndex: 2,
        }}
      />
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 relative z-10"
         style={{ fontFamily: 'Cinzel, serif' }}>
      {showHelp && <HowToPlay data={HOW_TO_PLAY.taayam} onClose={() => setShowHelp(false)} />}

      {/* ── Header ── */}
      <div className="flex items-center justify-between w-full mb-3" style={{ maxWidth: BOARD_PX }}>
        <button onClick={onExit} className="btn-ghost text-xs py-1.5 px-3">← Exit</button>
        <h2 style={{ fontFamily: 'Cinzel Decorative,serif', color: '#d4a843', fontSize: '1.05rem' }}>
          🎲 Thayam / Taayam
        </h2>
        <button onClick={() => setShowHelp(true)} className="btn-ghost text-xs py-1.5 px-3">📜 Rules</button>
      </div>

      {/* ── Status ── */}
      <div className="text-sm mb-3 px-5 py-1.5 rounded-full" style={{
        background: `${P_COLORS[gs.turn]}22`,
        border: `1px solid ${P_COLORS[gs.turn]}55`,
        color: 'rgba(245,240,232,0.9)',
      }}>
        <span style={{ color: P_LIGHT[gs.turn] }}>{names[gs.turn]}</span>
        <span style={{ color: 'rgba(245,240,232,0.55)' }}> — {msg}</span>
      </div>

      {/* ── BOARD ── */}
      <div style={{ position: 'relative', width: BOARD_PX, height: BOARD_PX, flexShrink: 0 }}>

        {/* SVG layer: cross fill + grid lines + decorations */}
        <svg width={BOARD_PX} height={BOARD_PX}
             style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}>
          <defs>
            <filter id="bshadow">
              <feDropShadow dx="0" dy="5" stdDeviation="8" floodColor="#000" floodOpacity="0.55" />
            </filter>
            {/* Subtle wood-grain texture overlay */}
            <pattern id="grain" patternUnits="userSpaceOnUse" width="4" height="4">
              <rect width="4" height="4" fill="transparent" />
              <path d="M0,2 Q2,1 4,2" stroke="#ffffff08" strokeWidth="0.5" fill="none" />
            </pattern>
          </defs>

          {/* Cross shape */}
          <path
            d={`M${3*CELL},0 H${6*CELL} V${3*CELL} H${9*CELL} V${6*CELL} H${6*CELL} V${9*CELL} H${3*CELL} V${6*CELL} H0 V${3*CELL} H${3*CELL} Z`}
            fill="#1e6e1e"
            stroke="#0c3c0c"
            strokeWidth="3"
            filter="url(#bshadow)"
          />
          <path
            d={`M${3*CELL},0 H${6*CELL} V${3*CELL} H${9*CELL} V${6*CELL} H${6*CELL} V${9*CELL} H${3*CELL} V${6*CELL} H0 V${3*CELL} H${3*CELL} Z`}
            fill="url(#grain)"
          />

          {/* Horizontal grid lines — only within the cross */}
          {[1,2,3,4,5,6,7,8].map(row => {
            const inArm = row <= 2 || row >= 7
            return inArm
              ? <line key={`gh${row}`} x1={3*CELL} y1={row*CELL} x2={6*CELL} y2={row*CELL} stroke="#0c3c0c" strokeWidth="0.7" opacity="0.7" />
              : <line key={`gh${row}`} x1={0} y1={row*CELL} x2={9*CELL} y2={row*CELL} stroke="#0c3c0c" strokeWidth="0.7" opacity="0.7" />
          })}

          {/* Vertical grid lines */}
          {[1,2,3,4,5,6,7,8].map(col => {
            const inArm = col <= 2 || col >= 7
            return inArm
              ? <line key={`gv${col}`} x1={col*CELL} y1={3*CELL} x2={col*CELL} y2={6*CELL} stroke="#0c3c0c" strokeWidth="0.7" opacity="0.7" />
              : <line key={`gv${col}`} x1={col*CELL} y1={0} x2={col*CELL} y2={9*CELL} stroke="#0c3c0c" strokeWidth="0.7" opacity="0.7" />
          })}

          {/* Center area highlight (inner 3×3) */}
          <rect x={3*CELL} y={3*CELL} width={3*CELL} height={3*CELL}
                fill="#1a601a" stroke="#0c3c0c" strokeWidth="1" />

          {/* Center flower / home circle */}
          <circle cx={4.5*CELL} cy={4.5*CELL} r={CELL*1.2}
                  fill="#d4a020" stroke="#8b6010" strokeWidth="2" />
          <circle cx={4.5*CELL} cy={4.5*CELL} r={CELL*0.85}
                  fill="#f0c030" stroke="#a07015" strokeWidth="1.5" />
          <circle cx={4.5*CELL} cy={4.5*CELL} r={CELL*0.45}
                  fill="#ffe060" stroke="#c89020" strokeWidth="1" />
          {/* Petal lines */}
          {[0,60,120,180,240,300].map(deg => {
            const rad = deg * Math.PI / 180
            const cx = 4.5*CELL, cy = 4.5*CELL
            const r1 = CELL*0.5, r2 = CELL*1.1
            return (
              <line key={`petal${deg}`}
                x1={cx + r1*Math.cos(rad)} y1={cy + r1*Math.sin(rad)}
                x2={cx + r2*Math.cos(rad)} y2={cy + r2*Math.sin(rad)}
                stroke="#a07015" strokeWidth="1.2" opacity="0.6" />
            )
          })}

          {/* Safe square X-marks */}
          {FINAL_TRACK.map(([r, c], idx) => {
            if (!SAFE_INDICES.has(idx)) return null
            const x = c * CELL, y = r * CELL
            return (
              <g key={`safe${idx}`}>
                <rect x={x+1} y={y+1} width={CELL-2} height={CELL-2}
                      fill="#e8c030" stroke="#a07010" strokeWidth="1" opacity="0.9" rx="2" />
                <line x1={x+5} y1={y+5} x2={x+CELL-5} y2={y+CELL-5}
                      stroke="#a07010" strokeWidth="1.5" opacity="0.6" />
                <line x1={x+CELL-5} y1={y+5} x2={x+5} y2={y+CELL-5}
                      stroke="#a07010" strokeWidth="1.5" opacity="0.6" />
              </g>
            )
          })}

          {/* Triangle decorations in corner cells of each arm */}
          {/* Bottom arm corners */}
          {([[8,3,'bottom-left'],[8,5,'bottom-right'],[6,3,'top-left'],[6,5,'top-right']] as [number,number,string][]).map(([r,c,pos]) => {
            const x = c*CELL+1, y = r*CELL+1, s = CELL-2
            let pts = ''
            if (pos === 'bottom-left')  pts = `${x},${y+s} ${x+s},${y+s} ${x},${y}`
            if (pos === 'bottom-right') pts = `${x},${y+s} ${x+s},${y+s} ${x+s},${y}`
            if (pos === 'top-left')     pts = `${x},${y} ${x+s},${y} ${x},${y+s}`
            if (pos === 'top-right')    pts = `${x+s},${y} ${x+s},${y+s} ${x},${y}`
            return <polygon key={`tri${r}${c}`} points={pts} fill="#ffffff14" />
          })}
        </svg>

        {/* ── Board cells (interactive layer) ── */}
        {Array.from({ length: 9 }, (_, r) =>
          Array.from({ length: 9 }, (_, c) => {
            if (!isOnBoard(r, c)) return null
            const key = `${r},${c}`
            const isHome = r === 4 && c === 4
            if (isHome) return null  // rendered by SVG center circle above
            const trackIdx = trackIndexMap.get(key) ?? null
            const tokens = tokenMap.get(key) ?? []

            return (
              <div key={key} style={{
                position: 'absolute',
                left: c * CELL + 1, top: r * CELL + 1,
                width: CELL - 2, height: CELL - 2,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 2,
                zIndex: 1,
              }}>
                {/* Faint square number */}
                {trackIdx !== null && tokens.length === 0 && (
                  <span style={{
                    fontSize: 7, color: '#ffffff30',
                    fontFamily: 'sans-serif', userSelect: 'none',
                    position: 'absolute', bottom: 1, right: 2,
                  }}>
                    {trackIdx + 1}
                  </span>
                )}
                {/* Tokens on this cell */}
                {tokens.map(({ player, pieceIdx }) =>
                  renderToken(player, pieceIdx, tokens.length > 1 ? 14 : 24)
                )}
              </div>
            )
          })
        )}

        {/* Tokens on the center HOME */}
        {(() => {
          const homeTokens = tokenMap.get('4,4') ?? []
          if (!homeTokens.length) return null
          return (
            <div style={{
              position: 'absolute',
              left: 4*CELL + 1, top: 4*CELL + 1,
              width: CELL - 2, height: CELL - 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexWrap: 'wrap', gap: 2, zIndex: 3,
            }}>
              {homeTokens.map(({ player, pieceIdx }) => renderToken(player, pieceIdx, 16))}
            </div>
          )
        })()}

        {/* ── Yard corners (pieces not yet on board) ── */}
        {/* P0 — bottom-left corner */}
        <div style={{
          position: 'absolute', left: 0, top: 6*CELL,
          width: 3*CELL, height: 3*CELL,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 6,
          zIndex: 4,
          background: `${P_COLORS[0]}18`,
          borderRadius: 6,
        }}>
          <div style={{ fontSize: 9, color: P_LIGHT[0], fontWeight: 700, letterSpacing: '0.05em', textAlign: 'center', lineHeight: 1.2 }}>
            {names[0]}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
            {Array.from({ length: PIECES }, (_, i) => {
              if (gs.entered[0][i] || gs.pos[0][i] !== 0) return null
              const isMovable = gs.phase === 'move' && gs.turn === 0 && canMove(gs, 0, i)
              return (
                <button key={i} onClick={() => gs.turn === 0 && gs.phase === 'move' && movePiece(i)}
                  style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: `radial-gradient(circle at 35% 35%, ${P_LIGHT[0]}, ${P_COLORS[0]} 55%, ${P_DARK[0]})`,
                    border: `2px solid ${isMovable ? '#fff' : P_DARK[0]}`,
                    cursor: isMovable ? 'pointer' : 'default',
                    boxShadow: isMovable ? `0 0 12px ${P_LIGHT[0]}` : '0 2px 5px #0009',
                    transform: isMovable ? 'scale(1.2)' : 'scale(1)',
                    transition: 'all 0.15s', outline: 'none',
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* P1 — top-right corner */}
        <div style={{
          position: 'absolute', left: 6*CELL, top: 0,
          width: 3*CELL, height: 3*CELL,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 6,
          zIndex: 4,
          background: `${P_COLORS[1]}18`,
          borderRadius: 6,
        }}>
          <div style={{ fontSize: 9, color: P_LIGHT[1], fontWeight: 700, letterSpacing: '0.05em', textAlign: 'center', lineHeight: 1.2 }}>
            {names[1]}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
            {Array.from({ length: PIECES }, (_, i) => {
              if (gs.entered[1][i] || gs.pos[1][i] !== 0) return null
              const isMovable = gs.phase === 'move' && gs.turn === 1 && canMove(gs, 1, i)
              return (
                <button key={i} onClick={() => gs.turn === 1 && gs.phase === 'move' && movePiece(i)}
                  style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: `radial-gradient(circle at 35% 35%, ${P_LIGHT[1]}, ${P_COLORS[1]} 55%, ${P_DARK[1]})`,
                    border: `2px solid ${isMovable ? '#fff' : P_DARK[1]}`,
                    cursor: isMovable ? 'pointer' : 'default',
                    boxShadow: isMovable ? `0 0 12px ${P_LIGHT[1]}` : '0 2px 5px #0009',
                    transform: isMovable ? 'scale(1.2)' : 'scale(1)',
                    transition: 'all 0.15s', outline: 'none',
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* Active player indicator ring around active yard */}
        {gs.turn === 0 && (
          <div style={{
            position: 'absolute', left: -2, top: 6*CELL - 2,
            width: 3*CELL + 4, height: 3*CELL + 4,
            borderRadius: 8, border: `2px solid ${P_COLORS[0]}88`,
            pointerEvents: 'none', zIndex: 5,
            boxShadow: `0 0 12px ${P_COLORS[0]}44`,
            transition: 'opacity 0.3s',
          }} />
        )}
        {gs.turn === 1 && (
          <div style={{
            position: 'absolute', left: 6*CELL - 2, top: -2,
            width: 3*CELL + 4, height: 3*CELL + 4,
            borderRadius: 8, border: `2px solid ${P_COLORS[1]}88`,
            pointerEvents: 'none', zIndex: 5,
            boxShadow: `0 0 12px ${P_COLORS[1]}44`,
            transition: 'opacity 0.3s',
          }} />
        )}
      </div>

      {/* ── COWRIE DICE ── */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {cowries.map((face, i) => (
            <div key={i} style={{
              width: 40, height: 24,
              borderRadius: 14,
              background: face === 1
                ? 'linear-gradient(145deg, #f8f0e0 0%, #d4bc80 100%)'
                : 'linear-gradient(145deg, #2a1a08 0%, #1a0e04 100%)',
              border: `2px solid ${face === 1 ? '#b89030' : '#4a2a0a'}`,
              boxShadow: face === 1
                ? '0 3px 8px #0005, inset 0 1px 3px #fff6'
                : '0 3px 8px #0009',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.1s',
            }}>
              {face === 1 && (
                <div style={{
                  width: 18, height: 7, borderRadius: 5,
                  background: 'rgba(0,0,0,0.25)',
                  boxShadow: 'inset 0 1px 3px #0007',
                }} />
              )}
            </div>
          ))}
          {gs.roll > 0 && (
            <span style={{
              marginLeft: 6, fontSize: 24, fontWeight: 800,
              color: '#fbbf24', fontFamily: 'Cinzel,serif',
              textShadow: '0 0 12px #fbbf2466',
            }}>= {gs.roll}</span>
          )}
        </div>

        {gs.phase === 'roll' && gs.turn === 0 && (
          <button onClick={doRoll} disabled={rolling} className="btn-gold px-8 py-3 text-base mt-1">
            {rolling ? 'Rolling…' : '🐚 Roll Cowries'}
          </button>
        )}
        {gs.phase === 'roll' && gs.turn === 1 && isBot && (
          <div style={{ color: 'rgba(245,240,232,0.4)', fontSize: 13, marginTop: 4 }}>Bot is thinking…</div>
        )}
        {gs.phase === 'move' && !done && (
          <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.45)', marginTop: 2 }}>
            Click a glowing piece to move it
          </div>
        )}
      </div>

      {/* ── PLAYER SCORE CARDS ── */}
      <div className="mt-4 flex gap-4">
        {names.map((name, pi) => {
          const atHome = gs.pos[pi].filter(p => p === HOME).length
          const onBoard = gs.pos[pi].filter((p, i) => gs.entered[pi][i] && p !== HOME).length
          const inYard = PIECES - atHome - onBoard
          return (
            <div key={pi} style={{
              background: `${P_COLORS[pi]}18`,
              border: `1.5px solid ${gs.turn === pi ? P_COLORS[pi] + 'aa' : P_COLORS[pi] + '28'}`,
              borderRadius: 10, padding: '8px 16px', minWidth: 130,
              transition: 'border-color 0.3s',
              boxShadow: gs.turn === pi ? `0 0 12px ${P_COLORS[pi]}33` : 'none',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: P_LIGHT[pi], marginBottom: 5 }}>
                {name}
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'rgba(245,240,232,0.55)' }}>
                <span title="In yard">🏠 {inYard}</span>
                <span title="On board">🎯 {onBoard}</span>
                <span title="Home">✅ {atHome}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                {Array.from({ length: PIECES }, (_, i) => (
                  <div key={i} style={{
                    width: 11, height: 11, borderRadius: '50%',
                    background: gs.pos[pi][i] === HOME
                      ? P_LIGHT[pi]
                      : gs.entered[pi][i]
                      ? P_COLORS[pi]
                      : 'rgba(255,255,255,0.12)',
                    border: `1.5px solid ${P_DARK[pi]}`,
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

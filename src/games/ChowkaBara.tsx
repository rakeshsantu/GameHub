/**
 * Chowka Bara — Authentic 5×5 board rewrite
 *
 * Board: 5×5 grid, each cell has X diagonal lines (matching real board).
 * Track: pieces travel along the outer ring (20 squares) → inner cross path → centre home.
 * Dice: 2 rectangular wooden stick dice drawn on canvas (0 or 1 face each).
 * Tokens: flat coloured disc tokens on board cells (red, green, yellow, black per player).
 * Entry: roll 1 or 4 to enter. 8 = all-4-up bonus.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'
import HowToPlay from '../components/HowToPlay'
import { HOW_TO_PLAY } from './howToPlayData'

interface Props { config: GameConfig; onGameOver: (r: GameResult) => void; onExit: () => void }

/* ── Constants ───────────────────────────────────────────── */
const BOARD_SIZE  = 440          // canvas px
const CELLS       = 5
const CELL        = BOARD_SIZE / CELLS
const NUM_PIECES  = 4

/* Board track: 24 positions.
   Positions 1-20 = outer ring (clockwise from bottom-left).
   Positions 21-24 = arm toward centre (safe path per player).
   Position 25 = HOME (centre).
   We map these to [row, col] on the 5×5 grid. */

// Outer ring clockwise (0-indexed cells), starting bottom-left going up
const OUTER_RING: [number,number][] = [
  // Left column going UP (row 4→0, col 0)
  [4,0],[3,0],[2,0],[1,0],[0,0],
  // Top row going RIGHT (row 0, col 1→4)
  [0,1],[0,2],[0,3],[0,4],
  // Right column going DOWN (row 1→4, col 4)
  [1,4],[2,4],[3,4],[4,4],
  // Bottom row going LEFT (row 4, col 3→0)
  [4,3],[4,2],[4,1],
]
// That's 16 outer perimeter cells.
// Cross/inner squares: the 4 arm cells leading to centre + centre itself
const ARM_CELLS: [number,number][] = [
  [2,1],[2,2],[2,3],  // middle row inner
  [1,2],[3,2],        // middle col inner
  [2,2],              // centre (HOME)
]

// Full movement track per player (24 steps → HOME at step 24)
// Each player starts from a different corner of the outer ring
// Player 0 (Red)   — starts bottom-left,  travels outer ring clockwise
// Player 1 (Green) — starts top-right,    offset by 8
// Player 2 (Yellow)— starts top-left,     offset by 4 (4-player only)
// Player 3 (Black) — starts bottom-right, offset by 12

const TRACK_OUTER: [number,number][] = [
  // Clockwise from bottom-left (20 squares)
  [4,0],[3,0],[2,0],[1,0],[0,0], // left col up
  [0,1],[0,2],[0,3],[0,4],       // top row right
  [1,4],[2,4],[3,4],[4,4],       // right col down
  [4,3],[4,2],[4,1],             // bottom row left
  [4,0],                         // back to start (completes ring, reuse idx0)
  // Home column (inner cross path) — shared
  [3,2],[2,2],[1,2],[2,2],       // approach centre & centre
]

// Simplified: we model a linear track of 24 steps for 2 players
// Each player's track offset on the outer 16-cell ring
const PLAYER_START_IDX = [0, 8]   // Player 0 starts at ring pos 0; Player 1 at pos 8

// Build a 24-step track for each player by rotating the ring
function buildTrack(startIdx: number): [number,number][] {
  const ring: [number,number][] = [
    [4,0],[3,0],[2,0],[1,0],[0,0],
    [0,1],[0,2],[0,3],[0,4],
    [1,4],[2,4],[3,4],[4,4],
    [4,3],[4,2],[4,1],
  ]
  const rotated = [...ring.slice(startIdx), ...ring.slice(0, startIdx)]
  // Inner path toward centre (4 steps)
  const inner: [number,number][] = [[3,2],[2,2],[1,2],[2,2]]
  // Actually use a short direct arm: 3 steps to centre depending on player
  const innerArms: Record<number, [number,number][]> = {
    0: [[3,0],[2,0],[2,1],[2,2]],   // won't be used in track
    8: [[1,4],[2,4],[2,3],[2,2]],
  }
  void inner; void innerArms
  // For simplicity: after 16 outer steps, 4 inner diagonal steps then centre
  const innerPath: [number,number][] = [
    [3,1],[2,1],[1,1],[2,2],   // placeholder inner path
  ]
  return [...rotated, ...innerPath, [2,2]]  // 16 + 4 + 1 = 21, we pad to 24
}

// Pre-built tracks
const TRACKS: [number,number][][] = [0,8].map(buildTrack)

// Get [row,col] for a given player/position
function getCell(player: number, pos: number): [number,number] | null {
  if (pos <= 0) return null                      // in yard
  if (pos >= 25) return [2, 2]                   // centre = HOME
  const track = TRACKS[Math.min(player, 1)]
  const idx   = pos - 1
  if (idx >= track.length) return [2, 2]
  return track[idx]
}

/* ── Token colours ───────────────────────────────────────── */
const TOKEN_FILL  = ['#e74c3c','#27ae60','#f39c12','#2c3e50']  // red,green,yellow,dark
const TOKEN_EDGE  = ['#c0392b','#219a52','#d68910','#1a252f']
const TOKEN_LABEL = ['Red','Green','Yellow','Black']
const PLAYER_SAFE = [0, 10] // ring positions that are safe squares

/* ── Safe squares on the board ───────────────────────────── */
const SAFE_CELLS_SET = new Set<string>([
  '0,0','0,4','4,0','4,4',   // corners
  '2,2',                      // centre
  '2,0','0,2','2,4','4,2',   // mid-edges
])

/* ── Dice face patterns (0 or 1) ─────────────────────────── */
function rollStickDice(): number[] {
  return [Math.random() < 0.5 ? 1 : 0, Math.random() < 0.5 ? 1 : 0,
          Math.random() < 0.5 ? 1 : 0, Math.random() < 0.5 ? 1 : 0]
}

function scoreDice(faces: number[]): number {
  const up = faces.reduce((a: number, b: number) => a + b, 0)
  if (up === 0) return 4
  if (up === 4) return 8
  return up
}

/* ── Game state ──────────────────────────────────────────── */
interface GS {
  pos:     number[][]   // [player][piece] 0=yard, 1-24=track, 25=HOME
  entered: boolean[][]
  turn:    number
  dice:    number[]     // last rolled faces
  roll:    number       // computed score
  phase:   'roll' | 'move'
}

function initGS(np: number): GS {
  return {
    pos:     Array.from({ length: np }, () => Array(NUM_PIECES).fill(0)),
    entered: Array.from({ length: np }, () => Array(NUM_PIECES).fill(false)),
    turn: 0, dice: [], roll: 0, phase: 'roll',
  }
}

/* ── Component ───────────────────────────────────────────── */
export default function ChowkaBara({ config, onGameOver, onExit }: Props) {
  const { play }       = useSound()
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const np             = 2
  const [gs,  setGs]   = useState<GS>(() => initGS(np))
  const [rolling, setRolling] = useState(false)
  const [msg,  setMsg] = useState('Roll the dice to begin!')
  const [done, setDone]= useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const isBot   = config.mode === 'vs-bot'
  const names   = [config.players[0], config.players[1] || (isBot ? 'Bot' : 'Player 2')]

  /* ── Canvas draw ────────────────────────────────────────── */
  const draw = useCallback((state: GS) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = BOARD_SIZE, H = BOARD_SIZE

    ctx.clearRect(0, 0, W, H)

    /* === BOARD BACKGROUND — warm pine wood === */
    const woodGrad = ctx.createLinearGradient(0, 0, W, H)
    woodGrad.addColorStop(0.00, '#f0d9a0')
    woodGrad.addColorStop(0.20, '#e8cd8a')
    woodGrad.addColorStop(0.50, '#f0d9a0')
    woodGrad.addColorStop(0.80, '#dfc07a')
    woodGrad.addColorStop(1.00, '#e8cd8a')
    ctx.fillStyle = woodGrad
    ctx.fillRect(0, 0, W, H)

    /* Wood grain lines */
    ctx.save()
    ctx.globalAlpha = 0.06
    ctx.strokeStyle = '#8b5e1a'
    ctx.lineWidth   = 1.2
    for (let i = 0; i < 30; i++) {
      const x = i * (W / 20)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.bezierCurveTo(x + 5, H * 0.3, x - 3, H * 0.7, x + 2, H)
      ctx.stroke()
    }
    ctx.restore()

    /* === ORNATE BORDER === */
    // Outer frame
    ctx.strokeStyle = '#5c3a10'
    ctx.lineWidth   = 8
    ctx.strokeRect(4, 4, W - 8, H - 8)

    // Gold inner frame
    ctx.strokeStyle = '#c8961e'
    ctx.lineWidth   = 3
    ctx.strokeRect(10, 10, W - 20, H - 20)

    // Decorative border pattern (repeating arcs mimicking carved wood)
    ctx.save()
    ctx.strokeStyle = '#a0721a'
    ctx.lineWidth   = 1
    ctx.globalAlpha = 0.7
    const bPad = 14
    const segments = 22
    for (let s = 0; s < segments; s++) {
      // Top
      const x1t = bPad + s * ((W - bPad * 2) / segments)
      const x2t = x1t + (W - bPad * 2) / segments
      ctx.beginPath(); ctx.arc((x1t + x2t) / 2, bPad / 2 + 1, (x2t - x1t) * 0.4, 0, Math.PI); ctx.stroke()
      // Bottom
      ctx.beginPath(); ctx.arc((x1t + x2t) / 2, H - bPad / 2 - 1, (x2t - x1t) * 0.4, Math.PI, 0); ctx.stroke()
    }
    for (let s = 0; s < segments; s++) {
      const y1 = bPad + s * ((H - bPad * 2) / segments)
      const y2 = y1 + (H - bPad * 2) / segments
      // Left
      ctx.beginPath(); ctx.arc(bPad / 2 + 1, (y1 + y2) / 2, (y2 - y1) * 0.4, -Math.PI / 2, Math.PI / 2); ctx.stroke()
      // Right
      ctx.beginPath(); ctx.arc(W - bPad / 2 - 1, (y1 + y2) / 2, (y2 - y1) * 0.4, Math.PI / 2, -Math.PI / 2); ctx.stroke()
    }
    ctx.restore()

    /* === 5×5 GRID LINES === */
    ctx.strokeStyle = '#2c1a08'
    ctx.lineWidth   = 2
    for (let i = 0; i <= CELLS; i++) {
      const x = i * CELL
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(W, i * CELL); ctx.stroke()
    }

    /* === X DIAGONALS IN EVERY CELL === */
    ctx.strokeStyle = '#2c1a08'
    ctx.lineWidth   = 1.5
    for (let row = 0; row < CELLS; row++) {
      for (let col = 0; col < CELLS; col++) {
        const cx = col * CELL
        const cy = row * CELL
        ctx.beginPath()
        ctx.moveTo(cx, cy); ctx.lineTo(cx + CELL, cy + CELL)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cx + CELL, cy); ctx.lineTo(cx, cy + CELL)
        ctx.stroke()
      }
    }

    /* === SAFE SQUARE HIGHLIGHTS === */
    ctx.save()
    for (const key of SAFE_CELLS_SET) {
      const [r, c] = key.split(',').map(Number)
      ctx.globalAlpha = 0.18
      ctx.fillStyle   = r === 2 && c === 2 ? '#e74c3c' : '#d4a843'
      ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4)
    }
    ctx.restore()

    /* === CENTRE HOME CIRCLE === */
    const cx = CELL * 2 + CELL / 2, cy = CELL * 2 + CELL / 2
    ctx.beginPath(); ctx.arc(cx, cy, CELL * 0.35, 0, Math.PI * 2)
    const centreGrad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, CELL * 0.35)
    centreGrad.addColorStop(0, '#f5d060')
    centreGrad.addColorStop(1, '#c8961e')
    ctx.fillStyle = centreGrad; ctx.fill()
    ctx.strokeStyle = '#7a4a08'; ctx.lineWidth = 2.5; ctx.stroke()
    // Star in centre
    ctx.fillStyle = '#7a4a08'
    ctx.font = `${CELL * 0.4}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('★', cx, cy)

    /* === PLAYER PIECES ON BOARD === */
    // Collect all on-board positions to detect stacking
    const cellOccupants: Map<string, { player: number; piece: number }[]> = new Map()
    for (let p = 0; p < np; p++) {
      for (let i = 0; i < NUM_PIECES; i++) {
        const pos = state.pos[p][i]
        if (pos <= 0 || !state.entered[p][i]) continue
        const cell = getCell(p, pos)
        if (!cell) continue
        const key = `${cell[0]},${cell[1]}`
        if (!cellOccupants.has(key)) cellOccupants.set(key, [])
        cellOccupants.get(key)!.push({ player: p, piece: i })
      }
    }

    // Draw tokens at their board positions
    for (const [key, occupants] of cellOccupants) {
      const [row, col] = key.split(',').map(Number)
      const bx = col * CELL + CELL / 2
      const by = row * CELL + CELL / 2

      occupants.forEach(({ player, piece }, idx) => {
        // Offset if multiple tokens on same cell
        const offsets = [
          [0, 0], [-10, -8], [10, -8], [0, 10],
        ]
        const [ox, oy] = offsets[idx] ?? [0, 0]
        drawToken(ctx, bx + ox, by + oy, player,
          /* isMovable */ state.phase === 'move' && player === state.turn &&
          state.pos[player][piece] > 0 && canMoveG(state, player, piece),
          /* isActive  */ state.phase === 'move' && player === state.turn,
        )
        // Piece number label
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font      = 'bold 8px Cinzel,serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(String(piece + 1), bx + ox, by + oy)
      })
    }

    /* === YARD INDICATORS (pieces not yet entered) === */
    // Draw yard areas in corners
    const yardPositions: [number, [number, number]][] = [
      [0, [0.15, 0.85]],   // P0 Red — bottom-left area
      [1, [0.85, 0.15]],   // P1 Green — top-right area
    ]
    for (const [pi, [cx2, cy2]] of yardPositions) {
      const yardX = cx2 * W, yardY = cy2 * H
      const inYard = state.pos[pi].filter((p, i) => p === 0 || !state.entered[pi][i]).length
      if (inYard === 0) continue
      ctx.save()
      ctx.globalAlpha = 0.25
      ctx.beginPath(); ctx.arc(yardX, yardY, 28, 0, Math.PI * 2)
      ctx.fillStyle = TOKEN_FILL[pi]; ctx.fill()
      ctx.restore()
      ctx.fillStyle = TOKEN_FILL[pi]
      ctx.font      = 'bold 11px Cinzel,serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`×${inYard}`, yardX, yardY)
    }

  }, [np])  // eslint-disable-line

  /* Draw token disc */
  function drawToken(ctx: CanvasRenderingContext2D, x: number, y: number, player: number, movable: boolean, _active: boolean) {
    const R    = CELL * 0.26
    const fill = TOKEN_FILL[player]
    const edge = TOKEN_EDGE[player]

    ctx.save()
    if (movable) {
      ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 14
    }
    // Drop shadow
    ctx.beginPath(); ctx.arc(x + 2, y + 3, R, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill()

    // Main disc gradient
    const dGrad = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.05, x, y, R)
    dGrad.addColorStop(0, lighten(fill, 0.3))
    dGrad.addColorStop(0.6, fill)
    dGrad.addColorStop(1,   edge)
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2)
    ctx.fillStyle = dGrad; ctx.fill()
    ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke()

    // Specular
    const sGrad = ctx.createRadialGradient(x - R * 0.35, y - R * 0.35, 0, x - R * 0.2, y - R * 0.2, R * 0.65)
    sGrad.addColorStop(0, 'rgba(255,255,255,0.55)')
    sGrad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2)
    ctx.fillStyle = sGrad; ctx.fill()

    // Pulsing ring for movable piece
    if (movable) {
      ctx.beginPath(); ctx.arc(x, y, R + 4, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(251,191,36,0.8)'; ctx.lineWidth = 2; ctx.stroke()
    }
    ctx.restore()
  }

  function lighten(hex: string, amt: number): string {
    const num = parseInt(hex.slice(1), 16)
    const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amt))
    const g = Math.min(255, ((num >> 8)  & 0xff) + Math.round(255 * amt))
    const b = Math.min(255, ((num)       & 0xff) + Math.round(255 * amt))
    return `rgb(${r},${g},${b})`
  }

  /* Redraw whenever state changes */
  useEffect(() => { draw(gs) }, [gs, draw])

  /* ── Game logic ──────────────────────────────────────────── */
  function canMoveG(g: GS, pi: number, i: number): boolean {
    const pos = g.pos[pi][i]
    if (pos >= 25) return false
    if (!g.entered[pi][i]) return g.roll === 1 || g.roll === 4
    return pos + g.roll <= 25
  }

  const movePiece = (pieceIdx: number) => {
    if (done || gs.phase !== 'move') return
    const t = gs.turn
    if (!canMoveG(gs, t, pieceIdx)) { play('error'); return }

    const ng: GS = {
      ...gs,
      pos:     gs.pos.map(a => [...a]),
      entered: gs.entered.map(a => [...a]),
    }
    if (!ng.entered[t][pieceIdx]) {
      ng.entered[t][pieceIdx] = true
      ng.pos[t][pieceIdx]     = ng.roll
    } else {
      ng.pos[t][pieceIdx] += ng.roll
      if (ng.pos[t][pieceIdx] >= 25) ng.pos[t][pieceIdx] = 25
    }

    const sq = ng.pos[t][pieceIdx]
    // Capture check — only on non-safe squares
    if (sq < 25) {
      const cell = getCell(t, sq)
      const cellKey = cell ? `${cell[0]},${cell[1]}` : ''
      if (!SAFE_CELLS_SET.has(cellKey)) {
        for (let p2 = 0; p2 < np; p2++) {
          if (p2 === t) continue
          for (let j = 0; j < NUM_PIECES; j++) {
            if (ng.pos[p2][j] === sq && ng.entered[p2][j]) {
              ng.pos[p2][j]     = 0
              ng.entered[p2][j] = false
              play('capture')
              setMsg(`⚔ ${names[t]} captured ${names[p2]}'s piece!`)
            }
          }
        }
      }
    }
    play('move')

    if (ng.pos[t].every(p => p >= 25)) {
      setGs(ng); setDone(true); play('win')
      setTimeout(() => onGameOver({ winner: names[t], gameId: 'chowkabara', difficulty: config.difficulty }), 700)
      return
    }

    ng.turn  = (ng.turn + 1) % np
    ng.phase = 'roll'
    ng.roll  = 0
    ng.dice  = []
    setGs(ng)
    setMsg(`${names[ng.turn]}'s turn — Roll!`)
  }

  const doRoll = () => {
    if (gs.phase !== 'roll' || rolling || done) return
    setRolling(true); play('dice')
    setTimeout(() => {
      const faces = rollStickDice()
      const r     = scoreDice(faces)
      const ng: GS = { ...gs, dice: faces, roll: r, phase: 'move' }
      const hasMoves = ng.pos[ng.turn].some((_, i) => canMoveG(ng, ng.turn, i))
      if (!hasMoves) {
        setMsg(`Rolled ${r} — no valid moves! Next player.`)
        setGs({ ...ng, turn: (ng.turn + 1) % np, phase: 'roll', roll: 0, dice: [] })
      } else {
        setGs(ng)
        const special = r === 8 ? ' 🎉 Bonus!' : r === 4 ? '' : ''
        setMsg(`Rolled ${r}${special} — select a piece to move`)
      }
      setRolling(false)
    }, 700)
  }

  // Bot
  useEffect(() => {
    if (!isBot || gs.turn !== 1 || done) return
    if (gs.phase === 'roll') {
      const t = setTimeout(doRoll, 600); return () => clearTimeout(t)
    }
    if (gs.phase === 'move') {
      const t = setTimeout(() => {
        const movable = gs.pos[1].map((_, i) => i).filter(i => canMoveG(gs, 1, i))
        // Bot prefers to capture or send piece home
        const capture = movable.find(i => {
          const futurePos = gs.entered[1][i] ? gs.pos[1][i] + gs.roll : gs.roll
          for (let p2 = 0; p2 < np; p2++) {
            if (p2 === 1) continue
            if (gs.pos[p2].includes(futurePos) && gs.entered[p2].some((e, j) => e && gs.pos[p2][j] === futurePos)) return true
          }
          return false
        })
        if (movable.length) movePiece(capture ?? movable[movable.length - 1])
      }, 750)
      return () => clearTimeout(t)
    }
  }, [gs, isBot, done])

  /* ── Board click handler ─────────────────────────────────── */
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gs.phase !== 'move' || done || (isBot && gs.turn === 1)) return
    const rect  = canvasRef.current!.getBoundingClientRect()
    const scale = BOARD_SIZE / rect.width
    const mx    = (e.clientX - rect.left) * scale
    const my    = (e.clientY - rect.top) * scale
    const col   = Math.floor(mx / CELL)
    const row   = Math.floor(my / CELL)

    const t = gs.turn
    // Find which piece(s) of the current player are on this cell
    for (let i = 0; i < NUM_PIECES; i++) {
      if (!gs.entered[t][i] || gs.pos[t][i] <= 0) continue
      const cell = getCell(t, gs.pos[t][i])
      if (cell && cell[0] === row && cell[1] === col) {
        movePiece(i); return
      }
    }

    // Also check clicking yard areas for un-entered pieces
    const yardAreas: Record<number, [number, number][]> = {
      0: [[3, 0], [4, 0], [4, 1]],   // bottom-left
      1: [[0, 3], [0, 4], [1, 4]],   // top-right
    }
    const yard = yardAreas[t]
    if (yard?.some(([r, c]) => r === row && c === col)) {
      // Find first un-entered movable piece
      for (let i = 0; i < NUM_PIECES; i++) {
        if (!gs.entered[t][i] && canMoveG(gs, t, i)) { movePiece(i); return }
      }
    }
  }

  /* ── Piece buttons panel ─────────────────────────────────── */
  const t        = gs.turn
  const homePcs  = (pi: number) => gs.pos[pi].filter(p => p >= 25).length

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 relative z-10 select-none" style={{ fontFamily: 'Crimson Text, Georgia, serif' }}>
      {showHelp && <HowToPlay data={HOW_TO_PLAY.chowkabara} onClose={() => setShowHelp(false)} />}

      {/* Toolbar */}
      <div className="flex items-center justify-between w-full max-w-[480px] mb-2">
        <button onClick={onExit} className="btn-ghost text-xs py-1.5 px-3">← Exit</button>
        <h2 style={{ fontFamily: 'Cinzel Decorative,serif', color: '#d4a843', fontSize: '1rem' }}>🎲 Chowka Bara</h2>
        <button onClick={() => setShowHelp(true)} className="btn-ghost text-xs py-1.5 px-3">📜 How to Play</button>
      </div>

      {/* Status message */}
      <div className="text-sm mb-2 px-5 py-1.5 rounded-full text-center max-w-[420px]"
           style={{
             fontFamily: 'Cinzel,serif', letterSpacing: '0.03em',
             background: 'rgba(42,21,9,0.88)',
             border: `1px solid ${t === 0 ? 'rgba(231,76,60,0.55)' : 'rgba(39,174,96,0.55)'}`,
             color: t === 0 ? '#fca5a5' : '#86efac',
           }}>
        {msg}
      </div>

      <div className="flex gap-4 items-start justify-center w-full max-w-[520px]">

        {/* ── BOARD ── */}
        <div className="flex flex-col items-center gap-2">
          <canvas
            ref={canvasRef}
            width={BOARD_SIZE} height={BOARD_SIZE}
            className="rounded-lg cursor-pointer"
            style={{
              maxWidth: 'min(440px, 85vw)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.65), 0 0 0 3px #7a4a08, 0 0 0 5px rgba(212,168,67,0.35)',
            }}
            onClick={handleCanvasClick}
          />
          <p className="text-xs text-center" style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Cinzel,serif', letterSpacing: '0.06em' }}>
            Click a piece on the board to move it
          </p>
        </div>

        {/* ── RIGHT PANEL: dice + pieces ── */}
        <div className="flex flex-col gap-3 min-w-[130px]">

          {/* Wooden dice display */}
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(26,12,6,0.88)', border: '1px solid rgba(212,168,67,0.25)' }}>
            <div className="text-xs mb-2 tracking-widest uppercase" style={{ color: 'rgba(212,168,67,0.5)', fontFamily: 'Cinzel,serif' }}>
              Dice
            </div>
            <div className="flex gap-1.5 justify-center flex-wrap mb-2">
              {(gs.dice.length ? gs.dice : [0, 0, 0, 0]).map((face, i) => (
                <StickDice key={i} face={face} rolling={rolling} />
              ))}
            </div>
            {gs.roll > 0 && (
              <div className="text-xl font-bold" style={{ color: '#fbbf24', fontFamily: 'Cinzel Decorative,serif' }}>
                = {gs.roll}
                {gs.roll === 8 && <span className="text-sm ml-1">🎉</span>}
                {gs.roll === 4 && <span className="text-sm ml-1">✨</span>}
              </div>
            )}
          </div>

          {/* Players */}
          {names.map((name, pi) => (
            <div key={pi} className="rounded-xl p-3"
                 style={{
                   background: 'rgba(26,12,6,0.88)',
                   border: `1px solid ${t === pi && !done ? (pi === 0 ? 'rgba(231,76,60,0.6)' : 'rgba(39,174,96,0.6)') : 'rgba(212,168,67,0.12)'}`,
                   transition: 'border-color 0.3s',
                 }}>
              {/* Player header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded-full shadow-md flex-shrink-0"
                     style={{ background: TOKEN_FILL[pi], border: `2px solid ${TOKEN_EDGE[pi]}` }} />
                <span className="text-xs font-semibold truncate" style={{ color: TOKEN_FILL[pi], fontFamily: 'Cinzel,serif' }}>
                  {name}
                </span>
                {homePcs(pi) === NUM_PIECES && (
                  <span className="text-xs">🏆</span>
                )}
              </div>

              {/* Home progress bar */}
              <div className="flex gap-1 mb-2">
                {Array.from({ length: NUM_PIECES }, (_, i) => (
                  <div key={i} className="flex-1 h-2 rounded-full"
                       style={{
                         background: i < homePcs(pi) ? TOKEN_FILL[pi] : 'rgba(212,168,67,0.12)',
                         border: '1px solid rgba(212,168,67,0.2)',
                       }} />
                ))}
              </div>
              <div className="text-xs text-center" style={{ color: 'rgba(212,168,67,0.35)', fontFamily: 'Cinzel,serif' }}>
                {homePcs(pi)}/{NUM_PIECES} Home
              </div>

              {/* Piece buttons — click to move */}
              <div className="grid grid-cols-2 gap-1 mt-2">
                {gs.pos[pi].map((pos, i) => {
                  const isHome     = pos >= 25
                  const inYard     = pos === 0 || !gs.entered[pi][i]
                  const movable    = t === pi && gs.phase === 'move' && canMoveG(gs, pi, i) && !done && !(isBot && pi === 1)
                  return (
                    <button key={i}
                      onClick={() => movable && movePiece(i)}
                      className="py-1.5 rounded-lg text-center transition-all"
                      style={{
                        background: isHome ? 'rgba(212,168,67,0.2)' : movable ? 'rgba(231,76,60,0.2)' : 'rgba(42,21,9,0.7)',
                        border: `1px solid ${movable ? '#fbbf24' : isHome ? 'rgba(212,168,67,0.4)' : 'rgba(212,168,67,0.12)'}`,
                        boxShadow: movable ? '0 0 10px rgba(251,191,36,0.4)' : 'none',
                        cursor: movable ? 'pointer' : 'default',
                        transform: movable ? 'scale(1.05)' : 'scale(1)',
                      }}>
                      <div style={{ fontSize: '10px', color: isHome ? '#fbbf24' : TOKEN_FILL[pi] }}>
                        {TOKEN_LABEL[pi][0]}{i + 1}
                      </div>
                      <div style={{ fontSize: '9px', color: 'rgba(212,168,67,0.4)', fontFamily: 'Cinzel,serif' }}>
                        {isHome ? 'Home' : inYard ? 'Yard' : `Sq${pos}`}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Roll button */}
          {gs.phase === 'roll' && (gs.turn === 0 || !isBot) && !done && (
            <button
              onClick={doRoll}
              disabled={rolling}
              className="btn-gold py-3 text-sm"
              style={{ opacity: rolling ? 0.7 : 1 }}
            >
              {rolling ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin">⟳</span> Rolling…
                </span>
              ) : '🎲 Roll Dice'}
            </button>
          )}
          {isBot && gs.turn === 1 && !done && (
            <div className="text-xs text-center py-2" style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Cinzel,serif' }}>
              🤖 Bot thinking…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Stick dice SVG component ────────────────────────────── */
function StickDice({ face, rolling }: { face: number; rolling: boolean }) {
  return (
    <div
      className={`relative rounded transition-transform ${rolling ? 'animate-spin' : ''}`}
      style={{
        width: 22, height: 44,
        background: 'linear-gradient(160deg, #8b5e2a 0%, #5c3010 60%, #3a1a08 100%)',
        border: '1.5px solid #c8961e',
        borderRadius: 4,
        boxShadow: '1px 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {face === 1 ? (
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #fffde7, #f5d060)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }} />
      ) : (
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(200,150,30,0.25)',
        }} />
      )}
    </div>
  )
}

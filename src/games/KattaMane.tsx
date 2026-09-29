/**
 * Katta Mane / Ashta Chamma / Pallanguzhi — Authentic South Indian board game
 *
 * Board: 5×5 grid with X-diagonal marks on ALL cells (matching real jute board).
 *        Pieces travel around the outer ring → inner cross arms → centre Home.
 * Dice:  4 cowrie shells (white shells, each face-up = 1 pt; 0 = 4; all 4 = 8).
 * Tokens: 4 dome-shaped capsule pieces per player (Red, Yellow, Green, Orange).
 * Entry: Roll 1 or 4 to enter a piece. 8 = bonus move.
 * Layout: Side-by-side with responsive board for mobile support.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'
import HowToPlay from '../components/HowToPlay'
import { HOW_TO_PLAY } from './howToPlayData'

interface Props { config: GameConfig; onGameOver: (r: GameResult) => void; onExit: () => void }

/* ─────────────────────────────────────────────────────────────
   BOARD GEOMETRY - RESPONSIVE
   Base size scales down on mobile
   ───────────────────────────────────────────────────────────── */
const BASE_BOARD_SIZE = 460
const CELLS           = 5
const NUM_PIECES      = 4

/** Outer ring (clockwise, 20 squares, 0-indexed row/col) */
const OUTER_RING: [number, number][] = [
  // Bottom row LEFT → (starting corner: bottom-left)
  [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
  // Right col UP
  [3, 4], [2, 4], [1, 4], [0, 4],
  // Top row RIGHT → LEFT
  [0, 3], [0, 2], [0, 1], [0, 0],
  // Left col DOWN
  [1, 0], [2, 0], [3, 0],
]  // 16 perimeter cells (corners shared)

/** Build a 24-step track for a player starting at a given ring index */
function buildTrack(startIdx: number, innerArm: [number, number][]): [number, number][] {
  const n = OUTER_RING.length
  const rotated: [number, number][] = []
  for (let i = 0; i < n; i++) rotated.push(OUTER_RING[(startIdx + i) % n])
  // 4 steps along inner arm toward centre (step 17–20 → inner), then HOME
  return [...rotated, ...innerArm, [2, 2]]  // 16 + 4 + 1 = 21... pad to 25
}

/*
  Player start positions on the outer ring (index into OUTER_RING):
    P0 Red    → bottom-left  [4,0]  idx 0
    P1 Yellow → bottom-right [4,4]  idx 4
    P2 Green  → top-right    [0,4]  idx 8
    P3 Orange → top-left     [0,0]  idx 12
  Inner arm paths toward [2,2] centre:
    P0: go up left col  → [3,0],[3,1],[3,2],[2,2]  — actually: after outer ring done, use middle col
    P1: go up right col → [3,4],[3,3],[3,2],[2,2]
    P2: go down right   → [1,4],[1,3],[1,2],[2,2]  — wrong; use middle row approach
    P3: go down left    → [1,0],[1,1],[1,2],[2,2]
*/
const INNER_ARMS: [number, number][][] = [
  [[3, 1], [3, 2], [2, 2], [2, 2]],   // P0
  [[3, 3], [3, 2], [2, 2], [2, 2]],   // P1
  [[1, 3], [1, 2], [2, 2], [2, 2]],   // P2
  [[1, 1], [1, 2], [2, 2], [2, 2]],   // P3
]
const PLAYER_START_IDX = [0, 4, 8, 12]

const TRACKS: [number, number][][] = PLAYER_START_IDX.map((si, pi) =>
  buildTrack(si, INNER_ARMS[pi])
)

function getCell(player: number, pos: number): [number, number] | null {
  if (pos <= 0) return null
  if (pos >= 25) return [2, 2]
  const track = TRACKS[Math.min(player, 3)]
  const idx   = pos - 1
  return idx < track.length ? track[idx] : [2, 2]
}

/* ─────────────────────────────────────────────────────────────
   COLOURS  (Red · Yellow · Green · Orange matching image)
   ───────────────────────────────────────────────────────────── */
const TOKEN_FILL  = ['#dc2626', '#f59e0b', '#16a34a', '#ea580c']
const TOKEN_EDGE  = ['#991b1b', '#b45309', '#14532d', '#9a3412']
const TOKEN_LIGHT = ['#fca5a5', '#fde68a', '#86efac', '#fdba74']
const TOKEN_LABEL = ['Red', 'Yellow', 'Green', 'Orange']

/* Safe squares — corners + centre + cross midpoints */
const SAFE_SET = new Set<string>([
  '0,0', '0,4', '4,0', '4,4',   // corners
  '2,0', '0,2', '2,4', '4,2',   // edge midpoints
  '2,2',                          // centre HOME
])

/* ─────────────────────────────────────────────────────────────
   COWRIE SHELL DICE
   4 shells: face-up count → score (0 up = 4, all 4 = 8)
   ───────────────────────────────────────────────────────────── */
function rollCowries(): boolean[] {
  return Array.from({ length: 4 }, () => Math.random() > 0.5)
}

function scoreCowries(faces: boolean[]): number {
  const up = faces.filter(Boolean).length
  if (up === 0) return 4
  if (up === 4) return 8
  return up
}

/* ─────────────────────────────────────────────────────────────
   GAME STATE
   ───────────────────────────────────────────────────────────── */
interface GS {
  pos:     number[][]     // [player][piece] 0=yard, 1–24=track, 25=HOME
  entered: boolean[][]
  turn:    number
  cowries: boolean[]
  roll:    number
  phase:   'roll' | 'move'
  selected: number        // selected piece index (-1 = none)
}

function initGS(np: number): GS {
  return {
    pos:      Array.from({ length: np }, () => Array(NUM_PIECES).fill(0)),
    entered:  Array.from({ length: np }, () => Array(NUM_PIECES).fill(false)),
    turn: 0, cowries: [], roll: 0, phase: 'roll', selected: -1,
  }
}

/* ─────────────────────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────────────────────── */
export default function KattaMane({ config, onGameOver, onExit }: Props) {
  const { play }       = useSound()
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const containerRef   = useRef<HTMLDivElement>(null)
  
  /* Dynamic board size based on container width */
  const [boardSize, setBoardSize] = useState(BASE_BOARD_SIZE)
  
  const np             = config.mode === 'multiplayer' && config.players.length >= 3
    ? Math.min(config.players.length, 4)
    : 2

  const [gs,       setGs]       = useState<GS>(() => initGS(np))
  const [rolling,  setRolling]  = useState(false)
  const [msg,      setMsg]      = useState("Roll the cowrie shells to begin!")
  const [done,     setDone]     = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const isBot  = config.mode === 'vs-bot'
  const names  = Array.from({ length: np }, (_, i) =>
    config.players[i] || (i === 1 && isBot ? 'Bot' : `Player ${i + 1}`)
  )
  
  /* Responsive board sizing */
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return
      const containerWidth = containerRef.current.offsetWidth
      // Calculate board size: max 460px, min 320px, leave space for side panel on desktop
      const isMobile = window.innerWidth < 768
      const maxSize = isMobile ? Math.min(containerWidth - 32, BASE_BOARD_SIZE) : BASE_BOARD_SIZE
      const newSize = Math.max(320, Math.min(maxSize, containerWidth - (isMobile ? 32 : 180)))
      setBoardSize(newSize)
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  /* ───────────────────────────────────────────────────────────
     CANVAS DRAW - with dynamic sizing
     ─────────────────────────────────────────────────────────── */
  const draw = useCallback((state: GS) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = boardSize, H = boardSize
    const CELL = W / CELLS

    ctx.clearRect(0, 0, W, H)

    /* ── JUTE / TAN FABRIC BACKGROUND ── */
    const bgGrad = ctx.createLinearGradient(0, 0, W, H)
    bgGrad.addColorStop(0.00, '#d4c27a')
    bgGrad.addColorStop(0.25, '#cabb6e')
    bgGrad.addColorStop(0.50, '#d8c97f')
    bgGrad.addColorStop(0.75, '#c5b565')
    bgGrad.addColorStop(1.00, '#d2c175')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    /* Fabric texture — horizontal woven lines */
    ctx.save()
    ctx.globalAlpha = 0.08
    ctx.strokeStyle = '#7a6020'
    ctx.lineWidth   = 0.8
    for (let y = 0; y < H; y += 3) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }
    ctx.globalAlpha = 0.05
    ctx.strokeStyle = '#5a4010'
    for (let x = 0; x < W; x += 3) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    ctx.restore()

    /* ── OUTER BORDER (stitched edge look) ── */
    // Outer dark border
    ctx.fillStyle = '#6b4c12'
    ctx.fillRect(0, 0, W, 10)
    ctx.fillRect(0, H - 10, W, 10)
    ctx.fillRect(0, 0, 10, H)
    ctx.fillRect(W - 10, 0, 10, H)

    // Stitching dots along border
    ctx.fillStyle = '#d4c27a'
    ctx.globalAlpha = 0.6
    for (let i = 20; i < W - 20; i += 12) {
      ctx.beginPath(); ctx.arc(i, 5, 1.5, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(i, H - 5, 1.5, 0, Math.PI * 2); ctx.fill()
    }
    for (let i = 20; i < H - 20; i += 12) {
      ctx.beginPath(); ctx.arc(5, i, 1.5, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(W - 5, i, 1.5, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1

    /* ── BOARD LABEL ── */
    ctx.font      = 'bold 13px Cinzel Decorative, Cinzel, serif'
    ctx.fillStyle = '#2c1a08'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 0.75
    ctx.fillText('ASHTA CHAMMA', W / 2, H - 14)
    ctx.globalAlpha = 1

    /* Side labels */
    ctx.save()
    ctx.font = 'bold 8px Cinzel, serif'
    ctx.fillStyle = '#3a2008'
    ctx.globalAlpha = 0.5
    ctx.textBaseline = 'middle'
    // Left side vertical
    ctx.translate(6, H / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText('KATTA MANE', 0, 0)
    ctx.restore()

    /* ── GRID LINES (5×5 on the inner board area) ── */
    const pad   = 12
    const innerW = W - pad * 2
    const innerH = H - pad * 2 - 16  // leave room for bottom label
    const cellW  = innerW / CELLS
    const cellH  = innerH / CELLS

    ctx.strokeStyle = '#1a0e04'
    ctx.lineWidth   = 2.5
    for (let i = 0; i <= CELLS; i++) {
      const x = pad + i * cellW
      const y = pad + i * cellH
      ctx.beginPath(); ctx.moveTo(x, pad);         ctx.lineTo(x, pad + innerH); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(pad, y);          ctx.lineTo(pad + innerW, y); ctx.stroke()
    }

    /* ── X DIAGONALS IN EVERY CELL (matching real board) ── */
    ctx.strokeStyle = '#1a0e04'
    ctx.lineWidth   = 1.5
    for (let row = 0; row < CELLS; row++) {
      for (let col = 0; col < CELLS; col++) {
        const x = pad + col * cellW
        const y = pad + row * cellH
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cellW, y + cellH); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x + cellW, y); ctx.lineTo(x, y + cellH); ctx.stroke()
      }
    }

    /* ── SAFE SQUARE TINTS ── */
    ctx.save()
    for (const key of SAFE_SET) {
      const [r, c] = key.split(',').map(Number)
      const isHome = r === 2 && c === 2
      ctx.globalAlpha = isHome ? 0.0 : 0.12
      ctx.fillStyle   = '#c8961e'
      ctx.fillRect(pad + c * cellW + 2, pad + r * cellH + 2, cellW - 4, cellH - 4)
    }
    ctx.restore()

    /* ── CENTRE HOME CIRCLE ── */
    const hx = pad + 2 * cellW + cellW / 2
    const hy = pad + 2 * cellH + cellH / 2
    const hr = cellW * 0.38
    // Outer glow
    ctx.save()
    ctx.shadowColor = 'rgba(212,168,67,0.6)'; ctx.shadowBlur = 14
    const hGrad = ctx.createRadialGradient(hx - 6, hy - 6, 3, hx, hy, hr)
    hGrad.addColorStop(0, '#ffe066')
    hGrad.addColorStop(0.5, '#d4a843')
    hGrad.addColorStop(1, '#8b5e1a')
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2)
    ctx.fillStyle = hGrad; ctx.fill()
    ctx.strokeStyle = '#5c3a08'; ctx.lineWidth = 2.5; ctx.stroke()
    ctx.restore()
    // Star symbol
    ctx.fillStyle = '#5c3a08'
    ctx.font      = `${cellW * 0.38}px serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('★', hx, hy)

    /* helper: cell centre */
    function cellXY(row: number, col: number): [number, number] {
      return [pad + col * cellW + cellW / 2, pad + row * cellH + cellH / 2]
    }

    /* ── PLAYER YARD INDICATORS (corner pieces not entered) ── */
    const yardCorners: [number, number][] = [
      [pad + cellW * 0.3,  pad + innerH - cellH * 0.3],    // P0 Red   bottom-left
      [pad + innerW - cellW * 0.3, pad + innerH - cellH * 0.3], // P1 Yellow bottom-right
      [pad + innerW - cellW * 0.3, pad + cellH * 0.3],     // P2 Green  top-right
      [pad + cellW * 0.3,  pad + cellH * 0.3],              // P3 Orange top-left
    ]
    for (let pi = 0; pi < np; pi++) {
      const inYard = state.pos[pi].filter((p, i) => p === 0 || !state.entered[pi][i]).length
      if (inYard === 0) continue
      const [vx, vy] = yardCorners[pi]
      // Small yard indicator circle
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.beginPath(); ctx.arc(vx, vy, cellW * 0.32, 0, Math.PI * 2)
      ctx.fillStyle = TOKEN_FILL[pi]; ctx.fill()
      ctx.restore()
      ctx.fillStyle = TOKEN_LIGHT[pi]
      ctx.font      = `bold ${cellW * 0.25}px Cinzel, serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`×${inYard}`, vx, vy)
    }

    /* ── ON-BOARD TOKENS ── */
    const cellOcc: Map<string, { player: number; piece: number }[]> = new Map()
    for (let p = 0; p < np; p++) {
      for (let i = 0; i < NUM_PIECES; i++) {
        if (state.pos[p][i] <= 0 || !state.entered[p][i]) continue
        const cell = getCell(p, state.pos[p][i])
        if (!cell) continue
        const key = `${cell[0]},${cell[1]}`
        if (!cellOcc.has(key)) cellOcc.set(key, [])
        cellOcc.get(key)!.push({ player: p, piece: i })
      }
    }

    for (const [key, occupants] of cellOcc) {
      const [row, col] = key.split(',').map(Number)
      const [bx, by]   = cellXY(row, col)

      // Offsets for multiple tokens on same cell
      const offsets = [[0, -6], [7, 4], [-7, 4], [0, 0]]
      occupants.forEach(({ player, piece }, idx) => {
        const [ox, oy] = offsets[Math.min(idx, 3)]
        const movable  =
          state.phase === 'move' &&
          player === state.turn &&
          canMoveG(state, player, piece) &&
          !(isBot && player === 1)
        const selected = state.selected === piece && player === state.turn
        drawCapsule(ctx, bx + ox, by + oy, player, movable, selected, cellW)
      })
    }

    /* ── TURN INDICATOR GLOW ── */
    // Highlight the active player's corner/yard area
    const activeYard = yardCorners[state.turn]
    if (activeYard && !done) {
      ctx.save()
      ctx.shadowColor = TOKEN_FILL[state.turn]
      ctx.shadowBlur  = 20
      ctx.globalAlpha = 0.25
      ctx.beginPath()
      ctx.arc(activeYard[0], activeYard[1], cellW * 0.5, 0, Math.PI * 2)
      ctx.strokeStyle = TOKEN_FILL[state.turn]
      ctx.lineWidth   = 2
      ctx.stroke()
      ctx.restore()
    }

    /* eslint-disable @typescript-eslint/no-unused-vars */
    void cellXY
  }, [np, isBot, done, boardSize]) // eslint-disable-line

  /** Draw a dome/capsule-shaped token like the real game pieces */
  function drawCapsule(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, player: number,
    movable: boolean, selected: boolean,
    cellSize: number
  ) {
    const rw = cellSize * 0.22   // half-width
    const rh = cellSize * 0.30   // half-height
    const fill = TOKEN_FILL[player]
    const edge = TOKEN_EDGE[player]
    const lite = TOKEN_LIGHT[player]

    ctx.save()

    if (movable || selected) {
      ctx.shadowColor = selected ? '#fff' : '#fbbf24'
      ctx.shadowBlur  = selected ? 18 : 12
    }

    // Drop shadow
    ctx.beginPath()
    ctx.ellipse(x + 2, y + 4, rw, rh * 0.6, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fill()

    // Body gradient (dome — lighter top, darker bottom)
    const bGrad = ctx.createLinearGradient(x, y - rh, x, y + rh)
    bGrad.addColorStop(0, lite)
    bGrad.addColorStop(0.4, fill)
    bGrad.addColorStop(1,   edge)
    ctx.beginPath()
    ctx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2)
    ctx.fillStyle = bGrad
    ctx.fill()

    // Outline
    ctx.strokeStyle = edge
    ctx.lineWidth   = 1.5
    ctx.stroke()

    // Top dome highlight (oval specular spot)
    const hGrad = ctx.createRadialGradient(x - rw * 0.2, y - rh * 0.35, 0, x, y - rh * 0.15, rw * 0.8)
    hGrad.addColorStop(0, 'rgba(255,255,255,0.65)')
    hGrad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.beginPath()
    ctx.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2)
    ctx.fillStyle = hGrad
    ctx.fill()

    // Pulse ring for movable
    if (movable) {
      ctx.beginPath()
      ctx.ellipse(x, y, rw + 5, rh + 4, 0, 0, Math.PI * 2)
      ctx.strokeStyle = selected ? 'rgba(255,255,255,0.9)' : 'rgba(251,191,36,0.8)'
      ctx.lineWidth   = 2
      ctx.stroke()
    }

    ctx.restore()
  }

  /* Redraw on state change */
  useEffect(() => { draw(gs) }, [gs, draw])

  /* ─────────────────────────────────────────────────────────
     GAME LOGIC
     ───────────────────────────────────────────────────────── */
  function canMoveG(g: GS, pi: number, i: number): boolean {
    const pos = g.pos[pi][i]
    if (pos >= 25) return false
    if (!g.entered[pi][i]) return g.roll === 1 || g.roll === 4
    return pos + g.roll <= 25
  }

  function applyMove(prev: GS, pieceIdx: number): GS | null {
    const t = prev.turn
    if (!canMoveG(prev, t, pieceIdx)) return null

    const ng: GS = {
      ...prev,
      pos:     prev.pos.map(a => [...a]),
      entered: prev.entered.map(a => [...a]),
      selected: -1,
    }

    if (!ng.entered[t][pieceIdx]) {
      ng.entered[t][pieceIdx] = true
      ng.pos[t][pieceIdx]     = ng.roll === 4 ? 4 : 1
    } else {
      ng.pos[t][pieceIdx] = Math.min(ng.pos[t][pieceIdx] + ng.roll, 25)
    }

    const sq = ng.pos[t][pieceIdx]
    // Capture check
    if (sq < 25) {
      const cell = getCell(t, sq)
      const key  = cell ? `${cell[0]},${cell[1]}` : ''
      if (!SAFE_SET.has(key)) {
        let captured = false
        for (let p2 = 0; p2 < np; p2++) {
          if (p2 === t) continue
          for (let j = 0; j < NUM_PIECES; j++) {
            if (ng.entered[p2][j] && ng.pos[p2][j] === sq) {
              ng.pos[p2][j]     = 0
              ng.entered[p2][j] = false
              captured = true
            }
          }
        }
        if (captured) play('capture')
      }
    }

    return ng
  }

  const movePiece = useCallback((pieceIdx: number) => {
    if (done || gs.phase !== 'move') return
    const t = gs.turn
    if (!canMoveG(gs, t, pieceIdx)) { play('error'); return }

    const ng = applyMove(gs, pieceIdx)
    if (!ng) return

    play('move')

    // Check win
    if (ng.pos[t].every(p => p >= 25)) {
      setGs(ng); setDone(true); play('win')
      setTimeout(() => onGameOver({
        winner: names[t], gameId: 'kattamane', difficulty: config.difficulty
      }), 700)
      return
    }

    // Check if current player can go again (rolled 1 or 4 or 8) — in Ashta Chamma you get extra turn on 1 or 8
    const extraTurn = ng.roll === 1 || ng.roll === 8
    if (extraTurn) {
      ng.phase  = 'roll'
      ng.roll   = 0
      ng.cowries = []
      setGs(ng)
      setMsg(`${names[t]} rolled ${gs.roll}! Roll again! 🎉`)
    } else {
      const next = (ng.turn + 1) % np
      ng.turn   = next
      ng.phase  = 'roll'
      ng.roll   = 0
      ng.cowries = []
      setGs(ng)
      setMsg(`${names[next]}'s turn — Roll!`)
    }
  }, [gs, done, isBot, np, names, config.difficulty, onGameOver, play]) // eslint-disable-line

  const doRoll = useCallback(() => {
    if (gs.phase !== 'roll' || rolling || done) return
    setRolling(true); play('dice')

    setTimeout(() => {
      const cowries = rollCowries()
      const roll    = scoreCowries(cowries)
      const ng: GS  = { ...gs, cowries, roll, phase: 'move', selected: -1 }
      const hasMoves = ng.pos[ng.turn].some((_, i) => canMoveG(ng, ng.turn, i))

      if (!hasMoves) {
        const next = (ng.turn + 1) % np
        setGs({ ...ng, turn: next, phase: 'roll', roll: 0, cowries: [] })
        setMsg(`Rolled ${roll} — no valid moves for ${names[ng.turn]}. Next player.`)
      } else {
        setGs(ng)
        const bonusLabel = roll === 8 ? ' — Bonus! 🎉' : roll === 4 ? ' — Re-enter!' : ''
        setMsg(`${names[ng.turn]} rolled ${roll}${bonusLabel} — pick a piece`)
      }
      setRolling(false)
    }, 600)
  }, [gs, rolling, done, np, names, play]) // eslint-disable-line

  /* Bot AI */
  useEffect(() => {
    if (!isBot || gs.turn !== 1 || done) return
    if (gs.phase === 'roll') {
      const t = setTimeout(doRoll, 700)
      return () => clearTimeout(t)
    }
    if (gs.phase === 'move') {
      const t = setTimeout(() => {
        const movable = gs.pos[1].map((_, i) => i).filter(i => canMoveG(gs, 1, i))
        if (!movable.length) return
        // Prefer: capture > send piece home > furthest piece
        const captureIdx = movable.find(i => {
          const futurePos = gs.entered[1][i]
            ? Math.min(gs.pos[1][i] + gs.roll, 25)
            : gs.roll
          return [0].some(p2 =>
            gs.pos[p2].some((pp, j) => gs.entered[p2][j] && pp === futurePos)
          )
        })
        const bestIdx = captureIdx ??
          movable.reduce((best, i) => gs.pos[1][i] > gs.pos[1][best] ? i : best, movable[0])
        movePiece(bestIdx)
      }, 800)
      return () => clearTimeout(t)
    }
  }, [gs, isBot, done, doRoll, movePiece])

  /* Canvas click handler - with dynamic sizing */
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gs.phase !== 'move' || done || (isBot && gs.turn === 1)) return
    const rect  = canvasRef.current!.getBoundingClientRect()
    const scale = boardSize / rect.width
    const mx    = (e.clientX - rect.left) * scale
    const my    = (e.clientY - rect.top)  * scale

    const CELL  = boardSize / CELLS
    const pad   = 12
    const innerH = boardSize - pad * 2 - 16
    const cellW  = (boardSize - pad * 2) / CELLS
    const cellH  = innerH / CELLS
    const col   = Math.floor((mx - pad) / cellW)
    const row   = Math.floor((my - pad) / cellH)
    if (row < 0 || row >= CELLS || col < 0 || col >= CELLS) return

    const t = gs.turn
    // Find piece at this cell
    for (let i = 0; i < NUM_PIECES; i++) {
      if (!gs.entered[t][i] || gs.pos[t][i] <= 0) continue
      const cell = getCell(t, gs.pos[t][i])
      if (cell && cell[0] === row && cell[1] === col) {
        movePiece(i); return
      }
    }

    // Click near yard corner to enter a piece
    const yardCornerCells: [number, number][] = [
      [4, 0], [4, 4], [0, 4], [0, 0],
    ]
    const [yr, yc] = yardCornerCells[t] ?? [-1, -1]
    if (row === yr && col === yc) {
      for (let i = 0; i < NUM_PIECES; i++) {
        if (!gs.entered[t][i] && canMoveG(gs, t, i)) { movePiece(i); return }
      }
    }
  }

  /* ─────────────────────────────────────────────────────────
     RENDER - Side-by-side responsive layout
     ───────────────────────────────────────────────────────── */
  const t       = gs.turn
  const homePcs = (pi: number) => gs.pos[pi].filter(p => p >= 25).length

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col items-center justify-center p-2 md:p-4 relative z-10 select-none"
      style={{ fontFamily: 'Crimson Text, Georgia, serif' }}
    >
      {showHelp && <HowToPlay data={HOW_TO_PLAY.kattamane} onClose={() => setShowHelp(false)} />}

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between w-full max-w-[720px] mb-2">
        <button onClick={onExit} className="btn-ghost text-xs py-1.5 px-3">← Exit</button>
        <h2 style={{ fontFamily: 'Cinzel Decorative,serif', color: '#d4a843', fontSize: '1rem' }}>
          🐚 Ashta Chamma
        </h2>
        <button onClick={() => setShowHelp(true)} className="btn-ghost text-xs py-1.5 px-3">📜 Rules</button>
      </div>

      {/* ── Status ── */}
      <div
        className="text-sm mb-3 px-5 py-1.5 rounded-full text-center max-w-[520px]"
        style={{
          fontFamily: 'Cinzel,serif',
          letterSpacing: '0.03em',
          background: 'rgba(42,21,9,0.9)',
          border: `2px solid ${TOKEN_FILL[t]}55`,
          color: TOKEN_LIGHT[t],
          transition: 'border-color 0.3s, color 0.3s',
          boxShadow: `0 0 12px ${TOKEN_FILL[t]}33`,
        }}
      >
        {msg}
      </div>

      {/* ── SIDE-BY-SIDE LAYOUT ── */}
      <div className="flex flex-col md:flex-row gap-4 items-start justify-center w-full max-w-[720px]">

        {/* ── LEFT: BOARD ── */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <canvas
            ref={canvasRef}
            width={boardSize}
            height={boardSize}
            className="rounded-md cursor-pointer"
            style={{
              width: '100%',
              maxWidth: `${boardSize}px`,
              height: 'auto',
              boxShadow: [
                '0 0 0 3px #6b4c12',
                '0 0 0 6px rgba(212,168,67,0.35)',
                '0 16px 48px rgba(0,0,0,0.7)',
              ].join(', '),
            }}
            onClick={handleCanvasClick}
          />
          <p className="text-xs text-center px-2" style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Cinzel,serif', letterSpacing: '0.05em' }}>
            Tap a piece on the board
          </p>
        </div>

        {/* ── RIGHT: CONTROLS PANEL ── */}
        <div className="flex flex-col gap-3 w-full md:w-auto md:min-w-[160px] md:max-w-[180px]">

          {/* Cowrie dice */}
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(26,12,6,0.90)', border: '1px solid rgba(212,168,67,0.25)' }}
          >
            <div className="text-xs mb-2 tracking-widest uppercase" style={{ color: 'rgba(212,168,67,0.5)', fontFamily: 'Cinzel,serif' }}>
              Cowries
            </div>
            <div className="flex gap-2 justify-center flex-wrap mb-2">
              {(gs.cowries.length ? gs.cowries : Array(4).fill(false)).map((up, i) => (
                <CowrieShell key={i} faceUp={up} rolling={rolling} />
              ))}
            </div>
            {gs.roll > 0 && (
              <div className="text-2xl font-bold" style={{ color: '#fbbf24', fontFamily: 'Cinzel Decorative,serif' }}>
                {gs.roll}
                {gs.roll === 8 && <span className="text-sm ml-1">🎉</span>}
              </div>
            )}
          </div>

          {/* Roll button */}
          {gs.phase === 'roll' && !done && (gs.turn === 0 || !isBot) && (
            <button
              onClick={doRoll}
              disabled={rolling}
              className="btn-gold py-3 text-sm font-semibold"
              style={{ opacity: rolling ? 0.7 : 1 }}
            >
              {rolling ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin text-base">🐚</span> Rolling…
                </span>
              ) : '🐚 Roll Cowries'}
            </button>
          )}
          
          {isBot && gs.turn === 1 && !done && (
            <div className="text-xs text-center py-3 px-3 rounded-lg"
                 style={{ 
                   background: 'rgba(26,12,6,0.90)', 
                   border: '1px solid rgba(212,168,67,0.2)', 
                   color: 'rgba(212,168,67,0.6)', 
                   fontFamily: 'Cinzel,serif' 
                 }}>
              🤖 Bot is thinking…
            </div>
          )}

          {/* Players */}
          {names.map((name, pi) => (
            <div
              key={pi}
              className="rounded-xl p-3"
              style={{
                background: 'rgba(26,12,6,0.90)',
                border: `2px solid ${t === pi && !done ? TOKEN_FILL[pi] + '88' : 'rgba(212,168,67,0.12)'}`,
                transition: 'all 0.3s',
                boxShadow: t === pi && !done ? `0 0 16px ${TOKEN_FILL[pi]}44` : 'none',
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ background: TOKEN_FILL[pi], border: `2px solid ${TOKEN_EDGE[pi]}`, boxShadow: `0 2px 4px ${TOKEN_EDGE[pi]}` }}
                />
                <span className="text-xs font-semibold truncate" style={{ color: TOKEN_LIGHT[pi], fontFamily: 'Cinzel,serif' }}>
                  {name}
                </span>
                {homePcs(pi) === NUM_PIECES && <span className="text-sm">🏆</span>}
              </div>

              {/* Progress bar */}
              <div className="flex gap-1 mb-2">
                {Array.from({ length: NUM_PIECES }, (_, i) => (
                  <div
                    key={i}
                    className="flex-1 h-2 rounded-full transition-all"
                    style={{
                      background: i < homePcs(pi) ? TOKEN_FILL[pi] : 'rgba(212,168,67,0.12)',
                      border: '1px solid rgba(212,168,67,0.2)',
                      boxShadow: i < homePcs(pi) ? `0 1px 3px ${TOKEN_EDGE[pi]}` : 'none',
                    }}
                  />
                ))}
              </div>
              
              <div className="text-[10px] text-center mb-2" style={{ color: 'rgba(212,168,67,0.45)', fontFamily: 'Cinzel,serif' }}>
                {homePcs(pi)}/{NUM_PIECES} pieces home
              </div>

              {/* Piece buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                {gs.pos[pi].map((pos, i) => {
                  const isHome  = pos >= 25
                  const inYard  = pos === 0 || !gs.entered[pi][i]
                  const movable = t === pi && gs.phase === 'move' && canMoveG(gs, pi, i) && !done && !(isBot && pi === 1)
                  return (
                    <button
                      key={i}
                      onClick={() => movable && movePiece(i)}
                      className="py-2 rounded-lg text-center transition-all"
                      style={{
                        background: isHome
                          ? 'rgba(212,168,67,0.25)'
                          : movable
                          ? `${TOKEN_FILL[pi]}44`
                          : 'rgba(42,21,9,0.65)',
                        border: `1px solid ${movable ? '#fbbf24' : isHome ? 'rgba(212,168,67,0.4)' : 'rgba(212,168,67,0.12)'}`,
                        boxShadow: movable ? `0 0 10px ${TOKEN_FILL[pi]}77` : 'none',
                        cursor: movable ? 'pointer' : 'default',
                        transform: movable ? 'scale(1.05)' : 'scale(1)',
                      }}
                    >
                      {/* Mini capsule icon */}
                      <div className="flex justify-center mb-1">
                        <div
                          style={{
                            width: 12, height: 16,
                            borderRadius: '50%',
                            background: isHome
                              ? `linear-gradient(180deg, #fde68a, ${TOKEN_FILL[pi]})`
                              : `linear-gradient(180deg, ${TOKEN_LIGHT[pi]}, ${TOKEN_FILL[pi]})`,
                            border: `1.5px solid ${TOKEN_EDGE[pi]}`,
                            opacity: inYard ? 0.5 : 1,
                            boxShadow: isHome ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '10px', color: isHome ? '#fbbf24' : TOKEN_LIGHT[pi], lineHeight: 1.2, fontFamily: 'Cinzel,serif' }}>
                        {isHome ? '🏠 Home' : inYard ? 'Yard' : `Sq ${pos}`}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   COWRIE SHELL SVG COMPONENT
   White oval shell; face-up shows the open slit (dark groove);
   face-down shows a smooth dome.
   ───────────────────────────────────────────────────────────── */
function CowrieShell({ faceUp, rolling }: { faceUp: boolean; rolling: boolean }) {
  return (
    <div
      className={rolling ? 'animate-bounce' : ''}
      style={{ width: 26, height: 22, position: 'relative' }}
      title={faceUp ? 'Face up (mouth)' : 'Face down'}
    >
      <svg viewBox="0 0 26 22" width="26" height="22" xmlns="http://www.w3.org/2000/svg">
        {/* Shell body */}
        <ellipse cx="13" cy="11" rx="11" ry="8"
          fill={faceUp ? '#f8f4e8' : '#ede8d4'}
          stroke="#b8a070" strokeWidth="1.2"
        />
        {/* Dome highlight */}
        <ellipse cx="10" cy="8" rx="5" ry="3"
          fill="rgba(255,255,255,0.55)"
        />
        {faceUp ? (
          /* Open slit (mouth-up = scored face) */
          <>
            <ellipse cx="13" cy="12" rx="6.5" ry="3.5"
              fill="#2c1a08" stroke="#1a0e04" strokeWidth="0.5"
            />
            <ellipse cx="13" cy="12" rx="4.5" ry="2"
              fill="#3d2510"
            />
            {/* Teeth ridges */}
            {[-2.5, -1, 0.5, 2].map((dx, i) => (
              <line key={i}
                x1={13 + dx} y1="10" x2={13 + dx} y2="14"
                stroke="#1a0e04" strokeWidth="0.4" opacity="0.5"
              />
            ))}
          </>
        ) : (
          /* Smooth dome back */
          <>
            <ellipse cx="13" cy="12" rx="6" ry="2.5"
              fill="rgba(184,160,112,0.3)" stroke="rgba(184,160,112,0.4)" strokeWidth="0.5"
            />
          </>
        )}
        {/* Rim dots (texture) */}
        {[-4, -2, 0, 2, 4].map((dx, i) => (
          <circle key={i} cx={13 + dx} cy="5" r="0.6" fill="rgba(184,160,112,0.5)" />
        ))}
      </svg>
    </div>
  )
}

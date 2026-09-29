/**
 * Carrom — fully rewritten
 *
 * Fixes:
 * ✅ Performance: physics runs in a single stable rAF loop; draw() never
 *    depends on React state (reads from refs only) — zero stale closures.
 * ✅ Striker drag: auto-placed on the player's baseline. Click anywhere on
 *    the baseline bar to slide the striker left/right. Then drag BACK (away
 *    from the board) to aim & set power; release to shoot.
 * ✅ Graphics: wood-grain board, inlaid border, glossy coin highlights,
 *    pocket shadow, animated power meter, dotted aim line.
 * ✅ Sound: collision sound throttled (min 80 ms gap) — no audio spam.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'
import HowToPlay from '../components/HowToPlay'
import { HOW_TO_PLAY } from './howToPlayData'

interface Props {
  config:     GameConfig
  onGameOver: (r: GameResult) => void
  onExit:     () => void
}

/* ── Constants ───────────────────────────────────────────── */
const SIZE       = 520
const BORDER     = 52
const INNER      = SIZE - BORDER * 2
const CENTER     = SIZE / 2
const POCKET_R   = 24
const COIN_R     = 15
const STRIKER_R  = 20
const FRICTION   = 0.982      // per-frame velocity decay
const MIN_SPEED  = 0.06       // below this → treat as stopped
const LANE_PAD   = 36         // striker lane left/right padding

const POCKETS: [number, number][] = [
  [BORDER, BORDER],
  [SIZE - BORDER, BORDER],
  [BORDER, SIZE - BORDER],
  [SIZE - BORDER, SIZE - BORDER],
]

/* Player 0 → bottom baseline; Player 1 → top baseline */
const BASE_Y = (t: number) => t === 0 ? SIZE - BORDER - 32 : BORDER + 32

/* Striker horizontal clamp */
const SX_MIN = BORDER + LANE_PAD + STRIKER_R
const SX_MAX = SIZE - BORDER - LANE_PAD - STRIKER_R

/* ── Types ───────────────────────────────────────────────── */
interface Disk {
  x: number; y: number
  vx: number; vy: number
  r: number
  color: 'black' | 'white' | 'red' | 'striker'
  pocketed: boolean
}

interface PhysicsState {
  disks:   Disk[]
  striker: Disk | null
  moving:  boolean
}

interface AimState {
  phase:    'idle' | 'slide' | 'pull'  // slide = moving striker; pull = aiming direction
  strikerX: number
  pullX:    number   // mouse/touch X during pull
  pullY:    number   // mouse/touch Y during pull (should be > baseY for good aim)
}

/* ── Helpers ─────────────────────────────────────────────── */
function mkCoins(): Disk[] {
  const coins: Disk[] = [
    { x: CENTER, y: CENTER, vx: 0, vy: 0, r: COIN_R, color: 'red', pocketed: false },
  ]
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2
    const dist  = COIN_R * 2.5
    coins.push({
      x: CENTER + Math.cos(angle) * dist,
      y: CENTER + Math.sin(angle) * dist,
      vx: 0, vy: 0, r: COIN_R,
      color: i % 2 === 0 ? 'black' : 'white',
      pocketed: false,
    })
  }
  return coins
}

function clampSX(x: number) { return Math.max(SX_MIN, Math.min(SX_MAX, x)) }

/* ── Component ───────────────────────────────────────────── */
export default function Carrom({ config, onGameOver, onExit }: Props) {
  const { play }      = useSound()
  const canvasRef     = useRef<HTMLCanvasElement>(null)

  /* All physics lives here — never causes a re-render */
  const physRef       = useRef<PhysicsState>({ disks: mkCoins(), striker: null, moving: false })
  const aimRef        = useRef<AimState>({ phase: 'idle', strikerX: CENTER, pullX: CENTER, pullY: CENTER })
  const rafRef        = useRef(0)
  const lastSoundRef  = useRef(0)   // throttle collision sound

  /* React state — UI only */
  const [turn,     setTurn]     = useState<0 | 1>(0)
  const [score,    setScore]    = useState<[number, number]>([0, 0])
  const [msg,      setMsg]      = useState('Click the baseline to position the striker, then drag back to aim')
  const [gameOver, setGameOver] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  /* Keep a ref copy of turn/score/gameOver so tick() can read without going stale */
  const turnRef     = useRef(turn)
  const scoreRef    = useRef(score)
  const gameOverRef = useRef(gameOver)
  useEffect(() => { turnRef.current = turn }, [turn])
  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { gameOverRef.current = gameOver }, [gameOver])

  const isBot    = config.mode === 'vs-bot'
  const botDelay = config.difficulty === 'easy' ? 1200 : config.difficulty === 'medium' ? 800 : 400
  const players  = [config.players[0], config.players[1] || 'Bot']

  /* ── Draw (reads only from refs — never stale) ──────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx  = canvas.getContext('2d')!
    const s    = physRef.current
    const aim  = aimRef.current
    const t    = turnRef.current
    const baseY = BASE_Y(t)

    ctx.clearRect(0, 0, SIZE, SIZE)

    /* ── Board background (wood grain) ── */
    const woodGrad = ctx.createLinearGradient(0, 0, SIZE, SIZE)
    woodGrad.addColorStop(0.00, '#c49a5a')
    woodGrad.addColorStop(0.25, '#b8864e')
    woodGrad.addColorStop(0.50, '#c49a5a')
    woodGrad.addColorStop(0.75, '#a87840')
    woodGrad.addColorStop(1.00, '#c49a5a')
    ctx.fillStyle = woodGrad
    ctx.fillRect(0, 0, SIZE, SIZE)

    /* Wood grain stripes */
    ctx.save()
    ctx.globalAlpha = 0.07
    for (let i = 0; i < 24; i++) {
      const x = i * (SIZE / 18)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + SIZE * 0.15, SIZE)
      ctx.strokeStyle = '#6b3a0f'
      ctx.lineWidth = 2.5
      ctx.stroke()
    }
    ctx.restore()

    /* ── Outer border frame ── */
    ctx.strokeStyle = '#5c3010'
    ctx.lineWidth   = 6
    ctx.strokeRect(3, 3, SIZE - 6, SIZE - 6)
    ctx.strokeStyle = '#d4a843'
    ctx.lineWidth   = 1.5
    ctx.strokeRect(7, 7, SIZE - 14, SIZE - 14)

    /* ── Play surface ── */
    const surfGrad = ctx.createLinearGradient(BORDER, BORDER, SIZE - BORDER, SIZE - BORDER)
    surfGrad.addColorStop(0,   '#c8a870')
    surfGrad.addColorStop(0.5, '#be9c60')
    surfGrad.addColorStop(1,   '#b08040')
    ctx.fillStyle = surfGrad
    ctx.fillRect(BORDER, BORDER, INNER, INNER)

    /* Surface grain */
    ctx.save()
    ctx.globalAlpha = 0.05
    for (let i = 0; i < 16; i++) {
      const x = BORDER + i * (INNER / 12)
      ctx.beginPath()
      ctx.moveTo(x, BORDER)
      ctx.lineTo(x + INNER * 0.12, BORDER + INNER)
      ctx.strokeStyle = '#6b3a0f'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    ctx.restore()

    /* Play surface border */
    ctx.strokeStyle = '#7a4a18'
    ctx.lineWidth   = 2
    ctx.strokeRect(BORDER, BORDER, INNER, INNER)

    /* Inner decorative border */
    const inset = 10
    ctx.strokeStyle = 'rgba(212,168,67,0.4)'
    ctx.lineWidth   = 1
    ctx.strokeRect(BORDER + inset, BORDER + inset, INNER - inset * 2, INNER - inset * 2)

    /* ── Diagonal corner lines ── */
    ctx.strokeStyle = 'rgba(120,70,20,0.4)'
    ctx.lineWidth   = 1
    ctx.setLineDash([4, 4])
    const cl = BORDER + POCKET_R + 4
    const cc = CENTER
    ctx.beginPath(); ctx.moveTo(cl, cl); ctx.lineTo(cc - 18, cc - 18); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(SIZE - cl, cl); ctx.lineTo(cc + 18, cc - 18); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cl, SIZE - cl); ctx.lineTo(cc - 18, cc + 18); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(SIZE - cl, SIZE - cl); ctx.lineTo(cc + 18, cc + 18); ctx.stroke()
    ctx.setLineDash([])

    /* ── Centre circles ── */
    const drawCircle = (r: number, strokeStyle: string, lw: number) => {
      ctx.beginPath(); ctx.arc(CENTER, CENTER, r, 0, Math.PI * 2)
      ctx.strokeStyle = strokeStyle; ctx.lineWidth = lw; ctx.stroke()
    }
    drawCircle(COIN_R * 4,   'rgba(100,60,20,0.5)', 1.5)
    drawCircle(COIN_R * 6,   'rgba(100,60,20,0.4)', 1)
    drawCircle(COIN_R * 8.5, 'rgba(100,60,20,0.3)', 1)

    /* Centre dot */
    ctx.beginPath(); ctx.arc(CENTER, CENTER, 5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(100,60,20,0.4)'; ctx.fill()

    /* ── Baseline (striker lane) — DARK solid line ── */
    const laneY = baseY
    ctx.save()
    /* Main dark line */
    ctx.strokeStyle = 'rgba(80,50,20,0.85)'
    ctx.lineWidth   = 2.5
    ctx.beginPath()
    ctx.moveTo(BORDER + LANE_PAD, laneY)
    ctx.lineTo(SIZE - BORDER - LANE_PAD, laneY)
    ctx.stroke()
    /* Subtle inner highlight for depth */
    ctx.strokeStyle = 'rgba(120,70,30,0.4)'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(BORDER + LANE_PAD, laneY - 1)
    ctx.lineTo(SIZE - BORDER - LANE_PAD, laneY - 1)
    ctx.stroke()
    ctx.restore()

    /* Baseline label */
    ctx.save()
    ctx.font      = '9px Cinzel, serif'
    ctx.fillStyle = 'rgba(212,168,67,0.4)'
    ctx.textAlign = 'center'
    ctx.fillText(t === 0 ? '▲ YOUR LINE' : '▼ YOUR LINE', CENTER, laneY + (t === 0 ? -6 : 12))
    ctx.restore()

    /* ── Pockets ── */
    for (const [px, py] of POCKETS) {
      /* Shadow */
      ctx.beginPath(); ctx.arc(px, py, POCKET_R + 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill()
      /* Main pocket */
      const pGrad = ctx.createRadialGradient(px - 4, py - 4, 2, px, py, POCKET_R)
      pGrad.addColorStop(0, '#3a1a05')
      pGrad.addColorStop(1, '#1a0a02')
      ctx.beginPath(); ctx.arc(px, py, POCKET_R, 0, Math.PI * 2)
      ctx.fillStyle = pGrad; ctx.fill()
      ctx.strokeStyle = '#8b5a2a'; ctx.lineWidth = 2; ctx.stroke()
      /* Inner ring */
      ctx.beginPath(); ctx.arc(px, py, POCKET_R * 0.55, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(212,168,67,0.2)'; ctx.lineWidth = 1; ctx.stroke()
    }

    /* ── Coins ── */
    for (const d of s.disks) {
      if (d.pocketed) continue

      ctx.save()
      /* Drop shadow */
      ctx.shadowColor   = 'rgba(0,0,0,0.45)'
      ctx.shadowBlur    = 6
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2

      /* Body gradient */
      const cGrad = ctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.1, d.x, d.y, d.r)
      if (d.color === 'black') {
        cGrad.addColorStop(0, '#4a4a4a')
        cGrad.addColorStop(1, '#111111')
      } else if (d.color === 'white') {
        cGrad.addColorStop(0, '#ffffff')
        cGrad.addColorStop(1, '#d0ccc0')
      } else { // red
        cGrad.addColorStop(0, '#e05050')
        cGrad.addColorStop(1, '#8b1a1a')
      }
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
      ctx.fillStyle = cGrad; ctx.fill()
      ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0

      /* Rim */
      ctx.strokeStyle = d.color === 'white' ? '#aaa' : d.color === 'black' ? '#555' : '#cc2222'
      ctx.lineWidth   = 1.5; ctx.stroke()

      /* Specular highlight */
      const hGrad = ctx.createRadialGradient(d.x - d.r * 0.38, d.y - d.r * 0.38, 0, d.x - d.r * 0.2, d.y - d.r * 0.2, d.r * 0.55)
      hGrad.addColorStop(0, 'rgba(255,255,255,0.55)')
      hGrad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
      ctx.fillStyle = hGrad; ctx.fill()

      ctx.restore()
    }

    /* ── Aim indicator (when in pull phase) ── */
    if (aim.phase === 'pull' && !s.moving) {
      const sx  = aim.strikerX
      const sy2 = baseY
      const dx  = aim.pullX - sx
      const dy  = aim.pullY - sy2
      const len = Math.hypot(dx, dy)

      if (len > 5) {
        /* Shoot direction = opposite of pull */
        const angle = Math.atan2(-dy, -dx)
        const power = Math.min(len, 130)
        const projX = sx + Math.cos(angle) * power * 5
        const projY = sy2 + Math.sin(angle) * power * 5

        /* Aim line — dashed */
        ctx.save()
        ctx.setLineDash([5, 6])
        ctx.strokeStyle = 'rgba(255,220,80,0.75)'
        ctx.lineWidth   = 1.5
        ctx.shadowColor = 'rgba(255,200,0,0.4)'
        ctx.shadowBlur  = 6
        ctx.beginPath(); ctx.moveTo(sx, sy2); ctx.lineTo(projX, projY)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()

        /* Arrowhead */
        ctx.save()
        ctx.translate(projX, projY)
        ctx.rotate(angle)
        ctx.beginPath()
        ctx.moveTo(0, 0); ctx.lineTo(-10, -5); ctx.lineTo(-10, 5)
        ctx.closePath()
        ctx.fillStyle = 'rgba(255,220,80,0.8)'; ctx.fill()
        ctx.restore()

        /* Power bar */
        const pct    = power / 130
        const barW   = 100
        const barX   = sx - barW / 2
        const barY   = sy2 + (t === 0 ? 28 : -36)
        ctx.save()
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(barX - 1, barY - 1, barW + 2, 10)
        const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY)
        barGrad.addColorStop(0,   '#4ade80')
        barGrad.addColorStop(0.5, '#fbbf24')
        barGrad.addColorStop(1,   '#ef4444')
        ctx.fillStyle = barGrad; ctx.fillRect(barX, barY, barW * pct, 8)
        ctx.strokeStyle = 'rgba(212,168,67,0.5)'; ctx.lineWidth = 1
        ctx.strokeRect(barX - 1, barY - 1, barW + 2, 10)
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '7px Cinzel,serif'; ctx.textAlign = 'center'
        ctx.fillText('POWER', sx, barY + (t === 0 ? 20 : -6))
        ctx.restore()
      }
    }

    /* ── Striker ── */
    if (!s.moving) {
      const sx2  = aim.strikerX
      const sy2  = baseY
      ctx.save()
      ctx.shadowColor   = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur    = 8
      ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2

      const stGrad = ctx.createRadialGradient(sx2 - 6, sy2 - 6, 2, sx2, sy2, STRIKER_R)
      if (t === 0) {
        stGrad.addColorStop(0, '#d4a843')
        stGrad.addColorStop(1, '#7c4a10')
      } else {
        stGrad.addColorStop(0, '#93c5fd')
        stGrad.addColorStop(1, '#1e4080')
      }
      ctx.beginPath(); ctx.arc(sx2, sy2, STRIKER_R, 0, Math.PI * 2)
      ctx.fillStyle = stGrad; ctx.fill()
      ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0
      /* Striker rim */
      ctx.strokeStyle = t === 0 ? '#fbbf24' : '#60a5fa'
      ctx.lineWidth   = 2.5; ctx.stroke()
      /* Inner ring */
      ctx.beginPath(); ctx.arc(sx2, sy2, STRIKER_R * 0.55, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke()
      /* Specular */
      const shGrad = ctx.createRadialGradient(sx2 - 7, sy2 - 7, 0, sx2 - 4, sy2 - 4, STRIKER_R * 0.7)
      shGrad.addColorStop(0, 'rgba(255,255,255,0.6)')
      shGrad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.beginPath(); ctx.arc(sx2, sy2, STRIKER_R, 0, Math.PI * 2)
      ctx.fillStyle = shGrad; ctx.fill()
      ctx.restore()

      /* Slide handle — small arrows on the baseline */
      if (aim.phase !== 'pull') {
        ctx.save()
        ctx.fillStyle = t === 0 ? 'rgba(212,168,67,0.55)' : 'rgba(147,197,253,0.55)'
        ctx.font      = '11px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('◄  ►', sx2, baseY + (t === 0 ? 16 : -16))
        ctx.restore()
      }
    } else if (s.striker) {
      /* Striker in motion */
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8
      ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2
      const stGrad2 = ctx.createRadialGradient(s.striker.x - 6, s.striker.y - 6, 2, s.striker.x, s.striker.y, STRIKER_R)
      stGrad2.addColorStop(0, t === 0 ? '#d4a843' : '#93c5fd')
      stGrad2.addColorStop(1, t === 0 ? '#7c4a10' : '#1e4080')
      ctx.beginPath(); ctx.arc(s.striker.x, s.striker.y, STRIKER_R, 0, Math.PI * 2)
      ctx.fillStyle = stGrad2; ctx.fill()
      ctx.strokeStyle = t === 0 ? '#fbbf24' : '#60a5fa'; ctx.lineWidth = 2.5; ctx.stroke()
      ctx.restore()
    }
  }, []) // ← no dependencies: reads only from refs

  /* ── Physics tick ───────────────────────────────────── */
  const tick = useCallback(() => {
    const s       = physRef.current
    if (!s.moving) return

    let anyMoving = false
    const active: Disk[] = [...s.disks.filter(d => !d.pocketed)]
    if (s.striker) active.push(s.striker)

    /* Integrate velocities */
    for (const d of active) {
      d.x += d.vx; d.y += d.vy
      d.vx *= FRICTION; d.vy *= FRICTION
      if (Math.abs(d.vx) < MIN_SPEED) d.vx = 0
      if (Math.abs(d.vy) < MIN_SPEED) d.vy = 0
      if (d.vx !== 0 || d.vy !== 0) anyMoving = true

      /* Wall bounces */
      if (d.x - d.r < BORDER)       { d.x = BORDER + d.r;       d.vx =  Math.abs(d.vx) * 0.82 }
      if (d.x + d.r > SIZE - BORDER) { d.x = SIZE - BORDER - d.r; d.vx = -Math.abs(d.vx) * 0.82 }
      if (d.y - d.r < BORDER)       { d.y = BORDER + d.r;       d.vy =  Math.abs(d.vy) * 0.82 }
      if (d.y + d.r > SIZE - BORDER) { d.y = SIZE - BORDER - d.r; d.vy = -Math.abs(d.vy) * 0.82 }
    }

    /* Disk-disk elastic collisions */
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a  = active[i], b = active[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const minD = a.r + b.r
        if (dist < minD && dist > 0.01) {
          /* Throttle collision sound */
          const now = performance.now()
          if (now - lastSoundRef.current > 80) { play('move'); lastSoundRef.current = now }

          /* Separate overlapping disks */
          const nx = dx / dist, ny = dy / dist
          const overlap = (minD - dist) / 2
          a.x -= nx * overlap; a.y -= ny * overlap
          b.x += nx * overlap; b.y += ny * overlap

          /* Elastic impulse */
          const dvx = a.vx - b.vx, dvy = a.vy - b.vy
          const dot  = dvx * nx + dvy * ny
          if (dot > 0) {
            const e   = 0.88  // restitution
            const imp = (1 + e) * dot / 2
            a.vx -= imp * nx; a.vy -= imp * ny
            b.vx += imp * nx; b.vy += imp * ny
          }
        }
      }
    }

    /* Pocket detection */
    let scored = false
    for (const d of s.disks) {
      if (d.pocketed) continue
      for (const [px, py] of POCKETS) {
        if (Math.hypot(d.x - px, d.y - py) < POCKET_R) {
          d.pocketed = true; d.vx = 0; d.vy = 0
          const pts = d.color === 'red' ? 3 : 1
          const t   = turnRef.current
          setScore(prev => { const n = [prev[0], prev[1]] as [number,number]; n[t] += pts; return n })
          play('capture')
          scored = true
        }
      }
    }

    /* Striker pocket */
    if (s.striker) {
      for (const [px, py] of POCKETS) {
        if (Math.hypot(s.striker.x - px, s.striker.y - py) < POCKET_R + STRIKER_R * 0.5) {
          s.striker = null; s.moving = false; anyMoving = false
          play('error')
          const next = (turnRef.current === 0 ? 1 : 0) as 0 | 1
          setTurn(next)
          setMsg("Striker pocketed — opponent's turn!")
          break
        }
      }
    }

    draw()

    if (!anyMoving) {
      s.moving = false
      if (gameOverRef.current) return

      /* Win check — all non-red coins pocketed AND red is pocketed */
      const remaining = s.disks.filter(d => !d.pocketed && d.color !== 'red').length
      const redPocketed = s.disks.find(d => d.color === 'red')?.pocketed ?? false
      if (remaining === 0 && redPocketed) {
        setGameOver(true)
        const sc = scoreRef.current
        const winner = sc[0] >= sc[1] ? players[0] : players[1]
        play('win')
        setTimeout(() => onGameOver({ winner, score: Math.max(...sc), gameId: 'carrom', difficulty: config.difficulty }), 700)
        return
      }

      if (!scored) {
        const next = (turnRef.current === 0 ? 1 : 0) as 0 | 1
        setTurn(next)
      }
      setMsg(scored ? '🎯 Great shot! Play again.' : 'Click the baseline to position, drag back to aim')
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [draw, play, players, config.difficulty, onGameOver])

  /* Redraw when turn changes (updates baseline position) */
  useEffect(() => { draw() }, [turn, draw])

  /* Cleanup on unmount */
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  /* ── Coordinate helper ──────────────────────────────── */
  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent): [number, number] => {
    const rect  = canvasRef.current!.getBoundingClientRect()
    const scale = SIZE / rect.width
    const cl    = 'touches' in e ? e.touches[0] : e
    return [(cl.clientX - rect.left) * scale, (cl.clientY - rect.top) * scale]
  }

  /* ── Pointer handlers ───────────────────────────────── */
  const onPointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (physRef.current.moving || gameOver || (isBot && turnRef.current === 1)) return
    const [mx, my] = getCanvasPos(e)
    const aim      = aimRef.current
    const baseY    = BASE_Y(turnRef.current)

    /* Check if user clicks the striker itself → start pull-to-aim */
    const onStriker = Math.hypot(mx - aim.strikerX, my - baseY) < STRIKER_R + 8

    /* Check if user clicks the baseline bar → slide mode */
    const onBaseline = my > baseY - 20 && my < baseY + 20

    if (onStriker) {
      aim.phase = 'pull'
      aim.pullX = mx; aim.pullY = my
    } else if (onBaseline) {
      aim.phase    = 'slide'
      aim.strikerX = clampSX(mx)
      aim.pullX    = mx; aim.pullY = my
    }
    draw()
  }, [gameOver, isBot, draw])

  const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const aim = aimRef.current
    if (aim.phase === 'idle') return
    const [mx, my] = getCanvasPos(e)

    if (aim.phase === 'slide') {
      aim.strikerX = clampSX(mx)
      aim.pullX    = mx; aim.pullY = my
    } else if (aim.phase === 'pull') {
      aim.pullX = mx; aim.pullY = my
    }
    draw()
  }, [draw])

  const onPointerUp = useCallback(() => {
    const aim = aimRef.current
    if (aim.phase === 'idle') return

    if (aim.phase === 'pull') {
      const baseY = BASE_Y(turnRef.current)
      const dx    = aim.pullX - aim.strikerX
      const dy    = aim.pullY - baseY
      const len   = Math.hypot(dx, dy)

      if (len > 8) {
        /* Shoot direction = opposite of pull vector */
        const angle = Math.atan2(-dy, -dx)
        const power = Math.min(len, 130)
        const s     = physRef.current
        s.striker = {
          x: aim.strikerX, y: baseY,
          vx: Math.cos(angle) * power * 0.21,
          vy: Math.sin(angle) * power * 0.21,
          r:  STRIKER_R, color: 'striker', pocketed: false,
        }
        s.moving = true
        play('move')
        cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    aim.phase = 'idle'
    draw()
  }, [tick, play, draw])

  /* ── Bot AI ─────────────────────────────────────────── */
  useEffect(() => {
    if (!isBot || turnRef.current !== 1 || physRef.current.moving || gameOver) return
    const timer = setTimeout(() => {
      if (physRef.current.moving) return
      const targets = physRef.current.disks.filter(d => !d.pocketed && d.color !== 'striker')
      if (!targets.length) return

      /* Pick the coin closest to any pocket */
      let bestTarget = targets[0]
      let bestDist   = Infinity
      for (const coin of targets) {
        for (const [px, py] of POCKETS) {
          const d = Math.hypot(coin.x - px, coin.y - py)
          if (d < bestDist) { bestDist = d; bestTarget = coin }
        }
      }

      const acc    = config.difficulty === 'easy' ? 50 : config.difficulty === 'medium' ? 25 : 10
      const noiseX = (Math.random() - 0.5) * acc * 2
      const noiseY = (Math.random() - 0.5) * acc

      /* Aim striker at the coin */
      const baseY  = BASE_Y(1)
      const strikerX = clampSX(bestTarget.x + noiseX * 0.4)
      const angle  = Math.atan2(bestTarget.y - baseY, bestTarget.x - strikerX) + noiseY * 0.015
      const power  = 85 + Math.random() * 25

      aimRef.current.strikerX = strikerX
      const s = physRef.current
      s.striker = {
        x: strikerX, y: baseY,
        vx: Math.cos(angle) * power * 0.21,
        vy: Math.sin(angle) * power * 0.21,
        r: STRIKER_R, color: 'striker', pocketed: false,
      }
      s.moving = true
      play('move')
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }, botDelay)
    return () => clearTimeout(timer)
  }, [turn, isBot, gameOver, tick, play, botDelay, config.difficulty])

  /* ── Pocketed coin counters ─────────────────────────── */
  const pocketed = physRef.current.disks.filter(d => d.pocketed)
  const p0Coins  = pocketed.filter(d => d.color === 'black').length
  const p1Coins  = pocketed.filter(d => d.color === 'white').length
  const redGone  = pocketed.some(d => d.color === 'red')

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative z-10 select-none">
      {showHelp && <HowToPlay data={HOW_TO_PLAY.carrom} onClose={() => setShowHelp(false)} />}

      {/* Toolbar */}
      <div className="flex items-center justify-between w-full max-w-[540px] mb-3">
        <button onClick={onExit} className="btn-ghost text-xs py-1.5 px-3">← Exit</button>
        <h2 style={{ fontFamily: 'Cinzel Decorative,serif', color: '#d4a843', fontSize: '1.05rem' }}>
          🎯 Carrom
        </h2>
        <button onClick={() => setShowHelp(true)} className="btn-ghost text-xs py-1.5 px-3">📜 How to Play</button>
      </div>

      {/* Status */}
      <div className="text-sm mb-3 px-4 py-1.5 rounded-full text-center max-w-[400px]"
           style={{
             fontFamily: 'Cinzel,serif',
             background: 'rgba(42,21,9,0.85)',
             border: '1px solid rgba(212,168,67,0.3)',
             color: 'rgba(245,240,232,0.75)',
             letterSpacing: '0.03em',
           }}>
        {isBot && turn === 1 ? '🤖 Bot is calculating…' : msg}
      </div>

      {/* Instruction hint */}
      {!physRef.current.moving && !(isBot && turn === 1) && (
        <div className="text-xs mb-2 text-center"
             style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Crimson Text,serif', fontStyle: 'italic' }}>
          {turn === 0
            ? '1. Click baseline to slide striker  2. Click striker & drag back to aim  3. Release to shoot'
            : 'Opponent\'s turn'}
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={SIZE} height={SIZE}
        className="rounded-2xl touch-none"
        style={{
          maxWidth: 'min(520px, 95vw)',
          border: '3px solid rgba(212,168,67,0.4)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.75), 0 0 0 1px rgba(212,168,67,0.15)',
          cursor: physRef.current.moving ? 'default' : 'crosshair',
        }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      />

      {/* Scoreboard */}
      <div className="mt-4 flex gap-4 items-stretch">
        {players.map((p, i) => (
          <div key={i} className="rounded-xl px-5 py-3 text-center min-w-[110px]"
               style={{
                 background: 'rgba(26,12,6,0.85)',
                 border: `1px solid ${turn === i ? 'rgba(212,168,67,0.6)' : 'rgba(212,168,67,0.15)'}`,
                 boxShadow: turn === i ? '0 0 12px rgba(212,168,67,0.2)' : 'none',
                 transition: 'all 0.3s',
               }}>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="w-3 h-3 rounded-full"
                   style={{ background: i === 0 ? '#2a2a2a' : '#f0ede0', border: `1px solid ${i === 0 ? '#555' : '#aaa'}` }} />
              <span className="text-xs" style={{ color: 'rgba(212,168,67,0.5)', fontFamily: 'Cinzel,serif' }}>{p}</span>
            </div>
            <div className="text-3xl font-bold" style={{ color: '#fbbf24', fontFamily: 'Cinzel Decorative,serif' }}>
              {score[i]}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'rgba(212,168,67,0.3)', fontFamily: 'Cinzel,serif' }}>
              {i === 0 ? `${p0Coins} blk` : `${p1Coins} wht`}
              {i === 0 && redGone ? ' · 🔴' : ''}
            </div>
            {turn === i && (
              <div className="mt-1.5 h-1 rounded-full"
                   style={{ background: 'linear-gradient(90deg, #d4a843, #fbbf24)' }} />
            )}
          </div>
        ))}

        {/* Red queen status */}
        <div className="rounded-xl px-4 py-3 text-center min-w-[70px]"
             style={{ background: 'rgba(26,12,6,0.85)', border: '1px solid rgba(212,168,67,0.15)' }}>
          <div className="text-xs mb-1" style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Cinzel,serif' }}>Queen</div>
          <div className="text-2xl">{redGone ? '🏆' : '🔴'}</div>
          <div className="text-[9px] mt-0.5" style={{ color: 'rgba(212,168,67,0.3)', fontFamily: 'Cinzel,serif' }}>
            {redGone ? 'Pocketed' : 'In play'}
          </div>
        </div>
      </div>
    </div>
  )
}

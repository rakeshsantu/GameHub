/**
 * Chowka Bara â€” Complete Rewrite with 5-à²®à²¨à³† & 7-à²®à²¨à³† variants
 *
 * Features:
 * - Two board types: 5-house (4 pieces/player) & 7-house (6 pieces/player)
 * - Three game modes: Outer Entry, Center Start, Normal (with capture rules)
 * - Ghatta (safe cross squares) â€” pieces can't be captured here
 * - Visual piece highlighting after dice roll + reminder notifications
 * - Authentic 5Ã—5 grid with X-marked cells matching traditional boards
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { GameConfig } from '../types'
import { GameResult } from '../App'
import { useSound } from '../hooks/useSound'
import HowToPlay from '../components/HowToPlay'
import { HOW_TO_PLAY } from './howToPlayData'

interface Props { config: GameConfig; onGameOver: (r: GameResult) => void; onExit: () => void }

/* â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const BOARD_SIZE  = 480
const CELLS       = 5
const CELL        = BOARD_SIZE / CELLS

/* Board variants */
type BoardType = '5mane' | '7mane'
type GameMode  = 'outer' | 'center' | 'normal'

/* 5-à²®à²¨à³† = 4 pieces, 7-à²®à²¨à³† = 6 pieces */
const PIECES_COUNT: Record<BoardType, number> = { '5mane': 4, '7mane': 6 }

/* Safe squares (Ghatta) â€” cross-marked squares where capture is not allowed */
const GHATTA_CELLS = new Set<string>([
  '0,0', '0,2', '0,4',      // top row corners + center
  '2,0', '2,2', '2,4',      // middle row edges + center
  '4,0', '4,2', '4,4',      // bottom row corners + center
  '1,1', '1,3', '3,1', '3,3', // inner cross squares
])

/* â”€â”€ Track/Path system â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/* Movement track per player (outer ring path clockwise, then inner cross to center) */
const OUTER_RING_PATH: [number, number][] = [
  // Start bottom-left, go counter-clockwise around perimeter
  [4,0],[3,0],[2,0],[1,0],[0,0], // left edge going up
  [0,1],[0,2],[0,3],[0,4],       // top edge going right
  [1,4],[2,4],[3,4],[4,4],       // right edge going down
  [4,3],[4,2],[4,1],             // bottom edge going left (back to start)
]

/* Inner cross paths leading to center (per player home direction) */
const INNER_PATHS: Record<number, [number, number][]> = {
  0: [[3,1],[2,1],[1,1],[2,2]],  // Player 0 (Red) â€” from bottom
  1: [[1,3],[1,2],[1,1],[2,2]],  // Player 1 (Green) â€” from top
  2: [[1,1],[2,1],[3,1],[2,2]],  // Player 2 (Yellow) â€” from left
  3: [[3,3],[2,3],[1,3],[2,2]],  // Player 3 (Black) â€” from right
}

/* Build complete track for each player (outer ring + inner path) */
function buildPlayerTrack(startRingPos: number, playerIdx: number): [number, number][] {
  const ring = [...OUTER_RING_PATH.slice(startRingPos), ...OUTER_RING_PATH.slice(0, startRingPos)]
  const inner = INNER_PATHS[playerIdx] || [[2,1],[2,2]]
  return [...ring, ...inner]
}

/* Player starting positions on outer ring (offset by 4 squares each) */
const PLAYER_RING_STARTS = [0, 4, 8, 12] // 4 players max

/* Get cell position for a piece at track step N for player P */
function getTrackCell(player: number, step: number): [number, number] | null {
  if (step <= 0) return null // in yard/reserve
  const track = buildPlayerTrack(PLAYER_RING_STARTS[player], player)
  const idx   = step - 1
  if (idx >= track.length) return [2, 2] // center (home)
  return track[idx]
}

/* â”€â”€ Cowrie shell dice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function rollCowries(count: number = 4): number[] {
  return Array.from({ length: count }, () => (Math.random() < 0.5 ? 1 : 0))
}

function scoreCowries(faces: number[]): number {
  const up = faces.reduce((a, b) => a + b, 0)
  if (up === 0) return 4  // all down = 4
  if (up === 4) return 8  // all up = 8 (bonus)
  return up               // 1, 2, or 3
}

/* â”€â”€ Game State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
interface Piece {
  pos:     number   // track position (0 = yard, 1-N = track, 999 = home center)
  entered: boolean  // whether piece has entered the board
  home:    boolean  // whether piece reached center home
}

interface GameState {
  boardType:  BoardType
  gameMode:   GameMode
  numPlayers: number
  pieces:     Piece[][] // [player][pieceIdx]
  turn:       number
  diceRolled: boolean
  diceFaces:  number[]
  diceScore:  number
  canMove:    boolean[] // which pieces can move this turn
  phase:      'setup' | 'roll' | 'move'
  moveTimeout: number   // seconds since dice roll (for reminder)
}

function initGame(boardType: BoardType, gameMode: GameMode, numPlayers: number): GameState {
  const pieceCount = PIECES_COUNT[boardType]
  const initPos = gameMode === 'center' ? 999 : 0 // center start vs yard start
  
  return {
    boardType, gameMode, numPlayers,
    pieces: Array.from({ length: numPlayers }, () => 
      Array.from({ length: pieceCount }, () => ({
        pos: initPos === 999 ? 999 : 0,
        entered: gameMode === 'center',
        home: false,
      }))
    ),
    turn: 0, diceRolled: false, diceFaces: [], diceScore: 0,
    canMove: [], phase: 'roll', moveTimeout: 0,
  }
}

/* â”€â”€ Token colors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const PLAYER_COLORS = [
  { name: 'Red',    fill: '#e74c3c', edge: '#c0392b', glow: 'rgba(231,76,60,0.5)' },
  { name: 'Green',  fill: '#27ae60', edge: '#219a52', glow: 'rgba(39,174,96,0.5)' },
  { name: 'Yellow', fill: '#f39c12', edge: '#d68910', glow: 'rgba(243,156,18,0.5)' },
  { name: 'Black',  fill: '#2c3e50', edge: '#1a252f', glow: 'rgba(44,62,80,0.5)' },
]

/* â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function ChowkaBara({ config, onGameOver, onExit }: Props) {
  const { play } = useSound()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  /* Setup modal state */
  const [setupDone, setSetupDone] = useState(false)
  const [boardType, setBoardType] = useState<BoardType>('5mane')
  const [gameMode,  setGameMode]  = useState<GameMode>('normal')
  
  /* Game state */
  const [gs, setGs] = useState<GameState>(() => initGame('5mane', 'normal', 2))
  const [msg, setMsg] = useState('Select game variant to begin')
  const [gameOver, setGameOver] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [reminderPulse, setReminderPulse] = useState(false)
  
  const isBot = config.mode === 'vs-bot'
  const numPlayers = isBot ? 2 : Math.min(config.players.length, 4)
  const players = Array.from({ length: numPlayers }, (_, i) => 
    config.players[i] || (i === 1 && isBot ? 'Bot' : `Player ${i + 1}`)
  )

  /* Start game after setup */
  const startGame = () => {
    const newGs = initGame(boardType, gameMode, numPlayers)
    setGs(newGs)
    setSetupDone(true)
    setMsg(`${players[0]}'s turn â€” Roll the cowrie shells!`)
  }

  /* â”€â”€ Canvas Drawing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const draw = useCallback((state: GameState) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    
    ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE)

    /* === BOARD BACKGROUND â€” warm wooden board === */
    const woodGrad = ctx.createLinearGradient(0, 0, BOARD_SIZE, BOARD_SIZE)
    woodGrad.addColorStop(0.00, '#f5deb3')
    woodGrad.addColorStop(0.25, '#e8c891')
    woodGrad.addColorStop(0.50, '#f5deb3')
    woodGrad.addColorStop(0.75, '#d4b896')
    woodGrad.addColorStop(1.00, '#e8c891')
    ctx.fillStyle = woodGrad
    ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE)

    /* Wood grain texture */
    ctx.save()
    ctx.globalAlpha = 0.08
    ctx.strokeStyle = '#8b5e1a'
    ctx.lineWidth = 1
    for (let i = 0; i < 40; i++) {
      const x = (i / 40) * BOARD_SIZE
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.bezierCurveTo(x + 10, BOARD_SIZE * 0.4, x - 5, BOARD_SIZE * 0.7, x + 3, BOARD_SIZE)
      ctx.stroke()
    }
    ctx.restore()

    /* === ORNATE BORDER === */
    ctx.strokeStyle = '#5c3a10'
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, BOARD_SIZE - 10, BOARD_SIZE - 10)
    
    ctx.strokeStyle = '#c8961e'
    ctx.lineWidth = 3
    ctx.strokeRect(12, 12, BOARD_SIZE - 24, BOARD_SIZE - 24)

    /* === 5Ã—5 GRID === */
    ctx.strokeStyle = '#2c1a08'
    ctx.lineWidth = 2.5
    for (let i = 0; i <= CELLS; i++) {
      const pos = i * CELL
      ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, BOARD_SIZE); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(BOARD_SIZE, pos); ctx.stroke()
    }

    /* === X DIAGONALS IN ALL CELLS === */
    ctx.strokeStyle = '#2c1a08'
    ctx.lineWidth = 1.8
    for (let row = 0; row < CELLS; row++) {
      for (let col = 0; col < CELLS; col++) {
        const x = col * CELL, y = row * CELL
        ctx.beginPath()
        ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + CELL - 2, y + CELL - 2); ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x + CELL - 2, y + 2); ctx.lineTo(x + 2, y + CELL - 2); ctx.stroke()
      }
    }

    /* === GHATTA (SAFE ZONE) HIGHLIGHTS === */
    ctx.save()
    for (const key of GHATTA_CELLS) {
      const [r, c] = key.split(',').map(Number)
      ctx.globalAlpha = 0.15
      ctx.fillStyle = r === 2 && c === 2 ? '#f39c12' : '#4ecdc4'
      ctx.fillRect(c * CELL + 3, r * CELL + 3, CELL - 6, CELL - 6)
    }
    ctx.restore()

    /* === CENTER HOME CIRCLE === */
    const centerX = 2.5 * CELL, centerY = 2.5 * CELL
    ctx.beginPath(); ctx.arc(centerX, centerY, CELL * 0.4, 0, Math.PI * 2)
    const centerGrad = ctx.createRadialGradient(centerX - 5, centerY - 5, 2, centerX, centerY, CELL * 0.4)
    centerGrad.addColorStop(0, '#ffd700')
    centerGrad.addColorStop(1, '#d4af37')
    ctx.fillStyle = centerGrad; ctx.fill()
    ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 3; ctx.stroke()
    
    /* Star in center */
    ctx.fillStyle = '#8b6914'
    ctx.font = `${CELL * 0.45}px serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('â˜…', centerX, centerY)

    /* === PIECES ON BOARD === */
    const cellOccupants = new Map<string, { player: number; piece: number; movable: boolean }[]>()
    
    for (let p = 0; p < state.numPlayers; p++) {
      for (let i = 0; i < state.pieces[p].length; i++) {
        const pc = state.pieces[p][i]
        if (pc.home || pc.pos === 999) {
          // Piece at center home
          cellOccupants.set('2,2', (cellOccupants.get('2,2') || []).concat({ player: p, piece: i, movable: false }))
          continue
        }
        if (pc.pos === 0 || !pc.entered) continue // in yard
        
        const cell = getTrackCell(p, pc.pos)
        if (!cell) continue
        const key = `${cell[0]},${cell[1]}`
        const movable = state.canMove[p * state.pieces[p].length + i] === true
        cellOccupants.set(key, (cellOccupants.get(key) || []).concat({ player: p, piece: i, movable }))
      }
    }

    /* Draw pieces on board */
    for (const [key, occupants] of cellOccupants) {
      const [row, col] = key.split(',').map(Number)
      const cx = col * CELL + CELL / 2
      const cy = row * CELL + CELL / 2

      occupants.forEach(({ player, piece, movable }, idx) => {
        const offsets = [[0, 0], [-12, -10], [12, -10], [-12, 10], [12, 10], [0, 12]]
        const [ox, oy] = offsets[idx] || [0, 0]
        drawPiece(ctx, cx + ox, cy + oy, player, movable && reminderPulse, movable)
        
        /* Piece number label */
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.font = 'bold 9px Cinzel,serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(String(piece + 1), cx + ox, cy + oy)
      })
    }

    /* === YARD INDICATORS (un-entered pieces) === */
    const yardCorners: [number, [number, number]][] = [
      [0, [0.12, 0.88]], // P0 â€” bottom-left
      [1, [0.88, 0.12]], // P1 â€” top-right
      [2, [0.12, 0.12]], // P2 â€” top-left
      [3, [0.88, 0.88]], // P3 â€” bottom-right
    ]
    
    for (const [pi, [fx, fy]] of yardCorners) {
      if (pi >= state.numPlayers) continue
      const inYard = state.pieces[pi].filter(pc => pc.pos === 0 || !pc.entered).length
      if (inYard === 0) continue
      
      const yx = fx * BOARD_SIZE, yy = fy * BOARD_SIZE
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.beginPath(); ctx.arc(yx, yy, 32, 0, Math.PI * 2)
      ctx.fillStyle = PLAYER_COLORS[pi].fill; ctx.fill()
      ctx.restore()
      
      ctx.fillStyle = PLAYER_COLORS[pi].fill
      ctx.font = 'bold 14px Cinzel,serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`Ã—${inYard}`, yx, yy)
    }

  }, [reminderPulse])

  /* Draw single piece token */
  function drawPiece(ctx: CanvasRenderingContext2D, x: number, y: number, player: number, pulse: boolean, movable: boolean) {
    const R = CELL * 0.28
    const { fill, edge, glow } = PLAYER_COLORS[player]

    ctx.save()
    
    /* Pulsing glow for movable pieces */
    if (pulse && movable) {
      ctx.shadowColor = glow; ctx.shadowBlur = 18
    }
    
    /* Drop shadow */
    ctx.beginPath(); ctx.arc(x + 2, y + 3, R, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill()

    /* Main disc gradient */
    const dGrad = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.05, x, y, R)
    dGrad.addColorStop(0, lighten(fill, 0.35))
    dGrad.addColorStop(0.6, fill)
    dGrad.addColorStop(1, edge)
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2)
    ctx.fillStyle = dGrad; ctx.fill()
    ctx.strokeStyle = edge; ctx.lineWidth = 2.5; ctx.stroke()

    /* Specular highlight */
    const sGrad = ctx.createRadialGradient(x - R * 0.35, y - R * 0.35, 0, x - R * 0.2, y - R * 0.2, R * 0.65)
    sGrad.addColorStop(0, 'rgba(255,255,255,0.6)')
    sGrad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2)
    ctx.fillStyle = sGrad; ctx.fill()

    /* Ring for movable piece */
    if (movable) {
      ctx.beginPath(); ctx.arc(x, y, R + 5, 0, Math.PI * 2)
      ctx.strokeStyle = pulse ? '#fbbf24' : 'rgba(251,191,36,0.6)'
      ctx.lineWidth = pulse ? 3 : 2
      ctx.stroke()
    }
    
    ctx.restore()
  }

  function lighten(hex: string, amt: number): string {
    const num = parseInt(hex.slice(1), 16)
    const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amt))
    const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amt))
    const b = Math.min(255, (num & 0xff) + Math.round(255 * amt))
    return `rgb(${r},${g},${b})`
  }

  /* Redraw on state change */
  useEffect(() => { if (setupDone) draw(gs) }, [gs, draw, setupDone])

  /* â”€â”€ Game Logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  
  /* Check if a piece can move */
  function canPieceMove(state: GameState, player: number, pieceIdx: number): boolean {
    const pc = state.pieces[player][pieceIdx]
    if (pc.home) return false // already home
    
    const score = state.diceScore
    
    /* Mode-specific entry rules */
    if (!pc.entered) {
      if (state.gameMode === 'outer') {
        // Outer entry mode: need 1 or 4 to enter
        return score === 1 || score === 4
      } else if (state.gameMode === 'center') {
        // Center start mode: pieces already on board, need to exit center
        return score > 0
      } else {
        // Normal mode: need 1 or 4 to enter
        return score === 1 || score === 4
      }
    }
    
    /* Check if can move forward without overshooting */
    const track = buildPlayerTrack(PLAYER_RING_STARTS[player], player)
    const newPos = pc.pos + score
    return newPos <= track.length + 1 // allow reaching home (center)
  }

  /* Roll dice */
  const rollDice = () => {
    if (gs.phase !== 'roll' || gameOver) return
    play('dice')
    
    const faces = rollCowries(4)
    const score = scoreCowries(faces)
    
    /* Check which pieces can move */
    const movable: boolean[] = []
    for (let p = 0; p < gs.numPlayers; p++) {
      for (let i = 0; i < gs.pieces[p].length; i++) {
        movable[p * gs.pieces[p].length + i] = (p === gs.turn) && canPieceMove(gs, p, i)
      }
    }
    
    const hasValidMoves = movable.some(m => m)
    
    if (!hasValidMoves) {
      setMsg(`Rolled ${score} â€” No valid moves! Next player.`)
      play('error')
      setTimeout(() => {
        setGs(prev => ({
          ...prev,
          turn: (prev.turn + 1) % prev.numPlayers,
          phase: 'roll',
          diceRolled: false,
          diceFaces: [],
          diceScore: 0,
          canMove: [],
          moveTimeout: 0,
        }))
        setMsg(`${players[(gs.turn + 1) % numPlayers]}'s turn â€” Roll!`)
      }, 1200)
      return
    }
    
    setGs(prev => ({
      ...prev,
      diceRolled: true,
      diceFaces: faces,
      diceScore: score,
      canMove: movable,
      phase: 'move',
      moveTimeout: 0,
    }))
    
    const bonus = score === 8 ? ' ðŸŽ‰ Bonus!' : ''
    setMsg(`Rolled ${score}${bonus} â€” Select a piece to move`)
  }

  /* Move piece */
  const movePiece = (pieceIdx: number) => {
    if (gs.phase !== 'move' || gameOver) return
    const t = gs.turn
    const flatIdx = t * gs.pieces[t].length + pieceIdx
    if (!gs.canMove[flatIdx]) {
      play('error')
      return
    }

    const newState = {
      ...gs,
      pieces: gs.pieces.map((pp, pi) => pp.map((pc, i) => ({...pc}))),
    }
    
    const pc = newState.pieces[t][pieceIdx]
    
    /* Handle entry */
    if (!pc.entered) {
      pc.entered = true
      pc.pos = gs.diceScore
      play('move')
      setMsg(`${players[t]} entered piece ${pieceIdx + 1}!`)
    } else {
      /* Move forward */
      pc.pos += gs.diceScore
      const track = buildPlayerTrack(PLAYER_RING_STARTS[t], t)
      
      /* Check if reached home */
      if (pc.pos >= track.length) {
        pc.home = true
        pc.pos = 999
        play('capture')
        setMsg(`${players[t]}'s piece ${pieceIdx + 1} reached HOME! ðŸ `)
      } else {
        play('move')
        
        /* Capture check (only if not on Ghatta) */
        const cell = getTrackCell(t, pc.pos)
        if (cell && gs.gameMode === 'normal') {
          const cellKey = `${cell[0]},${cell[1]}`
          const isGhatta = GHATTA_CELLS.has(cellKey)
          
          if (!isGhatta) {
            /* Check for opponent pieces at same position */
            for (let p2 = 0; p2 < newState.numPlayers; p2++) {
              if (p2 === t) continue
              for (let j = 0; j < newState.pieces[p2].length; j++) {
                const opp = newState.pieces[p2][j]
                const oppCell = getTrackCell(p2, opp.pos)
                if (oppCell && oppCell[0] === cell[0] && oppCell[1] === cell[1] && opp.entered && !opp.home) {
                  /* CAPTURE! */
                  opp.pos = 0
                  opp.entered = false
                  play('capture')
                  setMsg(`âš” ${players[t]} captured ${players[p2]}'s piece!`)
                }
              }
            }
          }
        }
      }
    }

    /* Check win condition */
    if (newState.pieces[t].every(p => p.home)) {
      setGameOver(true)
      play('win')
      setTimeout(() => onGameOver({
        winner: players[t],
        gameId: 'chowkabara',
        difficulty: config.difficulty,
      }), 800)
      return
    }

    /* Next turn */
    newState.turn = (newState.turn + 1) % newState.numPlayers
    newState.phase = 'roll'
    newState.diceRolled = false
    newState.diceFaces = []
    newState.diceScore = 0
    newState.canMove = []
    newState.moveTimeout = 0
    setGs(newState)
    setMsg(`${players[newState.turn]}'s turn â€” Roll!`)
  }

  /* Reminder pulse timer */
  useEffect(() => {
    if (gs.phase !== 'move' || gameOver) return
    const interval = setInterval(() => {
      setGs(prev => ({ ...prev, moveTimeout: prev.moveTimeout + 1 }))
      if (gs.moveTimeout > 3 && gs.moveTimeout % 2 === 0) {
        setReminderPulse(p => !p) // toggle pulse
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [gs.phase, gs.moveTimeout, gameOver])

  /* Bot AI */
  useEffect(() => {
    if (!isBot || gs.turn !== 1 || gameOver || !setupDone) return
    if (gs.phase === 'roll') {
      const t = setTimeout(rollDice, 800)
      return () => clearTimeout(t)
    }
    if (gs.phase === 'move') {
      const t = setTimeout(() => {
        const movable = gs.canMove.map((m, i) => m && Math.floor(i / gs.pieces[1].length) === 1 ? i % gs.pieces[1].length : -1).filter(i => i >= 0)
        if (movable.length) movePiece(movable[Math.floor(Math.random() * movable.length)])
      }, 1000)
      return () => clearTimeout(t)
    }
  }, [gs, isBot, gameOver, setupDone])

  /* â”€â”€ Canvas Click Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gs.phase !== 'move' || gameOver || (isBot && gs.turn === 1)) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const scale = BOARD_SIZE / rect.width
    const mx = (e.clientX - rect.left) * scale
    const my = (e.clientY - rect.top) * scale
    const col = Math.floor(mx / CELL)
    const row = Math.floor(my / CELL)

    const t = gs.turn
    /* Find piece at clicked cell */
    for (let i = 0; i < gs.pieces[t].length; i++) {
      const pc = gs.pieces[t][i]
      if (pc.home || pc.pos === 0 || !pc.entered) continue
      const cell = getTrackCell(t, pc.pos)
      if (cell && cell[0] === row && cell[1] === col) {
        movePiece(i)
        return
      }
    }
  }

  /* â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  
  /* Setup modal */
  if (!setupDone) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
        <div className="panel-parchment max-w-md w-full p-6 rounded-2xl">
          <h2 className="heading-classical text-3xl text-center mb-4">ðŸŽ² Chowka Bara</h2>
          <p className="text-sm text-center mb-6" style={{ color: 'rgba(245,240,232,0.6)', fontFamily: 'Crimson Text,serif' }}>
            Traditional Indian cross-race board game
          </p>

          {/* Board Type */}
          <div className="mb-5">
            <label className="block text-xs mb-2 uppercase tracking-wider" style={{ color: '#d4a843', fontFamily: 'Cinzel,serif' }}>
              Board Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['5mane', '7mane'] as BoardType[]).map(bt => (
                <button key={bt} onClick={() => setBoardType(bt)}
                  className="py-3 px-4 rounded-lg transition-all"
                  style={{
                    background: boardType === bt ? 'rgba(212,168,67,0.25)' : 'rgba(42,21,9,0.7)',
                    border: `1px solid ${boardType === bt ? '#d4a843' : 'rgba(212,168,67,0.15)'}`,
                    color: boardType === bt ? '#fde68a' : 'rgba(245,240,232,0.6)',
                    fontFamily: 'Cinzel,serif',
                  }}>
                  <div className="text-sm font-semibold">{bt === '5mane' ? '5 à²®à²¨à³†' : '7 à²®à²¨à³†'}</div>
                  <div className="text-xs mt-1" style={{ opacity: 0.7 }}>
                    {PIECES_COUNT[bt]} pieces/player
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Game Mode */}
          <div className="mb-6">
            <label className="block text-xs mb-2 uppercase tracking-wider" style={{ color: '#d4a843', fontFamily: 'Cinzel,serif' }}>
              Game Mode
            </label>
            <div className="space-y-2">
              {[
                { id: 'outer' as GameMode, name: 'Outer Entry', desc: 'Start outside, enter one by one' },
                { id: 'center' as GameMode, name: 'Center Start', desc: 'Start in center, race to home corner' },
                { id: 'normal' as GameMode, name: 'Normal', desc: 'Classic rules with capture' },
              ].map(gm => (
                <button key={gm.id} onClick={() => setGameMode(gm.id)}
                  className="w-full py-2.5 px-4 rounded-lg text-left transition-all"
                  style={{
                    background: gameMode === gm.id ? 'rgba(212,168,67,0.25)' : 'rgba(42,21,9,0.7)',
                    border: `1px solid ${gameMode === gm.id ? '#d4a843' : 'rgba(212,168,67,0.15)'}`,
                    color: gameMode === gm.id ? '#fde68a' : 'rgba(245,240,232,0.6)',
                  }}>
                  <div className="text-sm font-semibold" style={{ fontFamily: 'Cinzel,serif' }}>{gm.name}</div>
                  <div className="text-xs mt-0.5" style={{ fontFamily: 'Crimson Text,serif', opacity: 0.7 }}>
                    {gm.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={startGame} className="btn-gold w-full py-3 text-base">
            ðŸŽ® Start Game
          </button>
          <button onClick={onExit} className="btn-ghost w-full mt-2 py-2 text-sm">
            â† Back to Hub
          </button>
        </div>
      </div>
    )
  }

  /* Main game UI */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 relative z-10 select-none">
      {showHelp && <HowToPlay data={HOW_TO_PLAY.chowkabara} onClose={() => setShowHelp(false)} />}

      {/* Toolbar */}
      <div className="flex items-center justify-between w-full max-w-[520px] mb-2">
        <button onClick={onExit} className="btn-ghost text-xs py-1.5 px-3">â† Exit</button>
        <h2 style={{ fontFamily: 'Cinzel Decorative,serif', color: '#d4a843', fontSize: '1rem' }}>
          ðŸŽ² Chowka Bara â€” {boardType === '5mane' ? '5 à²®à²¨à³†' : '7 à²®à²¨à³†'} ({gameMode})
        </h2>
        <button onClick={() => setShowHelp(true)} className="btn-ghost text-xs py-1.5 px-3">ðŸ“œ Rules</button>
      </div>

      {/* Status message */}
      <div className="text-sm mb-2 px-5 py-2 rounded-full text-center max-w-[460px]"
           style={{
             fontFamily: 'Cinzel,serif', letterSpacing: '0.03em',
             background: 'rgba(42,21,9,0.9)',
             border: `2px solid ${PLAYER_COLORS[gs.turn].glow}`,
             color: PLAYER_COLORS[gs.turn].fill,
             boxShadow: `0 0 12px ${PLAYER_COLORS[gs.turn].glow}`,
           }}>
        {msg}
      </div>

      {/* Reminder notification */}
      {gs.phase === 'move' && gs.moveTimeout > 5 && (
        <div className="text-xs mb-2 px-4 py-1.5 rounded-full animate-bounce"
             style={{
               background: 'rgba(251,191,36,0.2)',
               border: '1px solid rgba(251,191,36,0.5)',
               color: '#fbbf24',
               fontFamily: 'Cinzel,serif',
             }}>
          â° Make your move! Click a highlighted piece.
        </div>
      )}

      <div className="flex gap-4 items-start">
        {/* Board */}
        <canvas
          ref={canvasRef}
          width={BOARD_SIZE} height={BOARD_SIZE}
          className="rounded-xl cursor-pointer"
          style={{
            maxWidth: 'min(480px, 88vw)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.7), 0 0 0 4px #8b5e2a, 0 0 0 6px rgba(212,168,67,0.3)',
          }}
          onClick={handleCanvasClick}
        />

        {/* Side panel */}
        <div className="flex flex-col gap-3 min-w-[140px]">
          {/* Dice */}
          <div className="panel-parchment rounded-xl p-3 text-center">
            <div className="text-xs mb-2 uppercase tracking-widest" style={{ color: '#d4a843', fontFamily: 'Cinzel,serif' }}>
              Cowries
            </div>
            <div className="flex gap-1 justify-center mb-2">
              {(gs.diceFaces.length ? gs.diceFaces : [0, 0, 0, 0]).map((f, i) => (
                <CowrieShell key={i} faceUp={f === 1} />
              ))}
            </div>
            {gs.diceScore > 0 && (
              <div className="text-2xl font-bold" style={{ color: '#f39c12', fontFamily: 'Cinzel Decorative,serif' }}>
                = {gs.diceScore}
                {gs.diceScore === 8 && ' ðŸŽ‰'}
              </div>
            )}
          </div>

          {/* Roll button */}
          {gs.phase === 'roll' && !gameOver && !(isBot && gs.turn === 1) && (
            <button onClick={rollDice} className="btn-gold py-3 text-sm">
              ðŸŽ² Roll Cowries
            </button>
          )}

          {/* Players */}
          {players.map((name, pi) => {
            const homeCount = gs.pieces[pi].filter(p => p.home).length
            const totalPieces = gs.pieces[pi].length
            return (
              <div key={pi} className="rounded-xl p-3"
                   style={{
                     background: 'rgba(26,12,6,0.9)',
                     border: `2px solid ${gs.turn === pi && !gameOver ? PLAYER_COLORS[pi].glow : 'rgba(212,168,67,0.1)'}`,
                     transition: 'all 0.3s',
                   }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full" style={{ background: PLAYER_COLORS[pi].fill }} />
                  <span className="text-xs font-semibold truncate" style={{ color: PLAYER_COLORS[pi].fill, fontFamily: 'Cinzel,serif' }}>
                    {name}
                  </span>
                  {homeCount === totalPieces && <span>ðŸ†</span>}
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: totalPieces }, (_, i) => (
                    <div key={i} className="flex-1 h-2 rounded-full"
                         style={{
                           background: i < homeCount ? PLAYER_COLORS[pi].fill : 'rgba(212,168,67,0.1)',
                         }} />
                  ))}
                </div>
                <div className="text-xs text-center mt-1" style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Cinzel,serif' }}>
                  {homeCount}/{totalPieces} Home
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* â”€â”€ Cowrie Shell Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function CowrieShell({ faceUp }: { faceUp: boolean }) {
  return (
    <div
      style={{
        width: 20, height: 20,
        borderRadius: '50%',
        background: faceUp
          ? 'radial-gradient(circle at 30% 30%, #fff8dc, #daa520)'
          : 'radial-gradient(circle at 30% 30%, #8b7355, #5c4033)',
        border: `2px solid ${faceUp ? '#b8860b' : '#3e2723'}`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {faceUp && (
        <div style={{
          width: 8, height: 8,
          borderRadius: '50%',
          background: 'rgba(139,115,85,0.3)',
        }} />
      )}
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { GameResult } from '../App'

interface Props {
  result:      GameResult
  onPlayAgain: () => void
  onHome:      () => void
}

export default function GameOver({ result, onPlayAgain, onHome }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDraw    = result.winner === 'Draw'

  /* Gold + crimson confetti */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    const COLORS = ['#fbbf24','#f59e0b','#d4a843','#c0395a','#9b2a44','#f5f0e8','#fde68a']
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 5 + 3,
      d: Math.random() * 120,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      tilt: Math.floor(Math.random() * 10) - 10,
      tiltAngle: 0,
      tiltInc: Math.random() * 0.07 + 0.05,
    }))

    let angle = 0
    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      angle += 0.01
      for (const p of pieces) {
        p.tiltAngle += p.tiltInc
        p.y += (Math.cos(angle + p.d) + 1.2 + p.r / 2) * 1.4
        p.tilt = Math.sin(p.tiltAngle) * 15
        if (p.y > canvas.height) { p.x = Math.random() * canvas.width; p.y = -10 }
        ctx.beginPath()
        ctx.lineWidth = p.r / 2
        ctx.strokeStyle = p.color
        ctx.moveTo(p.x + p.tilt + p.r / 4, p.y)
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4)
        ctx.stroke()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center relative z-10 px-4">
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-sm animate-bounce-in">
        {/* Outer glow frame */}
        <div className="absolute -inset-1 rounded-2xl opacity-40"
             style={{ background: 'linear-gradient(135deg,#d4a843,#9b2a44,#d4a843)', filter: 'blur(8px)' }} />

        <div className="relative panel-royal overflow-hidden text-center">
          {/* Top strip */}
          <div className="h-1"
               style={{ background: 'linear-gradient(90deg,transparent,#fbbf24,#d4a843,#fbbf24,transparent)' }} />

          <div className="p-8">
            {/* Trophy */}
            <div className="text-7xl mb-3 drop-shadow-xl animate-float">
              {isDraw ? '🤝' : '🏆'}
            </div>

            {/* Title */}
            <h2 className="heading-classical text-2xl mb-1">
              {isDraw ? 'Honourable Draw' : 'Victory!'}
            </h2>

            <div className="divider-classical my-3">
              <span className="text-xs tracking-widest uppercase"
                    style={{ color: 'rgba(212,168,67,0.5)', fontFamily: 'Cinzel,serif' }}>
                {isDraw ? 'A Contest of Equals' : 'Champion Proclaimed'}
              </span>
            </div>

            {!isDraw && (
              <p className="text-xl font-semibold mb-1"
                 style={{ fontFamily: 'Cinzel Decorative, serif', color: '#fde68a' }}>
                {result.winner}
              </p>
            )}
            {result.score !== undefined && (
              <p className="text-sm mb-4"
                 style={{ color: 'rgba(212,168,67,0.55)', fontFamily: 'Crimson Text, serif', fontStyle: 'italic' }}>
                Score: {result.score} points
              </p>
            )}

            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <button onClick={onPlayAgain} className="btn-gold flex-1 py-3">
                ⚔ Play Again
              </button>
              <button onClick={onHome} className="btn-ghost flex-1 py-3">
                🏰 Hall
              </button>
            </div>
          </div>

          <div className="h-px"
               style={{ background: 'linear-gradient(90deg,transparent,rgba(212,168,67,0.35),transparent)' }} />
        </div>
      </div>
    </div>
  )
}

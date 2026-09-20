import { GameResult } from '../App'
import { useEffect, useRef } from 'react'

interface Props {
  result:      GameResult
  onPlayAgain: () => void
  onHome:      () => void
}

export default function GameOver({ result, onPlayAgain, onHome }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /* confetti */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    const pieces = Array.from({ length: 150 }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height - canvas.height,
      r:  Math.random() * 6 + 3,
      d:  Math.random() * 150,
      color: `hsl(${Math.random()*360},80%,60%)`,
      tilt: Math.floor(Math.random() * 10) - 10,
      tiltAngle: 0, tiltAngleInc: Math.random() * 0.07 + 0.05,
    }))

    let angle = 0
    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      angle += 0.01
      for (const p of pieces) {
        p.tiltAngle += p.tiltAngleInc
        p.y += (Math.cos(angle + p.d) + 1 + p.r / 2) * 1.5
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

  const isDraw = result.winner === 'Draw'

  return (
    <div className="min-h-screen flex items-center justify-center relative z-10 px-4">
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />
      <div className="card-glass p-10 text-center max-w-sm w-full relative z-10 animate-bounce-in">
        <div className="text-7xl mb-4">{isDraw ? '🤝' : '🏆'}</div>
        <h2 className="font-display text-3xl font-bold mb-2
                       bg-gradient-to-r from-gold-400 to-gold-300 bg-clip-text text-transparent">
          {isDraw ? "It's a Draw!" : 'Winner!'}
        </h2>
        {!isDraw && (
          <p className="text-white text-xl font-semibold mb-1">{result.winner}</p>
        )}
        {result.score !== undefined && (
          <p className="text-white/50 text-sm mb-6">Score: {result.score}</p>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={onPlayAgain} className="game-btn-primary flex-1">
            🔄 Play Again
          </button>
          <button onClick={onHome} className="game-btn-ghost flex-1">
            🏠 Home
          </button>
        </div>
      </div>
    </div>
  )
}

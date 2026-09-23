import { useEffect, useRef } from 'react'

/* Subtle floating ember / dust particles for classical atmosphere */
export default function ParticlesBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf: number

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    // Embers: warm gold & crimson dust
    const particles = Array.from({ length: 55 }, () => ({
      x:  Math.random() * window.innerWidth,
      y:  Math.random() * window.innerHeight,
      r:  Math.random() * 1.5 + 0.4,
      dx: (Math.random() - 0.5) * 0.18,
      dy: -(Math.random() * 0.25 + 0.05),   // drift upward like embers
      alpha: Math.random() * 0.35 + 0.05,
      hue: Math.random() < 0.6 ? 38 : 350,  // gold or crimson
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue},80%,65%,${p.alpha})`
        ctx.fill()
        p.x += p.dx
        p.y += p.dy
        if (p.y < -5) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width }
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.55 }}
    />
  )
}

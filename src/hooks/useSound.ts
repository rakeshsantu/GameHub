import { useCallback } from 'react'

type SoundType = 'move' | 'capture' | 'win' | 'dice' | 'click' | 'error'

const frequencies: Record<SoundType, number[]> = {
  click:   [800],
  move:    [440, 520],
  capture: [300, 200, 150],
  win:     [523, 659, 784, 1047],
  dice:    [200, 400, 300],
  error:   [200, 180],
}

export function useSound() {
  const play = useCallback((type: SoundType) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const freqs = frequencies[type]
      freqs.forEach((f, i) => {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = f
        osc.type = type === 'win' ? 'sine' : 'square'
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.08)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.15)
        osc.start(ctx.currentTime + i * 0.08)
        osc.stop(ctx.currentTime  + i * 0.08 + 0.15)
      })
    } catch {}
  }, [])

  return { play }
}

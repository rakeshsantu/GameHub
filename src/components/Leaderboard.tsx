import { useLocalStorage } from '../hooks/useLocalStorage'
import { LeaderboardEntry } from '../types'

interface Props { onBack: () => void }

export default function Leaderboard({ onBack }: Props) {
  const [entries] = useLocalStorage<LeaderboardEntry[]>('gh_leaderboard', [])

  const sorted = [...entries].sort((a, b) => b.score - a.score).slice(0, 20)

  return (
    <div className="min-h-screen relative z-10 max-w-2xl mx-auto px-4 py-8">
      <button onClick={onBack} className="game-btn-ghost text-sm mb-6 flex items-center gap-2 py-2">
        ← Back
      </button>
      <h2 className="font-display text-3xl font-bold mb-6 text-center
                     bg-gradient-to-r from-gold-400 to-gold-300 bg-clip-text text-transparent">
        🏆 Leaderboard
      </h2>
      {sorted.length === 0 ? (
        <div className="card-glass p-10 text-center text-white/30">
          No scores yet. Play some games!
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((e, i) => (
            <div key={i} className="card-glass px-5 py-4 flex items-center gap-4">
              <span className={`text-xl font-bold w-8 ${i === 0 ? 'text-gold-400' : i === 1 ? 'text-white/60' : i === 2 ? 'text-amber-600' : 'text-white/30'}`}>
                #{i+1}
              </span>
              <div className="flex-1">
                <div className="text-white font-medium">{e.name}</div>
                <div className="text-white/40 text-xs">{e.game} · {e.difficulty} · {e.date}</div>
              </div>
              <div className="text-gold-400 font-bold">{e.score}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

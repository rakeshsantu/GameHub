import { useLocalStorage } from '../hooks/useLocalStorage'
import { LeaderboardEntry } from '../types'

interface Props { onBack: () => void }

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard({ onBack }: Props) {
  const [entries] = useLocalStorage<LeaderboardEntry[]>('gh_leaderboard', [])
  const sorted = [...entries].sort((a, b) => b.score - a.score).slice(0, 20)

  return (
    <div className="min-h-screen relative z-10 max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <button onClick={onBack} className="btn-ghost text-sm mb-6 flex items-center gap-2 py-2 px-4">
        ← Return to Hall
      </button>

      <div className="panel-royal overflow-hidden">
        <div className="h-1"
             style={{ background: 'linear-gradient(90deg,transparent,#fbbf24,#d4a843,#fbbf24,transparent)' }} />
        <div className="p-6">
          <h2 className="heading-classical text-3xl text-center mb-1">Hall of Fame</h2>
          <div className="divider-classical mb-6">
            <span className="text-xs tracking-widest uppercase"
                  style={{ color: 'rgba(212,168,67,0.45)', fontFamily: 'Cinzel,serif' }}>
              Champions of the Realm
            </span>
          </div>

          {sorted.length === 0 ? (
            <div className="text-center py-12"
                 style={{ color: 'rgba(245,240,232,0.3)', fontFamily: 'Crimson Text,serif', fontStyle:'italic', fontSize:'1.1rem' }}>
              No champions yet.<br/>Play some games to etch your name here.
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((e, i) => (
                <div key={i}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg transition-colors"
                  style={{
                    background: i < 3 ? 'rgba(212,168,67,0.07)' : 'rgba(42,21,9,0.5)',
                    border: i < 3 ? '1px solid rgba(212,168,67,0.25)' : '1px solid rgba(212,168,67,0.1)',
                  }}>
                  <span className="text-xl w-8 text-center">
                    {i < 3 ? MEDALS[i] : <span style={{ color:'rgba(212,168,67,0.3)', fontFamily:'Cinzel,serif', fontSize:'0.8rem' }}>#{i+1}</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold"
                         style={{ color:'#f5f0e8', fontFamily:'Cinzel,serif' }}>{e.name}</div>
                    <div className="text-xs truncate"
                         style={{ color:'rgba(212,168,67,0.45)', fontFamily:'Crimson Text,serif' }}>
                      {e.game} · {e.difficulty} · {e.date}
                    </div>
                  </div>
                  <div className="text-lg font-bold"
                       style={{ color:'#fbbf24', fontFamily:'Cinzel Decorative,serif' }}>{e.score}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="h-px"
             style={{ background: 'linear-gradient(90deg,transparent,rgba(212,168,67,0.3),transparent)' }} />
      </div>
    </div>
  )
}

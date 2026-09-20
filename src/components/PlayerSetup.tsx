import { useState } from 'react'
import { GameInfo, GameConfig, Difficulty, GameMode } from '../types'

interface Props {
  game:    GameInfo
  onStart: (cfg: GameConfig) => void
  onBack:  () => void
}

const DIFF_INFO: Record<Difficulty, { label: string; desc: string; color: string }> = {
  easy:   { label:'Easy',   desc:'Relaxed pace — great for beginners.',   color:'text-green-400'  },
  medium: { label:'Medium', desc:'Balanced challenge for casual players.', color:'text-yellow-400' },
  hard:   { label:'Hard',   desc:'Expert AI — can you beat it?',           color:'text-red-400'    },
}

export default function PlayerSetup({ game, onStart, onBack }: Props) {
  const [mode,       setMode]       = useState<GameMode>('vs-bot')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [players,    setPlayers]    = useState<string[]>(['Player 1', 'Player 2'])

  const handleStart = () => {
    onStart({ mode, difficulty, players })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
      <div className="w-full max-w-md">
        {/* Back */}
        <button onClick={onBack} className="game-btn-ghost text-sm mb-6 flex items-center gap-2 py-2">
          ← Back to Hub
        </button>

        <div className="card-glass p-7 space-y-6">
          {/* Title */}
          <div className="text-center">
            <div className="text-5xl mb-2">{game.emoji}</div>
            <h2 className="font-display text-2xl font-bold text-white">{game.title}</h2>
            <p className="text-white/50 text-sm mt-1">{game.description}</p>
          </div>

          {/* Mode selector */}
          {game.hasBot && (
            <div>
              <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">
                Game Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['vs-bot','multiplayer'] as GameMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`py-3 rounded-xl text-sm font-medium transition-all
                      ${mode === m
                        ? 'bg-brand-600 text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10 border border-white/10'}`}
                  >
                    {m === 'vs-bot' ? '🤖 vs Bot' : '👥 Multiplayer'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Difficulty (show for bot mode or puzzle) */}
          {(mode === 'vs-bot' || !game.hasBot) && (
            <div>
              <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">
                Difficulty
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(DIFF_INFO) as Difficulty[]).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`py-3 rounded-xl text-sm font-medium transition-all
                      ${difficulty === d
                        ? 'bg-brand-600 text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10 border border-white/10'}`}
                  >
                    <div className={difficulty === d ? 'text-white' : DIFF_INFO[d].color}>
                      {DIFF_INFO[d].label}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-white/30 text-xs mt-2 text-center">
                {DIFF_INFO[difficulty].desc}
              </p>
            </div>
          )}

          {/* Player names */}
          <div>
            <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">
              Player Names
            </label>
            <div className="space-y-2">
              {players.map((name, i) => (
                <input
                  key={i}
                  type="text"
                  value={name}
                  maxLength={20}
                  onChange={e => {
                    const copy = [...players]
                    copy[i] = e.target.value
                    setPlayers(copy)
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5
                             text-white placeholder-white/30 text-sm outline-none
                             focus:border-brand-500 transition-colors"
                  placeholder={`Player ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Start */}
          <button onClick={handleStart} className="game-btn-gold w-full text-base py-3.5">
            🎮 Start Game
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { GameInfo, GameConfig, Difficulty, GameMode } from '../types'

interface Props {
  game:    GameInfo
  onStart: (cfg: GameConfig) => void
  onBack:  () => void
}

const DIFF: Record<Difficulty, { label: string; desc: string; icon: string }> = {
  easy:   { label: 'Novice',   desc: 'Relaxed pace — learn the game.',    icon: '🌱' },
  medium: { label: 'Scholar',  desc: 'Balanced — a worthy challenge.',    icon: '📜' },
  hard:   { label: 'Master',   desc: 'Expert AI — prove your mastery.',   icon: '👑' },
}

export default function PlayerSetup({ game, onStart, onBack }: Props) {
  const [mode,       setMode]       = useState<GameMode>('vs-bot')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [players,    setPlayers]    = useState<string[]>(['Player I', 'Player II'])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-10 py-8">
      <div className="w-full max-w-md animate-slide-up">

        {/* Back */}
        <button onClick={onBack}
          className="btn-ghost text-sm mb-6 flex items-center gap-2 py-2 px-4">
          ← Return to Hall
        </button>

        {/* Card */}
        <div className="panel-royal overflow-hidden">
          {/* Header strip */}
          <div className="h-1 w-full"
               style={{ background: 'linear-gradient(90deg,transparent,#d4a843,#fbbf24,#d4a843,transparent)' }} />

          <div className="p-7 space-y-6">
            {/* Game identity */}
            <div className="text-center">
              <div className="text-6xl mb-3 drop-shadow-xl">{game.emoji}</div>
              <h2 className="heading-classical text-2xl mb-2">{game.title}</h2>
              <div className="divider-classical">
                <span className="text-xs tracking-widest uppercase"
                      style={{ color: 'rgba(212,168,67,0.5)', fontFamily: 'Cinzel,serif' }}>
                  Choose Your Battle
                </span>
              </div>
              <p className="text-sm leading-relaxed mt-1"
                 style={{ color: 'rgba(245,240,232,0.5)', fontFamily: 'Crimson Text, serif' }}>
                {game.description}
              </p>
            </div>

            {/* Mode selector */}
            {game.hasBot && (
              <div>
                <label className="block text-xs tracking-[0.15em] uppercase mb-2"
                       style={{ color: 'rgba(212,168,67,0.6)', fontFamily: 'Cinzel,serif' }}>
                  Mode of Engagement
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['vs-bot','multiplayer'] as GameMode[]).map(m => (
                    <button key={m} onClick={() => setMode(m)}
                      className="py-3 rounded-lg text-sm font-semibold transition-all duration-200"
                      style={{
                        fontFamily: 'Cinzel, serif',
                        background: mode === m
                          ? 'linear-gradient(180deg,#9b2a44 0%,#7a1f34 100%)'
                          : 'rgba(42,21,9,0.6)',
                        border: mode === m
                          ? '1px solid rgba(212,168,67,0.5)'
                          : '1px solid rgba(212,168,67,0.15)',
                        color: mode === m ? '#fde68a' : 'rgba(245,240,232,0.45)',
                        boxShadow: mode === m ? '0 2px 12px rgba(0,0,0,0.5)' : 'none',
                      }}>
                      {m === 'vs-bot' ? '🤖 Vs. Bot' : '👥 Multiplayer'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Difficulty */}
            {(mode === 'vs-bot' || !game.hasBot) && (
              <div>
                <label className="block text-xs tracking-[0.15em] uppercase mb-2"
                       style={{ color: 'rgba(212,168,67,0.6)', fontFamily: 'Cinzel,serif' }}>
                  Difficulty
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(DIFF) as Difficulty[]).map(d => (
                    <button key={d} onClick={() => setDifficulty(d)}
                      className="py-3 rounded-lg text-sm transition-all duration-200 flex flex-col items-center gap-1"
                      style={{
                        fontFamily: 'Cinzel, serif',
                        background: difficulty === d
                          ? 'linear-gradient(180deg,#9b2a44 0%,#7a1f34 100%)'
                          : 'rgba(42,21,9,0.6)',
                        border: difficulty === d
                          ? '1px solid rgba(212,168,67,0.5)'
                          : '1px solid rgba(212,168,67,0.15)',
                        color: difficulty === d ? '#fde68a' : 'rgba(245,240,232,0.45)',
                        boxShadow: difficulty === d ? '0 2px 12px rgba(0,0,0,0.5)' : 'none',
                      }}>
                      <span>{DIFF[d].icon}</span>
                      <span className="text-xs">{DIFF[d].label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-center text-xs mt-2"
                   style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Crimson Text,serif', fontStyle: 'italic' }}>
                  {DIFF[difficulty].desc}
                </p>
              </div>
            )}

            {/* Player names */}
            <div>
              <label className="block text-xs tracking-[0.15em] uppercase mb-2"
                     style={{ color: 'rgba(212,168,67,0.6)', fontFamily: 'Cinzel,serif' }}>
                Contestants
              </label>
              <div className="space-y-2">
                {players.map((name, i) => (
                  <div key={i} className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                          style={{ color: 'rgba(212,168,67,0.5)' }}>
                      {i === 0 ? '⚔' : '🛡'}
                    </span>
                    <input
                      type="text" value={name} maxLength={20}
                      onChange={e => { const c=[...players]; c[i]=e.target.value; setPlayers(c) }}
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                      style={{
                        background: 'rgba(26,12,6,0.7)',
                        border: '1px solid rgba(212,168,67,0.25)',
                        color: '#f5f0e8',
                        fontFamily: 'Cinzel, serif',
                      }}
                      onFocus={e => (e.target.style.borderColor='rgba(212,168,67,0.55)')}
                      onBlur={e  => (e.target.style.borderColor='rgba(212,168,67,0.25)')}
                      placeholder={`Player ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <button onClick={() => onStart({ mode, difficulty, players })}
              className="btn-gold w-full py-4 text-base">
              ⚔ Begin the Game
            </button>
          </div>

          <div className="h-0.5 w-full"
               style={{ background: 'linear-gradient(90deg,transparent,rgba(212,168,67,0.3),transparent)' }} />
        </div>
      </div>
    </div>
  )
}

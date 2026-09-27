import { useEffect, useState } from 'react'
import { Player, GameRanking, GameResultRecord } from '../types'
import { MergeResult } from '../hooks/useAuth'
import ChangePassword from './ChangePassword'

// ─── Rank badge config ─────────────────────────────────────────────────────
const RANK_CONFIG: Record<string, { icon: string; color: string; next: number }> = {
  'Novice':      { icon: '🌱', color: '#6b7280', next: 50   },
  'Apprentice':  { icon: '📜', color: '#10b981', next: 200  },
  'Scholar':     { icon: '🎓', color: '#3b82f6', next: 500  },
  'Champion':    { icon: '⚔',  color: '#8b5cf6', next: 1000 },
  'Master':      { icon: '👑', color: '#f59e0b', next: 2000 },
  'Grand Master':{ icon: '🔥', color: '#ef4444', next: 9999 },
}

interface Props {
  player:        Player
  onBack:        () => void
  onLogout:      () => void
  mergeResult?:  MergeResult | null
  onDismissMerge?: () => void
  onChangePassword: (currentPw: string, newPw: string, confirm: string) => Promise<boolean>
  changePwLoading:  boolean
  changePwError:    string | null
  onClearPwError:   () => void
  refreshProfile: () => Promise<{
    player: Player
    gameRankings: GameRanking[]
    recentResults: GameResultRecord[]
  } | null>
}

const MEDALS = ['🥇', '🥈', '🥉']
const WIN_RATE = (p: Player) =>
  p.games_played > 0 ? Math.round((p.games_won / p.games_played) * 100) : 0

export default function PlayerProfile({ player, onBack, onLogout, refreshProfile, mergeResult, onDismissMerge, onChangePassword, changePwLoading, changePwError, onClearPwError }: Props) {
  const [tab,           setTab]           = useState<'overview' | 'games' | 'history'>('overview')
  const [gameRankings,  setGameRankings]  = useState<GameRanking[]>([])
  const [recentResults, setRecentResults] = useState<GameResultRecord[]>([])
  const [loading,       setLoading]       = useState(true)
  const [fullPlayer,    setFullPlayer]    = useState<Player>(player)
  const [showChangePw,  setShowChangePw]  = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    refreshProfile().then(data => {
      if (!alive || !data) return
      setFullPlayer(data.player)
      setGameRankings(data.gameRankings as GameRanking[])
      setRecentResults(data.recentResults as GameResultRecord[])
      setLoading(false)
    })
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rank   = RANK_CONFIG[fullPlayer.rank_title] ?? RANK_CONFIG['Novice']
  const nextPts= rank.next
  const pct    = Math.min(Math.round((fullPlayer.total_points / nextPts) * 100), 100)

  return (
    <div className="min-h-screen relative z-10 max-w-3xl mx-auto px-4 py-8 animate-fade-in">

      {/* ── Merge success banner ───────────────────────────────────────────── */}
      {mergeResult && mergeResult.merged > 0 && (
        <div className="mb-5 px-5 py-4 rounded-xl animate-slide-up"
             style={{
               background: 'linear-gradient(135deg,rgba(26,12,6,0.98),rgba(42,21,9,0.98))',
               border: '1px solid rgba(212,168,67,0.45)',
               boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
             }}>
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">🎒</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold mb-1"
                   style={{ color: '#fde68a', fontFamily: 'Cinzel,serif' }}>
                Guest Progress Merged Successfully
              </div>
              <div className="text-xs leading-relaxed"
                   style={{ color: 'rgba(245,240,232,0.65)', fontFamily: 'Crimson Text,serif' }}>
                <span className="font-semibold" style={{ color: '#fbbf24' }}>
                  {mergeResult.merged} game{mergeResult.merged !== 1 ? 's' : ''}
                </span>{' '}
                from your guest session have been added to this account.
                {mergeResult.pointsDelta !== 0 && (
                  <>
                    {' '}Net points transferred:{' '}
                    <span style={{ color: mergeResult.pointsDelta > 0 ? '#fbbf24' : '#fca5a5', fontWeight: 600 }}>
                      {mergeResult.pointsDelta > 0 ? '+' : ''}{mergeResult.pointsDelta} pts
                    </span>
                    .
                  </>
                )}
                {' '}Your rank is now{' '}
                <span style={{ color: '#fde68a', fontWeight: 600 }}>{mergeResult.player.rank_title}</span>.
              </div>
              {/* Mini stat row */}
              <div className="flex gap-4 mt-2.5">
                {[
                  { label: 'Total Points', value: mergeResult.player.total_points.toLocaleString() },
                  { label: 'Games Played', value: mergeResult.player.games_played },
                  { label: 'Wins',         value: mergeResult.player.games_won },
                ].map(s => (
                  <div key={s.label}>
                    <div className="text-sm font-bold" style={{ color: '#fbbf24', fontFamily: 'Cinzel Decorative,serif' }}>
                      {s.value}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider"
                         style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Cinzel,serif' }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {onDismissMerge && (
              <button onClick={onDismissMerge}
                className="text-lg leading-none shrink-0 transition-opacity hover:opacity-100"
                style={{ color: 'rgba(212,168,67,0.35)' }}
                aria-label="Dismiss">
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="btn-ghost text-sm flex items-center gap-2 py-2 px-4">
          ← Return to Hall
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowChangePw(true)}
            className="btn-ghost text-sm flex items-center gap-2 py-2 px-4"
            style={{ color: 'rgba(212,168,67,0.6)' }}>
            🔑 Password
          </button>
          <button onClick={onLogout} className="btn-ghost text-sm flex items-center gap-2 py-2 px-4"
                  style={{ color: 'rgba(252,165,165,0.7)' }}>
            🚪 Logout
          </button>
        </div>
      </div>

      <div className="panel-royal overflow-hidden">
        <div className="h-1"
             style={{ background: 'linear-gradient(90deg,transparent,#fbbf24,#d4a843,#fbbf24,transparent)' }} />

        {/* ── Hero section ──────────────────────────────────────────────── */}
        <div className="p-6 pb-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">

            {/* Avatar + rank badge */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                   style={{ background: 'rgba(26,12,6,0.9)', border: '2px solid rgba(212,168,67,0.4)' }}>
                {fullPlayer.avatar}
              </div>
              <div className="absolute -bottom-2 -right-2 text-xl leading-none"
                   title={fullPlayer.rank_title}>
                {rank.icon}
              </div>
            </div>

            {/* Name & stats */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="heading-classical text-2xl leading-tight">{fullPlayer.username}</h2>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-1 mb-3">
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                      style={{
                        background: 'rgba(212,168,67,0.15)',
                        border: '1px solid rgba(212,168,67,0.35)',
                        color: rank.color,
                        fontFamily: 'Cinzel,serif',
                      }}>
                  {rank.icon} {fullPlayer.rank_title}
                </span>
                {fullPlayer.overall_rank && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(155,42,68,0.2)',
                          border: '1px solid rgba(155,42,68,0.4)',
                          color: '#fde68a',
                          fontFamily: 'Cinzel,serif',
                        }}>
                    #{fullPlayer.overall_rank} Overall
                  </span>
                )}
              </div>

              {/* Stat pills */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                {[
                  { label: 'Points',   value: fullPlayer.total_points.toLocaleString(), icon: '✨' },
                  { label: 'Played',   value: fullPlayer.games_played,                  icon: '🎮' },
                  { label: 'Won',      value: fullPlayer.games_won,                     icon: '🏆' },
                  { label: 'Win Rate', value: `${WIN_RATE(fullPlayer)}%`,               icon: '📊' },
                ].map(s => (
                  <div key={s.label} className="text-center px-3 py-2 rounded-xl"
                       style={{ background: 'rgba(42,21,9,0.7)', border: '1px solid rgba(212,168,67,0.15)' }}>
                    <div className="text-base">{s.icon}</div>
                    <div className="text-sm font-bold" style={{ color: '#fbbf24', fontFamily: 'Cinzel Decorative,serif' }}>
                      {s.value}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider mt-0.5"
                         style={{ color: 'rgba(212,168,67,0.45)', fontFamily: 'Cinzel,serif' }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* XP Progress bar */}
          <div className="mt-5 mb-1">
            <div className="flex justify-between text-xs mb-1.5"
                 style={{ color: 'rgba(212,168,67,0.5)', fontFamily: 'Cinzel,serif' }}>
              <span>{fullPlayer.rank_title}</span>
              <span>{fullPlayer.total_points} / {nextPts} pts</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden"
                 style={{ background: 'rgba(42,21,9,0.8)', border: '1px solid rgba(212,168,67,0.15)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                   style={{
                     width: `${pct}%`,
                     background: 'linear-gradient(90deg,#9b2a44,#d4a843,#fbbf24)',
                   }} />
            </div>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex gap-1 px-6 mt-5 border-b"
             style={{ borderColor: 'rgba(212,168,67,0.15)' }}>
          {([
            { id: 'overview', label: '⚜ Overview' },
            { id: 'games',    label: '🎮 Game Ranks' },
            { id: 'history',  label: '📜 History' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-4 py-2.5 text-xs font-semibold transition-all rounded-t-lg"
              style={{
                fontFamily: 'Cinzel,serif',
                color: tab === t.id ? '#fde68a' : 'rgba(245,240,232,0.35)',
                borderBottom: tab === t.id ? '2px solid #d4a843' : '2px solid transparent',
                background: tab === t.id ? 'rgba(212,168,67,0.08)' : 'transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ─────────────────────────────────────────────── */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12"
                 style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Crimson Text,serif', fontStyle: 'italic' }}>
              ⏳ Loading your chronicles…
            </div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {tab === 'overview' && (
                <div className="space-y-4">
                  <h3 className="heading-classical text-lg mb-3">Rank Progression</h3>
                  {Object.entries(RANK_CONFIG).map(([name, cfg]) => {
                    const isCurrentRank = fullPlayer.rank_title === name
                    const isPastRank    = fullPlayer.total_points >= cfg.next
                    return (
                      <div key={name}
                        className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all"
                        style={{
                          background: isCurrentRank
                            ? 'rgba(212,168,67,0.1)'
                            : 'rgba(42,21,9,0.4)',
                          border: isCurrentRank
                            ? '1px solid rgba(212,168,67,0.35)'
                            : '1px solid rgba(212,168,67,0.08)',
                          opacity: !isPastRank && !isCurrentRank ? 0.4 : 1,
                        }}>
                        <span className="text-2xl">{cfg.icon}</span>
                        <div className="flex-1">
                          <div className="text-sm font-semibold"
                               style={{ color: isCurrentRank ? '#fde68a' : 'rgba(245,240,232,0.6)', fontFamily: 'Cinzel,serif' }}>
                            {name}
                            {isCurrentRank && (
                              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full"
                                    style={{ background: 'rgba(155,42,68,0.4)', color: '#fca5a5' }}>
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-xs mt-0.5"
                               style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Crimson Text,serif' }}>
                            Requires {cfg.next.toLocaleString()} points
                          </div>
                        </div>
                        <div className="text-lg">
                          {isPastRank ? '✅' : isCurrentRank ? '⚡' : '🔒'}
                        </div>
                      </div>
                    )
                  })}

                  {/* Member since */}
                  {fullPlayer.created_at && (
                    <p className="text-center text-xs mt-4"
                       style={{ color: 'rgba(212,168,67,0.3)', fontFamily: 'Crimson Text,serif', fontStyle: 'italic' }}>
                      Member since {new Date(fullPlayer.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  )}
                </div>
              )}

              {/* GAME RANKS TAB */}
              {tab === 'games' && (
                <div>
                  <h3 className="heading-classical text-lg mb-4">Per-Game Rankings</h3>
                  {gameRankings.length === 0 ? (
                    <div className="text-center py-10"
                         style={{ color: 'rgba(245,240,232,0.3)', fontFamily: 'Crimson Text,serif', fontStyle: 'italic' }}>
                      Play some games to see your rankings here.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {gameRankings.map((gr, i) => {
                        const wr = gr.total_played > 0
                          ? Math.round((gr.total_won / gr.total_played) * 100)
                          : 0
                        return (
                          <div key={gr.game_id}
                            className="flex items-center gap-4 px-4 py-3 rounded-xl"
                            style={{
                              background: i < 3 ? 'rgba(212,168,67,0.07)' : 'rgba(42,21,9,0.5)',
                              border: i < 3
                                ? '1px solid rgba(212,168,67,0.25)'
                                : '1px solid rgba(212,168,67,0.1)',
                            }}>
                            <span className="text-xl w-8 text-center">
                              {i < 3 ? MEDALS[i] : (
                                <span style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Cinzel,serif', fontSize: '0.75rem' }}>
                                  #{gr.game_rank}
                                </span>
                              )}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate"
                                   style={{ color: '#f5f0e8', fontFamily: 'Cinzel,serif' }}>
                                {gr.game_title}
                              </div>
                              <div className="flex gap-3 text-xs mt-0.5"
                                   style={{ color: 'rgba(212,168,67,0.45)', fontFamily: 'Crimson Text,serif' }}>
                                <span>{gr.total_played} played</span>
                                <span>{gr.total_won} won</span>
                                <span>{wr}% win rate</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-base font-bold"
                                   style={{ color: '#fbbf24', fontFamily: 'Cinzel Decorative,serif' }}>
                                {gr.total_points}
                              </div>
                              <div className="text-[10px]"
                                   style={{ color: 'rgba(212,168,67,0.35)', fontFamily: 'Cinzel,serif' }}>
                                pts
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* HISTORY TAB */}
              {tab === 'history' && (
                <div>
                  <h3 className="heading-classical text-lg mb-4">Recent Battles</h3>
                  {recentResults.length === 0 ? (
                    <div className="text-center py-10"
                         style={{ color: 'rgba(245,240,232,0.3)', fontFamily: 'Crimson Text,serif', fontStyle: 'italic' }}>
                      No battles recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentResults.map((r, i) => (
                        <div key={i}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl"
                          style={{
                            background: 'rgba(42,21,9,0.5)',
                            border: '1px solid rgba(212,168,67,0.1)',
                          }}>
                          <span className="text-xl">{r.won ? '🏆' : '💀'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate"
                                 style={{ color: '#f5f0e8', fontFamily: 'Cinzel,serif' }}>
                              {r.game_title}
                            </div>
                            <div className="text-xs"
                                 style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Crimson Text,serif' }}>
                              vs {r.opponent} · {r.difficulty} · {r.mode === 'vs-bot' ? '🤖 Bot' : '👥 PvP'}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold"
                                 style={{ color: r.won ? '#fbbf24' : 'rgba(245,240,232,0.4)', fontFamily: 'Cinzel,serif' }}>
                              {r.won ? `+${r.score}` : r.score}
                            </div>
                            <div className="text-[10px]"
                                 style={{ color: 'rgba(212,168,67,0.3)', fontFamily: 'Crimson Text,serif' }}>
                              {new Date(r.played_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="h-px"
             style={{ background: 'linear-gradient(90deg,transparent,rgba(212,168,67,0.3),transparent)' }} />
      </div>

      {/* ── Change Password modal ──────────────────────────────────────────── */}
      {showChangePw && (
        <ChangePassword
          isMobileOnly={!fullPlayer.email || fullPlayer.email.endsWith('@gamehub.local')}
          onSubmit={onChangePassword}
          onClose={() => { setShowChangePw(false); onClearPwError() }}
          loading={changePwLoading}
          error={changePwError}
          onClearError={onClearPwError}
        />
      )}
    </div>
  )
}

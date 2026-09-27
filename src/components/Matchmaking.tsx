import { useState, useEffect, useRef } from 'react'
import { GameInfo, Player, MatchOpponent } from '../types'

const API = (import.meta.env.VITE_API_URL as string) || '/api'

async function mmFetch(action: string, gameId: string, token: string) {
  const res = await fetch(`${API}/matchmaking.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, gameId }),
  })
  return res.json()
}

interface Props {
  game:    GameInfo
  player:  Player
  token:   string
  onStart: (opponentName: string, isBot: boolean) => void
  onBack:  () => void
}

type Phase = 'menu' | 'searching' | 'found' | 'bot'

export default function Matchmaking({ game, player, token, onStart, onBack }: Props) {
  const [phase,    setPhase]    = useState<Phase>('menu')
  const [waited,   setWaited]   = useState(0)
  const [opponent, setOpponent] = useState<MatchOpponent | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimers = () => {
    if (pollRef.current)  clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    pollRef.current  = null
    timerRef.current = null
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers()
      // Leave queue on unmount without a match
      mmFetch('leave', game.id, token).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startSearch = async () => {
    setError(null)
    setWaited(0)
    setPhase('searching')

    try {
      const data = await mmFetch('join', game.id, token)

      if (data.status === 'matched' || data.status === 'already_matched') {
        handleMatchFound(data.isBot, data.opponent)
        return
      }

      // Start polling + timer
      timerRef.current = setInterval(() => setWaited(w => w + 1), 1000)

      pollRef.current = setInterval(async () => {
        try {
          const poll = await mmFetch('status', game.id, token)
          if (poll.status === 'matched' || poll.status === 'already_matched') {
            clearTimers()
            handleMatchFound(poll.isBot, poll.opponent)
          }
        } catch { /* network hiccup — keep polling */ }
      }, 3000)

    } catch (e) {
      setError((e as Error).message)
      setPhase('menu')
    }
  }

  const handleMatchFound = (isBot: boolean, opp: MatchOpponent | null) => {
    if (isBot) {
      setPhase('bot')
    } else {
      setOpponent(opp)
      setPhase('found')
    }
  }

  const cancelSearch = async () => {
    clearTimers()
    await mmFetch('leave', game.id, token).catch(() => {})
    setPhase('menu')
    setWaited(0)
  }

  const startVsBot = () => {
    clearTimers()
    mmFetch('leave', game.id, token).catch(() => {})
    onStart('Bot', true)
  }

  const confirmMatch = () => {
    clearTimers()
    onStart(opponent?.name ?? 'Opponent', false)
  }

  // ─── Dots animation ───────────────────────────────────────────────────────
  const dots = '.'.repeat((waited % 3) + 1).padEnd(3, '\u00a0')

  // ─── Point diff helper ────────────────────────────────────────────────────
  const ptDiff = opponent
    ? opponent.points - player.total_points
    : 0

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-10 py-8">
      <div className="w-full max-w-md animate-slide-up">

        {/* Back */}
        <button onClick={() => { cancelSearch(); onBack() }}
          className="btn-ghost text-sm mb-6 flex items-center gap-2 py-2 px-4">
          ← Back
        </button>

        <div className="panel-royal overflow-hidden">
          <div className="h-1"
               style={{ background: 'linear-gradient(90deg,transparent,#d4a843,#fbbf24,#d4a843,transparent)' }} />

          <div className="p-7 space-y-6">
            {/* Game identity */}
            <div className="text-center">
              <div className="text-5xl mb-2 drop-shadow-xl">{game.emoji}</div>
              <h2 className="heading-classical text-xl mb-1">{game.title}</h2>
              <div className="divider-classical">
                <span className="text-xs tracking-widest uppercase"
                      style={{ color: 'rgba(212,168,67,0.45)', fontFamily: 'Cinzel,serif' }}>
                  Player vs Player
                </span>
              </div>
            </div>

            {/* Your card */}
            <PlayerCard
              name={player.username}
              avatar={player.avatar}
              points={player.total_points}
              rank={player.rank_title}
              label="You"
            />

            {/* ── MENU PHASE ─────────────────────────────────────────── */}
            {phase === 'menu' && (
              <div className="space-y-3">
                {error && (
                  <div className="px-4 py-3 rounded-lg text-sm"
                       style={{
                         background: 'rgba(155,42,68,0.2)',
                         border: '1px solid rgba(155,42,68,0.4)',
                         color: '#fca5a5',
                         fontFamily: 'Crimson Text,serif',
                       }}>
                    ⚠ {error}
                  </div>
                )}

                <button onClick={startSearch} className="btn-gold w-full py-4 text-sm">
                  🔍 Find Online Opponent
                </button>
                <button onClick={startVsBot}
                  className="w-full py-3.5 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    fontFamily: 'Cinzel,serif',
                    background: 'rgba(42,21,9,0.7)',
                    border: '1px solid rgba(212,168,67,0.2)',
                    color: 'rgba(245,240,232,0.65)',
                  }}>
                  🤖 Play vs Bot (Same Rank)
                </button>

                <p className="text-center text-xs pt-1"
                   style={{ color: 'rgba(212,168,67,0.3)', fontFamily: 'Crimson Text,serif', fontStyle: 'italic' }}>
                  Matchmaking finds opponents within ±300 pts of your score.
                  After 30 s, a bot of equal rank steps in.
                </p>
              </div>
            )}

            {/* ── SEARCHING PHASE ────────────────────────────────────── */}
            {phase === 'searching' && (
              <div className="space-y-4">
                {/* Animated search orb */}
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="relative w-20 h-20">
                    <div className="absolute inset-0 rounded-full animate-ping opacity-30"
                         style={{ background: 'radial-gradient(circle,#d4a843,transparent)' }} />
                    <div className="absolute inset-2 rounded-full flex items-center justify-center text-3xl"
                         style={{ background: 'rgba(26,12,6,0.9)', border: '2px solid rgba(212,168,67,0.4)' }}>
                      🔍
                    </div>
                  </div>
                  <div className="text-sm font-semibold"
                       style={{ color: '#fde68a', fontFamily: 'Cinzel,serif' }}>
                    Seeking a worthy rival{dots}
                  </div>
                  <div className="text-xs"
                       style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Crimson Text,serif' }}>
                    {waited}s elapsed · looking for players near {player.total_points} pts
                  </div>
                  {waited >= 20 && (
                    <div className="text-xs px-3 py-1.5 rounded-lg"
                         style={{
                           background: 'rgba(212,168,67,0.08)',
                           border: '1px solid rgba(212,168,67,0.2)',
                           color: 'rgba(212,168,67,0.6)',
                           fontFamily: 'Crimson Text,serif',
                         }}>
                      ⏳ A bot challenger will step in at 30 s
                    </div>
                  )}
                </div>

                {/* Searching range indicator */}
                <div className="flex justify-between text-xs px-1"
                     style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Cinzel,serif' }}>
                  <span>{Math.max(0, player.total_points - 300)} pts</span>
                  <span style={{ color: '#fbbf24' }}>← Your Range →</span>
                  <span>{player.total_points + 300} pts</span>
                </div>

                <button onClick={cancelSearch} className="btn-ghost w-full py-3 text-sm">
                  ✕ Cancel Search
                </button>
              </div>
            )}

            {/* ── FOUND PHASE ────────────────────────────────────────── */}
            {phase === 'found' && opponent && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl mb-1">⚔</div>
                  <div className="text-sm font-semibold"
                       style={{ color: '#fde68a', fontFamily: 'Cinzel,serif' }}>
                    Opponent Found!
                  </div>
                </div>

                <PlayerCard
                  name={opponent.name}
                  avatar={opponent.avatar}
                  points={opponent.points}
                  rank={opponent.rank}
                  label="Opponent"
                />

                {/* Point difference */}
                <div className="text-center text-xs"
                     style={{ color: 'rgba(212,168,67,0.45)', fontFamily: 'Crimson Text,serif' }}>
                  {ptDiff === 0
                    ? 'Perfectly matched opponents!'
                    : ptDiff > 0
                    ? `Opponent has ${ptDiff} more points — a worthy challenge!`
                    : `You have ${Math.abs(ptDiff)} more points — prove your dominance!`}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={confirmMatch} className="btn-gold py-3.5 text-sm">
                    ⚔ Accept Battle
                  </button>
                  <button onClick={cancelSearch} className="btn-ghost py-3.5 text-sm">
                    ✕ Decline
                  </button>
                </div>
              </div>
            )}

            {/* ── BOT PHASE ──────────────────────────────────────────── */}
            {phase === 'bot' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl mb-1">🤖</div>
                  <div className="text-sm font-semibold"
                       style={{ color: '#fde68a', fontFamily: 'Cinzel,serif' }}>
                    Bot Challenger Ready
                  </div>
                  <div className="text-xs mt-1"
                       style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Crimson Text,serif' }}>
                    No humans found — a {player.rank_title}-rank bot steps in.
                  </div>
                </div>

                <PlayerCard
                  name={`${player.rank_title} Bot`}
                  avatar="🤖"
                  points={player.total_points}
                  rank={player.rank_title}
                  label="Bot"
                />

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={startVsBot} className="btn-gold py-3.5 text-sm">
                    ⚔ Fight Bot
                  </button>
                  <button onClick={cancelSearch} className="btn-ghost py-3.5 text-sm">
                    ✕ Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="h-px"
               style={{ background: 'linear-gradient(90deg,transparent,rgba(212,168,67,0.3),transparent)' }} />
        </div>
      </div>
    </div>
  )
}

// ─── Player card sub-component ────────────────────────────────────────────
interface PCProps {
  name:   string
  avatar: string
  points: number
  rank:   string
  label:  string
}

function PlayerCard({ name, avatar, points, rank, label }: PCProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl"
         style={{
           background: 'rgba(26,12,6,0.7)',
           border: '1px solid rgba(212,168,67,0.2)',
         }}>
      <div className="text-3xl w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
           style={{ background: 'rgba(42,21,9,0.9)', border: '1px solid rgba(212,168,67,0.25)' }}>
        {avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate"
             style={{ color: '#f5f0e8', fontFamily: 'Cinzel,serif' }}>
          {name}
        </div>
        <div className="text-xs"
             style={{ color: 'rgba(212,168,67,0.45)', fontFamily: 'Crimson Text,serif' }}>
          {rank} · {points.toLocaleString()} pts
        </div>
      </div>
      <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
            style={{
              background: 'rgba(155,42,68,0.2)',
              border: '1px solid rgba(155,42,68,0.35)',
              color: '#fde68a',
              fontFamily: 'Cinzel,serif',
            }}>
        {label}
      </span>
    </div>
  )
}

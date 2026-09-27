import { useState } from 'react'
import { GameInfo, GameConfig } from './types'
import { useAuth }         from './hooks/useAuth'
import { useGuestSession } from './hooks/useGuestSession'
import { usePageViews }    from './hooks/usePageViews'

import Header        from './components/Header'
import GameCard      from './components/GameCard'
import PlayerSetup   from './components/PlayerSetup'
import GameOver      from './components/GameOver'
import Leaderboard   from './components/Leaderboard'
import ParticlesBg   from './components/ParticlesBg'
import LoginPage     from './components/LoginPage'
import PlayerProfile from './components/PlayerProfile'
import Matchmaking   from './components/Matchmaking'

import Chess         from './games/Chess'
import Carrom        from './games/Carrom'
import TicTacToe     from './games/TicTacToe'
import Sudoku        from './games/Sudoku'
import ChowkaBara    from './games/ChowkaBara'
import KattaMane     from './games/KattaMane'
import Taayam        from './games/Taayam'
import KaangiChalla  from './games/KaangiChalla'
import KaanaDua      from './games/KaanaDua'
import Ludo          from './games/Ludo'
import SnakeLadders  from './games/SnakeLadders'

// ─── Game catalogue ────────────────────────────────────────────────────────
export const GAMES: GameInfo[] = [
  { id:'chess',        title:'Chess',           emoji:'♟',   description:'The timeless game of kings — full rules, castling, en passant & minimax AI.',    category:'classic', players:'2',   hasBot:true,  color:'from-slate-700 to-slate-900',   bgPattern:'♟' },
  { id:'carrom',       title:'Carrom',          emoji:'🎯',  description:'Physics-based strike board — pocket all your coins before your opponent.',        category:'classic', players:'2',   hasBot:true,  color:'from-amber-700 to-yellow-900',  bgPattern:'⬤' },
  { id:'tictactoe',    title:'Tic-Tac-Toe',     emoji:'✕',   description:'Ancient alignment game — outwit the unbeatable minimax oracle.',                  category:'classic', players:'2',   hasBot:true,  color:'from-blue-700 to-indigo-900',   bgPattern:'✕' },
  { id:'sudoku',       title:'Sudoku',          emoji:'🔢',  description:'Fill the sacred 9×9 grid with numbers — three levels of enlightenment.',          category:'puzzle',  players:'1',   hasBot:false, color:'from-green-700 to-teal-900',    bgPattern:'#' },
  { id:'chowkabara',   title:'Chowka Bara',     emoji:'🎲',  description:'Ancient South Indian cross-board race — cowrie shells, captures & strategy.',     category:'indian',  players:'2-4', hasBot:true,  color:'from-orange-700 to-red-900',    bgPattern:'✦' },
  { id:'kattamane',    title:'Katta Mane',      emoji:'🪨',  description:'Pallanguzhi — the 14-pit mancala gem of Karnataka & Tamil Nadu.',                category:'indian',  players:'2',   hasBot:true,  color:'from-lime-700 to-green-900',    bgPattern:'○' },
  { id:'taayam',       title:'Taayam',          emoji:'🎲',  description:'Classic Kerala dice race — bring all pieces home to claim victory.',              category:'indian',  players:'2-4', hasBot:true,  color:'from-purple-700 to-violet-900', bgPattern:'◆' },
  { id:'kaangichalla', title:'Kaangi Challa',   emoji:'💫',  description:'Traditional ring-toss skill game — perfect your aim across three rounds.',        category:'indian',  players:'2',   hasBot:true,  color:'from-pink-700 to-rose-900',     bgPattern:'◎' },
  { id:'kaanadua',     title:'Kaana Dua',       emoji:'🎰',  description:'Cowrie dice probability game — first to 30 points claims the throne.',           category:'indian',  players:'2-4', hasBot:true,  color:'from-cyan-700 to-sky-900',      bgPattern:'⬜' },
  { id:'ludo',         title:'Ludo',            emoji:'🎮',  description:'Race your four tokens home in the beloved classic board game.',                   category:'classic', players:'2-4', hasBot:true,  color:'from-red-700 to-pink-900',      bgPattern:'★' },
  { id:'snakeladders', title:'Snake & Ladders', emoji:'🐍',  description:'Climb the ladders, dodge the serpents — fortune favours the bold.',              category:'classic', players:'2-4', hasBot:false, color:'from-emerald-700 to-green-900', bgPattern:'〜' },
]

type Screen =
  | 'login'
  | 'hub'
  | 'profile'
  | 'setup'
  | 'matchmaking'
  | 'game'
  | 'gameover'
  | 'leaderboard'

export interface GameResult {
  winner:     string
  score?:     number
  gameId:     string
  difficulty: string
}

export default function App() {
  const auth  = useAuth()
  const guest = useGuestSession()
  const pageViews = usePageViews()

  const [screen,      setScreen]      = useState<Screen>(auth.isLoggedIn ? 'hub' : 'hub')
  const [activeGame,  setActiveGame]  = useState<GameInfo | null>(null)
  const [gameConfig,  setGameConfig]  = useState<GameConfig | null>(null)
  const [gameResult,  setGameResult]  = useState<GameResult | null>(null)
  const [filterCat,   setFilterCat]   = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  // pointsToast — shown briefly after a game finishes
  const [pointsToast, setPointsToast] = useState<{ delta: number; outcome: string } | null>(null)

  // ─── Navigation helpers ──────────────────────────────────────────────────
  const openGame  = (g: GameInfo) => { setActiveGame(g); setScreen('setup') }
  const backToHub = () => {
    setScreen('hub')
    setActiveGame(null)
    setGameConfig(null)
    setGameResult(null)
  }
  const playAgain = () => { setScreen('game'); setGameResult(null) }

  // ─── Auth handlers ───────────────────────────────────────────────────────
  const handleLoginSuccess = async (loginId: string, password: string) => {
    const ok = await auth.login(loginId, password)
    if (ok) setScreen('hub')
    return ok
  }

  const handleRegisterSuccess = async (
    username: string, email: string, password: string, avatar: string,
    mobile?: string, otpToken?: string
  ) => {
    const ok = await auth.register(username, email, password, avatar, mobile, otpToken)
    if (ok) setScreen('hub')
    return ok
  }

  const handleLogout = async () => {
    await auth.logout()
    setScreen('hub')   // stay on hub as guest — don't force login screen
    setActiveGame(null)
    setGameConfig(null)
    setGameResult(null)
  }

  // ─── Game start from setup ───────────────────────────────────────────────
  const startGame = (c: GameConfig) => {
    // If multiplayer mode and game supports bot + user is logged in → matchmaking
    if (c.mode === 'multiplayer' && activeGame?.hasBot && auth.isLoggedIn && auth.player) {
      setGameConfig(c)
      setScreen('matchmaking')
    } else {
      setGameConfig(c)
      setScreen('game')
    }
  }

  // ─── Matchmaking → game start ────────────────────────────────────────────
  const handleMatchFound = (opponentName: string, _isBot: boolean) => {
    if (!gameConfig) return
    // Inject the matched opponent's name into the config
    const updatedConfig: GameConfig = {
      ...gameConfig,
      players: [auth.player?.username ?? gameConfig.players[0], opponentName],
    }
    setGameConfig(updatedConfig)
    setScreen('game')
  }

  // ─── Game over — save to DB (logged in) or guest session (guest) ──────────
  const finishGame = async (r: GameResult) => {
    setGameResult(r)
    setScreen('gameover')

    const isDraw     = r.winner === 'Draw'
    const playerName = auth.isLoggedIn
      ? (auth.player?.username ?? gameConfig?.players[0] ?? '')
      : gameConfig?.players[0] ?? ''
    const won = !isDraw && (r.winner === playerName || r.winner === gameConfig?.players[0])

    if (auth.isLoggedIn && auth.player && activeGame) {
      // ── Logged-in path: persist to database ──────────────────────────────
      const result = await auth.saveResult({
        gameId:     r.gameId,
        gameTitle:  activeGame.title,
        won,
        isDraw,
        score:      r.score ?? 0,
        difficulty: r.difficulty || gameConfig?.difficulty || 'medium',
        opponent:   gameConfig?.players[1] ?? 'Bot',
        mode:       gameConfig?.mode       ?? 'vs-bot',
      })
      if (result) {
        setPointsToast({ delta: result.pointsDelta, outcome: result.outcome })
        setTimeout(() => setPointsToast(null), 3500)
      }
    } else if (!auth.isLoggedIn && activeGame) {
      // ── Guest path: persist to localStorage ──────────────────────────────
      const delta = guest.recordResult(
        r.gameId,
        activeGame.title,
        won,
        isDraw,
        r.score ?? 0,
        r.difficulty || gameConfig?.difficulty || 'medium',
        gameConfig?.players[1] ?? 'Bot',
        gameConfig?.mode       ?? 'vs-bot',
      )
      const outcome = isDraw ? 'draw' : won ? 'win' : 'loss'
      setPointsToast({ delta, outcome })
      setTimeout(() => setPointsToast(null), 3500)
    }
  }

  // ─── Filtered games ──────────────────────────────────────────────────────
  const visibleGames = GAMES.filter(g =>
    (filterCat === 'all' || g.category === filterCat) &&
    g.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // ─── Game renderer ───────────────────────────────────────────────────────
  const renderGame = () => {
    if (!activeGame || !gameConfig) return null
    const p = { config: gameConfig, onGameOver: finishGame, onExit: backToHub }
    switch (activeGame.id) {
      case 'chess':        return <Chess        {...p} />
      case 'carrom':       return <Carrom       {...p} />
      case 'tictactoe':    return <TicTacToe    {...p} />
      case 'sudoku':       return <Sudoku       {...p} />
      case 'chowkabara':   return <ChowkaBara   {...p} />
      case 'kattamane':    return <KattaMane    {...p} />
      case 'taayam':       return <Taayam       {...p} />
      case 'kaangichalla': return <KaangiChalla {...p} />
      case 'kaanadua':     return <KaanaDua     {...p} />
      case 'ludo':         return <Ludo         {...p} />
      case 'snakeladders': return <SnakeLadders {...p} />
      default:             return null
    }
  }

  const CATS = [
    { id:'all',     label:'⚜ All Games' },
    { id:'classic', label:'♟ Classic'   },
    { id:'indian',  label:'🪔 Indian'   },
    { id:'puzzle',  label:'🧩 Puzzle'   },
  ]

  return (
    <div className="min-h-screen relative">
      <ParticlesBg />

      {/* ── Points toast ──────────────────────────────────────────────────── */}
      {pointsToast !== null && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold animate-bounce-in"
          style={{
            background: 'linear-gradient(135deg,rgba(26,12,6,0.97),rgba(42,21,9,0.97))',
            border: pointsToast.delta >= 0
              ? '1px solid rgba(212,168,67,0.5)'
              : '1px solid rgba(155,42,68,0.5)',
            color: pointsToast.outcome === 'draw'
              ? 'rgba(245,240,232,0.7)'
              : pointsToast.delta >= 0 ? '#fde68a' : '#fca5a5',
            fontFamily: 'Cinzel,serif',
            boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          }}>
          {pointsToast.outcome === 'draw'
            ? '🤝 Draw — no points change'
            : pointsToast.delta > 0
            ? `✨ +${pointsToast.delta} pts${!auth.isLoggedIn ? ' (guest)' : ''}`
            : `💀 ${pointsToast.delta} pts${!auth.isLoggedIn ? ' (guest)' : ''}`}
          {!auth.isLoggedIn && pointsToast.outcome !== 'draw' && (
            <button
              onClick={() => { setPointsToast(null); setScreen('login') }}
              className="ml-3 text-[10px] underline opacity-60 hover:opacity-100"
              style={{ fontFamily: 'Crimson Text,serif' }}>
              Save permanently →
            </button>
          )}
        </div>
      )}

      {/* ── LOGIN ─────────────────────────────────────────────────────────── */}
      {screen === 'login' && (
        <LoginPage
          onLogin={handleLoginSuccess}
          onRegister={handleRegisterSuccess}
          onSendOtp={auth.sendOtp}
          onVerifyOtp={auth.verifyOtp}
          onLoginWithOtp={auth.loginWithOtp}
          onForgotPassword={auth.forgotPassword}
          onResetPassword={auth.resetPassword}
          loading={auth.loading}
          error={auth.error}
          otpResendAfter={auth.otpState.resendAfter}
          onClearError={() => auth.setError(null)}
        />
      )}

      {/* ── Merge success banner (shown on hub right after login/register) ── */}
      {auth.mergeResult && screen === 'hub' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="px-5 py-4 rounded-xl animate-slide-up"
               style={{
                 background: 'linear-gradient(135deg,rgba(26,12,6,0.98),rgba(42,21,9,0.98))',
                 border: '1px solid rgba(212,168,67,0.45)',
                 boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
               }}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎒</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold mb-0.5"
                     style={{ color: '#fde68a', fontFamily: 'Cinzel,serif' }}>
                  Guest progress merged!
                </div>
                <div className="text-xs leading-relaxed"
                     style={{ color: 'rgba(245,240,232,0.6)', fontFamily: 'Crimson Text,serif' }}>
                  {auth.mergeResult.merged} game{auth.mergeResult.merged !== 1 ? 's' : ''} transferred
                  {auth.mergeResult.pointsDelta !== 0 && (
                    <span
                      style={{ color: auth.mergeResult.pointsDelta > 0 ? '#fbbf24' : '#fca5a5' }}>
                      {' '}({auth.mergeResult.pointsDelta > 0 ? '+' : ''}{auth.mergeResult.pointsDelta} pts)
                    </span>
                  )}
                  {' '}· Your guest history is now part of your account.
                </div>
              </div>
              <button onClick={auth.clearMergeResult}
                className="text-lg leading-none shrink-0"
                style={{ color: 'rgba(212,168,67,0.4)' }}>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROFILE ───────────────────────────────────────────────────────── */}
      {screen === 'profile' && auth.player && (
        <PlayerProfile
          player={auth.player}
          onBack={backToHub}
          onLogout={handleLogout}
          refreshProfile={auth.refreshProfile}
          mergeResult={auth.mergeResult}
          onDismissMerge={auth.clearMergeResult}
          onChangePassword={auth.changePassword}
          changePwLoading={auth.loading}
          changePwError={auth.error}
          onClearPwError={() => auth.setError(null)}
        />
      )}

      {/* ── MATCHMAKING ───────────────────────────────────────────────────── */}
      {screen === 'matchmaking' && activeGame && auth.player && auth.token && (
        <Matchmaking
          game={activeGame}
          player={auth.player}
          token={auth.token}
          onStart={handleMatchFound}
          onBack={() => setScreen('setup')}
        />
      )}

      {/* ── HUB ─────────────────────────────────────────────────────────── */}
      {screen === 'hub' && (
        <div className="relative z-10">
          {/* Header with auth-aware buttons */}
          <header className="relative z-10 border-b"
                  style={{ borderColor: 'rgba(212,168,67,0.25)', background: 'linear-gradient(180deg,rgba(26,12,6,0.98) 0%,rgba(19,10,4,0.95) 100%)' }}>
            <div className="h-0.5 w-full"
                 style={{ background: 'linear-gradient(90deg,transparent,#d4a843,#fbbf24,#d4a843,transparent)' }} />

            <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3">
              {/* Logo */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-3xl drop-shadow-lg">♟</span>
                <div>
                  <div className="heading-classical text-xl leading-none">GameHub</div>
                  <div className="text-[10px] tracking-[0.18em] uppercase mt-0.5"
                       style={{ color: 'rgba(212,168,67,0.55)', fontFamily: 'Cinzel,serif' }}>
                    Royal Board Games
                  </div>
                </div>
              </div>

              {/* Nav */}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button onClick={() => setScreen('leaderboard')}
                  className="btn-ghost text-sm py-1.5 px-3 flex items-center gap-1.5">
                  🏆 <span className="hidden sm:inline">Leaderboard</span>
                </button>

                {auth.isLoggedIn && auth.player ? (
                  /* Logged-in: avatar button → profile */
                  <button onClick={() => setScreen('profile')}
                    className="flex items-center gap-2 py-1.5 px-3 rounded-lg transition-all"
                    style={{
                      background: 'rgba(42,21,9,0.7)',
                      border: '1px solid rgba(212,168,67,0.25)',
                      color: '#f5f0e8',
                    }}>
                    <span className="text-lg leading-none">{auth.player.avatar}</span>
                    <div className="hidden sm:block text-left">
                      <div className="text-xs font-semibold leading-tight"
                           style={{ fontFamily: 'Cinzel,serif', color: '#fde68a' }}>
                        {auth.player.username}
                      </div>
                      <div className="text-[10px] leading-tight"
                           style={{ color: 'rgba(212,168,67,0.5)', fontFamily: 'Cinzel,serif' }}>
                        {auth.player.total_points.toLocaleString()} pts · {auth.player.rank_title}
                      </div>
                    </div>
                  </button>
                ) : (
                  /* Guest: show session pts + sign-in button */
                  <div className="flex items-center gap-2">
                    {guest.guest.games_played > 0 && (
                      <div className="hidden sm:flex flex-col items-end leading-tight">
                        <span className="text-[10px] font-semibold"
                              style={{ color: '#fde68a', fontFamily: 'Cinzel,serif' }}>
                          {guest.guest.total_points} pts
                        </span>
                        <span className="text-[9px]"
                              style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Cinzel,serif' }}>
                          Guest · {guest.guest.rank_title}
                        </span>
                      </div>
                    )}
                    <button onClick={() => setScreen('login')}
                      className="btn-gold text-sm py-1.5 px-4">
                      🗡 Sign In
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="h-px w-full"
                 style={{ background: 'linear-gradient(90deg,transparent,rgba(212,168,67,0.35),transparent)' }} />
          </header>

          {/* ── Hero ─────────────────────────────────────────────────── */}
          <section className="relative text-center py-14 px-4 overflow-hidden">

            {/* Floating ambient game-piece decorations — pure CSS, zero network cost */}
            <div aria-hidden className="pointer-events-none select-none absolute inset-0 overflow-hidden">
              {/* Large background glows */}
              <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full opacity-10"
                   style={{ background:'radial-gradient(circle,rgba(212,168,67,0.5) 0%,transparent 70%)', filter:'blur(40px)' }} />
              <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full opacity-10"
                   style={{ background:'radial-gradient(circle,rgba(155,42,68,0.5) 0%,transparent 70%)', filter:'blur(40px)' }} />

              {/* Floating pieces — staggered with different animation classes */}
              <span className="hero-piece-a absolute text-5xl" style={{ top:'12%', left:'6%',   animationDelay:'0s'    }}>♟</span>
              <span className="hero-piece-b absolute text-4xl" style={{ top:'20%', right:'8%',  animationDelay:'1.2s'  }}>🎲</span>
              <span className="hero-piece-c absolute text-3xl" style={{ top:'55%', left:'4%',   animationDelay:'0.7s'  }}>🎯</span>
              <span className="hero-piece-d absolute text-4xl" style={{ top:'65%', right:'5%',  animationDelay:'2.1s'  }}>♚</span>
              <span className="hero-piece-a absolute text-2xl" style={{ top:'35%', left:'14%',  animationDelay:'3.0s'  }}>🎰</span>
              <span className="hero-piece-b absolute text-3xl" style={{ top:'80%', left:'18%',  animationDelay:'1.8s'  }}>🧩</span>
              <span className="hero-piece-c absolute text-2xl" style={{ top:'40%', right:'14%', animationDelay:'0.4s'  }}>🪨</span>
              <span className="hero-piece-d absolute text-3xl" style={{ top:'75%', right:'20%', animationDelay:'2.6s'  }}>🎮</span>
              <span className="hero-piece-a absolute text-xl"  style={{ top:'8%',  left:'40%',  animationDelay:'1.5s'  }}>✦</span>
              <span className="hero-piece-b absolute text-xl"  style={{ top:'88%', left:'45%',  animationDelay:'3.3s'  }}>✦</span>
            </div>

            {/* Crown with subtle orbit rings */}
            <div className="relative inline-flex items-center justify-center mb-4">
              {/* Orbit ring 1 */}
              <div className="absolute w-24 h-24 rounded-full border border-dashed opacity-20"
                   style={{ borderColor:'rgba(212,168,67,0.6)', animation:'spin 20s linear infinite' }} />
              {/* Orbit ring 2 */}
              <div className="absolute w-16 h-16 rounded-full border opacity-15"
                   style={{ borderColor:'rgba(212,168,67,0.4)', animation:'spin 12s linear infinite reverse' }} />
              <span className="text-6xl animate-float drop-shadow-2xl relative z-10">👑</span>
            </div>

            {/* Title with shimmer */}
            <h1 className="heading-classical text-5xl md:text-7xl font-bold mb-1 relative z-10">
              GameHub
            </h1>
            <div className="hero-shimmer-text text-xs md:text-sm font-semibold tracking-[0.22em] uppercase mb-3"
                 style={{ fontFamily:'Cinzel,serif' }}>
              Royal Board Games Collection
            </div>

            <p className="text-lg md:text-xl max-w-lg mx-auto mb-1 relative z-10"
               style={{ color:'rgba(245,240,232,0.55)', fontFamily:'Crimson Text,serif', fontStyle:'italic' }}>
              Classic &amp; Traditional Indian Board Games, crafted for the ages
            </p>

            {/* Stat pills row */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4 mb-1 relative z-10">
              {[
                { icon:'🎮', label:`${GAMES.length} Games` },
                { icon:'🤝', label:'Multiplayer' },
                { icon:'🤖', label:'vs Bot' },
                { icon:'⚔', label:'3 Difficulties' },
              ].map(s => (
                <div key={s.label}
                     className="stat-pill inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
                     style={{
                       fontFamily:'Cinzel,serif',
                       background:'rgba(26,12,6,0.75)',
                       border:'1px solid rgba(212,168,67,0.2)',
                       color:'rgba(212,168,67,0.7)',
                       letterSpacing:'0.06em',
                     }}>
                  <span>{s.icon}</span> {s.label}
                </div>
              ))}

              {/* 👁 Page View Counter */}
              <div className="stat-pill inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
                   style={{
                     fontFamily:'Cinzel,serif',
                     background:'rgba(155,42,68,0.18)',
                     border:'1px solid rgba(212,168,67,0.22)',
                     color:'rgba(253,230,138,0.85)',
                     letterSpacing:'0.06em',
                   }}>
                <span>👁</span>
                {pageViews === null
                  ? <span className="opacity-50">—</span>
                  : <span key={pageViews} className="views-count font-semibold">
                      {pageViews.toLocaleString()} {pageViews === 1 ? 'Visit' : 'Visits'}
                    </span>
                }
              </div>
            </div>

            {/* Logged-in welcome strip */}
            {auth.isLoggedIn && auth.player && (
              <button onClick={() => setScreen('profile')}
                className="inline-flex items-center gap-2 mt-5 px-5 py-2 rounded-full text-sm transition-all relative z-10"
                style={{
                  background: 'rgba(212,168,67,0.1)',
                  border: '1px solid rgba(212,168,67,0.3)',
                  color: '#fde68a',
                  fontFamily: 'Cinzel,serif',
                }}>
                {auth.player.avatar} Welcome back, {auth.player.username}!
                <span style={{ color: 'rgba(212,168,67,0.5)' }}>View Profile →</span>
              </button>
            )}

            {/* Guest session strip */}
            {!auth.isLoggedIn && guest.hasGuestData && (
              <div className="mt-5 flex flex-col items-center gap-2 relative z-10">
                <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full text-sm"
                     style={{
                       background: 'rgba(42,21,9,0.7)',
                       border: '1px solid rgba(212,168,67,0.2)',
                       color: 'rgba(245,240,232,0.7)',
                       fontFamily: 'Cinzel,serif',
                     }}>
                  <span>👤</span>
                  <span>Guest Session</span>
                  <span className="font-bold" style={{ color: '#fde68a' }}>
                    {guest.guest.total_points} pts
                  </span>
                  <span style={{ color: 'rgba(212,168,67,0.4)' }}>·</span>
                  <span style={{ color: 'rgba(212,168,67,0.6)' }}>{guest.guest.rank_title}</span>
                  <span style={{ color: 'rgba(212,168,67,0.4)' }}>·</span>
                  <span style={{ color: 'rgba(245,240,232,0.4)' }}>
                    {guest.guest.games_played}G / {guest.guest.games_won}W
                  </span>
                </div>
                <button onClick={() => setScreen('login')}
                  className="text-xs underline"
                  style={{ color: 'rgba(212,168,67,0.5)', fontFamily: 'Crimson Text,serif', fontStyle: 'italic' }}>
                  Sign in to save your progress permanently →
                </button>
              </div>
            )}

            <div className="flex items-center justify-center gap-4 mt-6 max-w-xs mx-auto relative z-10">
              <div className="flex-1 h-px" style={{ background:'linear-gradient(90deg,transparent,rgba(212,168,67,0.45))' }} />
              <span className="text-gold-400 text-lg">✦</span>
              <div className="flex-1 h-px" style={{ background:'linear-gradient(90deg,rgba(212,168,67,0.45),transparent)' }} />
            </div>
          </section>

          {/* Filter + Search */}
          <section className="max-w-6xl mx-auto px-4 mb-7">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                {CATS.map(c => (
                  <button key={c.id} onClick={() => setFilterCat(c.id)}
                    className="px-4 py-2 rounded-full text-sm transition-all duration-200"
                    style={{
                      fontFamily: 'Cinzel,serif',
                      letterSpacing: '0.04em',
                      background: filterCat === c.id
                        ? 'linear-gradient(180deg,#9b2a44 0%,#7a1f34 100%)'
                        : 'rgba(42,21,9,0.6)',
                      border: filterCat === c.id
                        ? '1px solid rgba(212,168,67,0.5)'
                        : '1px solid rgba(212,168,67,0.15)',
                      color: filterCat === c.id ? '#fde68a' : 'rgba(245,240,232,0.45)',
                      boxShadow: filterCat === c.id ? '0 2px 12px rgba(0,0,0,0.5)' : 'none',
                    }}>
                    {c.label}
                  </button>
                ))}
              </div>
              <input
                type="search" placeholder="Search games…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="text-sm outline-none rounded-lg px-4 py-2 w-44 transition-all"
                style={{
                  background:'rgba(26,12,6,0.7)',
                  border:'1px solid rgba(212,168,67,0.22)',
                  color:'#f5f0e8',
                  fontFamily:'Cinzel,serif',
                }}
                onFocus={e  => (e.target.style.borderColor='rgba(212,168,67,0.5)')}
                onBlur={e   => (e.target.style.borderColor='rgba(212,168,67,0.22)')}
              />
            </div>
          </section>

          {/* Game grid */}
          <section className="max-w-6xl mx-auto px-4 pb-20">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {visibleGames.map((game, i) => (
                <GameCard key={game.id} game={game} index={i} onPlay={() => openGame(game)} />
              ))}
            </div>
            {visibleGames.length === 0 && (
              <div className="text-center py-20"
                   style={{ color:'rgba(245,240,232,0.25)', fontFamily:'Crimson Text,serif', fontStyle:'italic', fontSize:'1.1rem' }}>
                No games found.
              </div>
            )}
          </section>

          <footer className="border-t text-center py-5 px-4"
                  style={{ borderColor:'rgba(212,168,67,0.15)', color:'rgba(212,168,67,0.3)', fontFamily:'Cinzel,serif', fontSize:'0.7rem', letterSpacing:'0.12em' }}>
            {/* Ticker strip */}
            <div className="overflow-hidden mb-3 -mx-4 px-4 py-1.5 border-y"
                 style={{ borderColor:'rgba(212,168,67,0.1)', background:'rgba(0,0,0,0.25)' }}>
              <div className="ticker-inner inline-flex gap-6 whitespace-nowrap"
                   style={{ color:'rgba(212,168,67,0.38)', fontFamily:'Cinzel,serif', fontSize:'0.65rem', letterSpacing:'0.1em' }}>
                {[...GAMES, ...GAMES].map((g, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    {g.emoji} {g.title.toUpperCase()} <span style={{ opacity:0.3 }}>✦</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <span>✦ GAMEHUB · ROYAL BOARD GAMES COLLECTION ✦</span>
              {pageViews !== null && (
                <span className="inline-flex items-center gap-1.5"
                      style={{ color:'rgba(212,168,67,0.25)' }}>
                  <span>👁</span>
                  <span>{pageViews.toLocaleString()} total visits</span>
                </span>
              )}
            </div>
          </footer>
        </div>
      )}

      {/* ── SETUP ─────────────────────────────────────────────────────────── */}
      {screen === 'setup' && activeGame && (
        <PlayerSetup
          game={activeGame}
          onStart={startGame}
          onBack={() => setScreen('hub')}
        />
      )}

      {/* ── GAME ──────────────────────────────────────────────────────────── */}
      {screen === 'game' && renderGame()}

      {/* ── GAME OVER ─────────────────────────────────────────────────────── */}
      {screen === 'gameover' && gameResult && (
        <GameOver result={gameResult} onPlayAgain={playAgain} onHome={backToHub} />
      )}

      {/* ── LEADERBOARD ───────────────────────────────────────────────────── */}
      {screen === 'leaderboard' && (
        <Leaderboard onBack={() => setScreen('hub')} />
      )}
    </div>
  )
}

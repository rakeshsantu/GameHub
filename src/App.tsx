import { useState } from 'react'
import { GameInfo, GameConfig } from './types'
import Header        from './components/Header'
import GameCard      from './components/GameCard'
import PlayerSetup   from './components/PlayerSetup'
import GameOver      from './components/GameOver'
import Leaderboard   from './components/Leaderboard'
import ParticlesBg   from './components/ParticlesBg'

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

type Screen = 'hub' | 'setup' | 'game' | 'gameover' | 'leaderboard'

export interface GameResult {
  winner:     string
  score?:     number
  gameId:     string
  difficulty: string
}

export default function App() {
  const [screen,      setScreen]      = useState<Screen>('hub')
  const [activeGame,  setActiveGame]  = useState<GameInfo | null>(null)
  const [gameConfig,  setGameConfig]  = useState<GameConfig | null>(null)
  const [gameResult,  setGameResult]  = useState<GameResult | null>(null)
  const [filterCat,   setFilterCat]   = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const openGame   = (g: GameInfo)    => { setActiveGame(g); setScreen('setup') }
  const startGame  = (c: GameConfig)  => { setGameConfig(c); setScreen('game') }
  const finishGame = (r: GameResult)  => { setGameResult(r); setScreen('gameover') }
  const backToHub  = ()               => { setScreen('hub'); setActiveGame(null); setGameConfig(null); setGameResult(null) }
  const playAgain  = ()               => { setScreen('game'); setGameResult(null) }

  const visibleGames = GAMES.filter(g =>
    (filterCat === 'all' || g.category === filterCat) &&
    g.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

      {/* ── HUB ─────────────────────────── */}
      {screen === 'hub' && (
        <div className="relative z-10">
          <Header onLeaderboard={() => setScreen('leaderboard')} />

          {/* Hero */}
          <section className="text-center py-14 px-4">
            {/* Crown ornament */}
            <div className="text-5xl mb-4 animate-float drop-shadow-2xl">👑</div>
            <h1 className="heading-classical text-5xl md:text-7xl font-bold mb-3">
              GameHub
            </h1>
            <p className="text-lg md:text-xl max-w-lg mx-auto mb-1"
               style={{ color:'rgba(245,240,232,0.55)', fontFamily:'Crimson Text,serif', fontStyle:'italic' }}>
              A Royal Collection of Classic & Traditional Indian Board Games
            </p>
            <p className="text-sm"
               style={{ color:'rgba(212,168,67,0.4)', fontFamily:'Cinzel,serif', letterSpacing:'0.12em' }}>
              {GAMES.length} GAMES · MULTIPLAYER · vs BOT · 3 DIFFICULTY LEVELS
            </p>

            {/* Ornamental rule */}
            <div className="flex items-center justify-center gap-4 mt-6 max-w-xs mx-auto">
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

          {/* Footer */}
          <footer className="border-t text-center py-5 px-4"
                  style={{ borderColor:'rgba(212,168,67,0.15)', color:'rgba(212,168,67,0.3)', fontFamily:'Cinzel,serif', fontSize:'0.7rem', letterSpacing:'0.12em' }}>
            ✦ GAMEHUB · ROYAL BOARD GAMES COLLECTION ✦
          </footer>
        </div>
      )}

      {screen === 'setup'      && activeGame  && <PlayerSetup game={activeGame} onStart={startGame} onBack={() => setScreen('hub')} />}
      {screen === 'game'       && renderGame()}
      {screen === 'gameover'   && gameResult  && <GameOver result={gameResult} onPlayAgain={playAgain} onHome={backToHub} />}
      {screen === 'leaderboard'                && <Leaderboard onBack={() => setScreen('hub')} />}
    </div>
  )
}

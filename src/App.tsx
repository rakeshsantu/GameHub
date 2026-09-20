import { useState, useEffect } from 'react'
import { GameInfo, GameConfig } from './types'
import Header        from './components/Header'
import GameCard      from './components/GameCard'
import PlayerSetup   from './components/PlayerSetup'
import GameOver      from './components/GameOver'
import Leaderboard   from './components/Leaderboard'
import ParticlesBg   from './components/ParticlesBg'

// ── Game components ──────────────────────────────────────
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

// ── Game registry ─────────────────────────────────────────
export const GAMES: GameInfo[] = [
  { id:'chess',        title:'Chess',           emoji:'♟️',  description:'Classic strategy game with full move validation & minimax AI.',           category:'classic', players:'2',   hasBot:true,  color:'from-slate-700 to-slate-900',    bgPattern:'♟️' },
  { id:'carrom',       title:'Carrom',          emoji:'🎯',  description:'Physics-based board game — pot all coins before your opponent!',          category:'classic', players:'2',   hasBot:true,  color:'from-amber-700 to-yellow-900',   bgPattern:'⬤' },
  { id:'tictactoe',    title:'Tic-Tac-Toe',     emoji:'❌',  description:'Simple yet thrilling — outsmart the unbeatable minimax bot.',             category:'classic', players:'2',   hasBot:true,  color:'from-blue-700 to-indigo-900',    bgPattern:'✕' },
  { id:'sudoku',       title:'Sudoku',          emoji:'🔢',  description:'Fill the 9×9 grid — three levels from beginner to expert.',               category:'puzzle',  players:'1',   hasBot:false, color:'from-green-700 to-teal-900',     bgPattern:'#' },
  { id:'chowkabara',   title:'Chowka Bara',     emoji:'🎲',  description:'Traditional South Indian 4-player cross board game with cowrie shells.',  category:'indian',  players:'2-4', hasBot:true,  color:'from-orange-700 to-red-900',     bgPattern:'✦' },
  { id:'kattamane',    title:'Katta Mane',      emoji:'🪨',  description:'Pallanguzhi — 14-pit mancala gem from Karnataka & Tamil Nadu.',           category:'indian',  players:'2',   hasBot:true,  color:'from-lime-700 to-green-900',     bgPattern:'○' },
  { id:'taayam',       title:'Taayam',          emoji:'🎲',  description:'Ancient Kerala dice race game — first to bring all pieces home wins!',    category:'indian',  players:'2-4', hasBot:true,  color:'from-purple-700 to-violet-900',  bgPattern:'◆' },
  { id:'kaangichalla', title:'Kaangi Challa',   emoji:'💫',  description:'Traditional ring-toss skill game — aim for the highest rings!',           category:'indian',  players:'2',   hasBot:true,  color:'from-pink-700 to-rose-900',      bgPattern:'◎' },
  { id:'kaanadua',     title:'Kaana Dua',       emoji:'🎰',  description:'Traditional two-faced dice probability game — bet & beat the odds!',     category:'indian',  players:'2-4', hasBot:true,  color:'from-cyan-700 to-sky-900',       bgPattern:'⬜' },
  { id:'ludo',         title:'Ludo',            emoji:'🎮',  description:'Race your tokens home in this beloved 4-player classic.',                 category:'classic', players:'2-4', hasBot:true,  color:'from-red-700 to-pink-900',       bgPattern:'★' },
  { id:'snakeladders', title:'Snake & Ladders',  emoji:'🐍', description:'Climb the ladders, dodge the snakes — pure luck & fun!',                 category:'classic', players:'2-4', hasBot:false, color:'from-emerald-700 to-green-900',  bgPattern:'〜' },
]

type Screen = 'hub' | 'setup' | 'game' | 'gameover' | 'leaderboard'

export interface GameResult {
  winner:     string
  score?:     number
  gameId:     string
  difficulty: string
}

export default function App() {
  const [screen,       setScreen]       = useState<Screen>('hub')
  const [activeGame,   setActiveGame]   = useState<GameInfo | null>(null)
  const [gameConfig,   setGameConfig]   = useState<GameConfig | null>(null)
  const [gameResult,   setGameResult]   = useState<GameResult | null>(null)
  const [filterCat,    setFilterCat]    = useState<string>('all')
  const [searchQuery,  setSearchQuery]  = useState('')

  // ── routing helpers ──────────────────────────────────
  const openGame = (game: GameInfo) => {
    setActiveGame(game)
    setScreen('setup')
  }

  const startGame = (cfg: GameConfig) => {
    setGameConfig(cfg)
    setScreen('game')
  }

  const finishGame = (result: GameResult) => {
    setGameResult(result)
    setScreen('gameover')
  }

  const backToHub = () => {
    setScreen('hub')
    setActiveGame(null)
    setGameConfig(null)
    setGameResult(null)
  }

  const playAgain = () => {
    setScreen('game')
    setGameResult(null)
  }

  // ── filter & search ──────────────────────────────────
  const visibleGames = GAMES.filter(g => {
    const matchCat  = filterCat === 'all' || g.category === filterCat
    const matchName = g.title.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCat && matchName
  })

  // ── render active game ───────────────────────────────
  const renderGame = () => {
    if (!activeGame || !gameConfig) return null
    const props = { config: gameConfig, onGameOver: finishGame, onExit: backToHub }
    switch (activeGame.id) {
      case 'chess':        return <Chess        {...props} />
      case 'carrom':       return <Carrom       {...props} />
      case 'tictactoe':    return <TicTacToe    {...props} />
      case 'sudoku':       return <Sudoku       {...props} />
      case 'chowkabara':   return <ChowkaBara   {...props} />
      case 'kattamane':    return <KattaMane    {...props} />
      case 'taayam':       return <Taayam       {...props} />
      case 'kaangichalla': return <KaangiChalla {...props} />
      case 'kaanadua':     return <KaanaDua     {...props} />
      case 'ludo':         return <Ludo         {...props} />
      case 'snakeladders': return <SnakeLadders {...props} />
      default:             return null
    }
  }

  // ── category pills ───────────────────────────────────
  const CATS = [
    { id:'all',     label:'🎮 All Games' },
    { id:'classic', label:'♟️ Classic' },
    { id:'indian',  label:'🪔 Indian' },
    { id:'puzzle',  label:'🧩 Puzzle' },
  ]

  return (
    <div className="min-h-screen relative">
      <ParticlesBg />

      {/* ── HUB ───────────────────────── */}
      {screen === 'hub' && (
        <div className="relative z-10">
          <Header onLeaderboard={() => setScreen('leaderboard')} />

          {/* Hero */}
          <section className="text-center py-16 px-4">
            <h1 className="font-display text-5xl md:text-7xl font-bold mb-4
                           bg-gradient-to-r from-brand-400 via-white to-gold-400
                           bg-clip-text text-transparent animate-float">
              GameHub
            </h1>
            <p className="text-white/60 text-lg md:text-xl max-w-xl mx-auto mb-2">
              Classic & traditional Indian board games in one place.
            </p>
            <p className="text-white/40 text-sm">
              {GAMES.length} games · Multiplayer · vs Bot · 3 Difficulty Levels
            </p>
          </section>

          {/* Filters + search */}
          <section className="max-w-6xl mx-auto px-4 mb-8">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                {CATS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setFilterCat(c.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                      ${filterCat === c.id
                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/40'
                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <input
                type="search"
                placeholder="Search games…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2
                           text-white placeholder-white/30 text-sm outline-none
                           focus:border-brand-500 transition-colors w-48"
              />
            </div>
          </section>

          {/* Game grid */}
          <section className="max-w-6xl mx-auto px-4 pb-20">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {visibleGames.map((game, i) => (
                <GameCard
                  key={game.id}
                  game={game}
                  index={i}
                  onPlay={() => openGame(game)}
                />
              ))}
            </div>
            {visibleGames.length === 0 && (
              <div className="text-center py-20 text-white/30 text-lg">
                No games found 🎲
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── SETUP ─────────────────────── */}
      {screen === 'setup' && activeGame && (
        <PlayerSetup
          game={activeGame}
          onStart={startGame}
          onBack={() => setScreen('hub')}
        />
      )}

      {/* ── GAME ──────────────────────── */}
      {screen === 'game' && renderGame()}

      {/* ── GAME OVER ─────────────────── */}
      {screen === 'gameover' && gameResult && (
        <GameOver
          result={gameResult}
          onPlayAgain={playAgain}
          onHome={backToHub}
        />
      )}

      {/* ── LEADERBOARD ───────────────── */}
      {screen === 'leaderboard' && (
        <Leaderboard onBack={() => setScreen('hub')} />
      )}
    </div>
  )
}

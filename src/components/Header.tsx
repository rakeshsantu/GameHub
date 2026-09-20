interface HeaderProps {
  onLeaderboard: () => void
}

export default function Header({ onLeaderboard }: HeaderProps) {
  return (
    <header className="relative z-10 flex items-center justify-between px-6 py-4
                       border-b border-white/5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🎮</span>
        <span className="font-display text-xl font-bold bg-gradient-to-r
                         from-brand-400 to-gold-400 bg-clip-text text-transparent">
          GameHub
        </span>
      </div>
      <button
        onClick={onLeaderboard}
        className="game-btn-ghost text-sm flex items-center gap-2 py-2 px-4"
      >
        🏆 Leaderboard
      </button>
    </header>
  )
}

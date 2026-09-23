interface HeaderProps {
  onLeaderboard: () => void
}

export default function Header({ onLeaderboard }: HeaderProps) {
  return (
    <header className="relative z-10 border-b"
            style={{ borderColor: 'rgba(212,168,67,0.25)', background: 'linear-gradient(180deg,rgba(26,12,6,0.98) 0%,rgba(19,10,4,0.95) 100%)' }}>
      {/* top ornament strip */}
      <div className="h-0.5 w-full"
           style={{ background: 'linear-gradient(90deg,transparent,#d4a843,#fbbf24,#d4a843,transparent)' }} />

      <div className="flex items-center justify-between px-6 py-3">
        {/* Logo */}
        <div className="flex items-center gap-3">
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
        <button
          onClick={onLeaderboard}
          className="btn-ghost text-sm py-1.5 px-4 flex items-center gap-2"
        >
          <span>🏆</span> Leaderboard
        </button>
      </div>

      {/* bottom ornament strip */}
      <div className="h-px w-full"
           style={{ background: 'linear-gradient(90deg,transparent,rgba(212,168,67,0.35),transparent)' }} />
    </header>
  )
}

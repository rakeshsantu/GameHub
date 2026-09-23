import { GameInfo } from '../types'

interface Props {
  game:   GameInfo
  index:  number
  onPlay: () => void
}

const CAT_LABEL: Record<string, string> = {
  classic: '⚔ Classic',
  indian:  '🪔 Indian',
  puzzle:  '🧩 Puzzle',
}

const CAT_COLOR: Record<string, string> = {
  classic: 'rgba(155,42,68,0.7)',
  indian:  'rgba(139,90,43,0.7)',
  puzzle:  'rgba(35,92,58,0.7)',
}

export default function GameCard({ game, index, onPlay }: Props) {
  return (
    <div
      className="group relative rounded-xl overflow-hidden cursor-pointer
                 transition-all duration-300 hover:-translate-y-1 animate-slide-up"
      style={{
        animationDelay: `${index * 55}ms`,
        animationFillMode: 'both',
        background: 'linear-gradient(160deg, rgba(42,21,9,0.92) 0%, rgba(22,10,4,0.97) 100%)',
        border: '1px solid rgba(212,168,67,0.22)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
      }}
      onClick={onPlay}
    >
      {/* Top gold accent line */}
      <div className="h-0.5 w-full transition-all duration-300 group-hover:opacity-100 opacity-60"
           style={{ background: 'linear-gradient(90deg,transparent,#d4a843,transparent)' }} />

      {/* Watermark pattern */}
      <div className="absolute -right-3 -bottom-3 text-7xl select-none pointer-events-none
                      transition-opacity duration-300 opacity-[0.06] group-hover:opacity-[0.12]">
        {game.bgPattern}
      </div>

      <div className="relative p-5">
        {/* Top row: emoji + category badge */}
        <div className="flex items-start justify-between mb-3">
          <span className="text-4xl leading-none drop-shadow-lg">{game.emoji}</span>
          <span className="badge-classical text-[10px]">{CAT_LABEL[game.category]}</span>
        </div>

        {/* Title */}
        <h3 className="mb-1 text-base leading-snug transition-colors duration-200
                       group-hover:text-gold-300"
            style={{ fontFamily: 'Cinzel, Georgia, serif', fontWeight: 600, color: '#f5f0e8', letterSpacing: '0.03em' }}>
          {game.title}
        </h3>

        {/* Description */}
        <p className="text-sm leading-relaxed mb-4 line-clamp-2"
           style={{ color: 'rgba(245,240,232,0.5)', fontFamily: 'Crimson Text, Georgia, serif' }}>
          {game.description}
        </p>

        {/* Footer: meta + play button */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3 text-xs" style={{ color: 'rgba(212,168,67,0.5)', fontFamily: 'Cinzel, serif' }}>
            <span>👥 {game.players}</span>
            {game.hasBot && <span>🤖 Bot</span>}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onPlay() }}
            className="btn-gold text-xs py-1.5 px-4"
          >
            Play
          </button>
        </div>
      </div>

      {/* Bottom accent on hover */}
      <div className="h-px w-full transition-opacity duration-300 opacity-0 group-hover:opacity-100"
           style={{ background: 'linear-gradient(90deg,transparent,rgba(212,168,67,0.4),transparent)' }} />
    </div>
  )
}

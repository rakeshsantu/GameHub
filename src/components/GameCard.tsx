import { GameInfo } from '../types'

interface Props {
  game:    GameInfo
  index:   number
  onPlay:  () => void
}

export default function GameCard({ game, index, onPlay }: Props) {
  return (
    <div
      className="group relative card-glass overflow-hidden cursor-pointer
                 hover:border-white/25 hover:scale-[1.03] transition-all duration-300
                 animate-slide-up"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
      onClick={onPlay}
    >
      {/* gradient bg */}
      <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-20
                        group-hover:opacity-35 transition-opacity`} />

      {/* pattern watermark */}
      <div className="absolute -right-4 -bottom-4 text-8xl opacity-10 select-none
                       group-hover:opacity-20 transition-opacity">
        {game.bgPattern}
      </div>

      <div className="relative p-5">
        {/* top row */}
        <div className="flex items-start justify-between mb-3">
          <span className="text-4xl">{game.emoji}</span>
          <span className={`badge text-[10px] uppercase tracking-wider
            ${game.category === 'indian'  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/20' :
              game.category === 'puzzle'  ? 'bg-green-500/20  text-green-300  border border-green-500/20'  :
                                            'bg-brand-500/20  text-brand-300  border border-brand-500/20'}`}>
            {game.category}
          </span>
        </div>

        <h3 className="font-semibold text-white text-lg mb-1 group-hover:text-brand-300
                        transition-colors">
          {game.title}
        </h3>
        <p className="text-white/50 text-xs leading-relaxed mb-4 line-clamp-2">
          {game.description}
        </p>

        {/* bottom meta */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2 text-xs text-white/40">
            <span>👥 {game.players}</span>
            {game.hasBot && <span>🤖 Bot</span>}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onPlay() }}
            className="game-btn-primary text-xs py-1.5 px-4"
          >
            Play
          </button>
        </div>
      </div>
    </div>
  )
}

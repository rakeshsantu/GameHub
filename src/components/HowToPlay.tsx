import { useEffect } from 'react'

export interface HowToPlayData {
  title:       string
  emoji:       string
  objective:   string
  players:     string
  setup:       string[]
  rules:       string[]
  tips:        string[]
  winCondition: string
}

interface Props {
  data:    HowToPlayData
  onClose: () => void
}

export default function HowToPlay({ data, onClose }: Props) {
  /* Close on Escape */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up overflow-hidden rounded-2xl"
           style={{
             background: 'linear-gradient(160deg,#2a1509 0%,#180d05 100%)',
             border: '1px solid rgba(212,168,67,0.35)',
             boxShadow: '0 8px 48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(212,168,67,0.2)',
           }}>

        {/* Gold top bar */}
        <div className="h-1 flex-shrink-0"
             style={{ background:'linear-gradient(90deg,transparent,#fbbf24,#d4a843,#fbbf24,transparent)' }} />

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-4xl drop-shadow-lg">{data.emoji}</span>
            <div>
              <h2 style={{ fontFamily:'Cinzel Decorative,serif', color:'#fbbf24', fontSize:'1.2rem', lineHeight:1.2 }}>
                How to Play
              </h2>
              <p style={{ fontFamily:'Cinzel,serif', color:'rgba(212,168,67,0.7)', fontSize:'0.8rem', letterSpacing:'0.06em' }}>
                {data.title}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-xl leading-none transition-all hover:scale-110 flex-shrink-0 mt-1"
            style={{ color:'rgba(212,168,67,0.5)', fontFamily:'serif' }}
            aria-label="Close">
            ✕
          </button>
        </div>

        {/* Divider */}
        <div className="h-px mx-6 flex-shrink-0"
             style={{ background:'linear-gradient(90deg,transparent,rgba(212,168,67,0.35),transparent)' }} />

        {/* Scrollable content */}
        <div className="overflow-y-auto px-6 py-4 space-y-5 flex-1 text-sm"
             style={{ fontFamily:'Crimson Text, Georgia, serif', color:'rgba(245,240,232,0.82)' }}>

          {/* Objective */}
          <Section icon="🎯" title="Objective">
            <p className="leading-relaxed">{data.objective}</p>
          </Section>

          {/* Players & Setup */}
          <div className="grid grid-cols-2 gap-3">
            <MiniCard icon="👥" title="Players" value={data.players} />
            <MiniCard icon="🏆" title="Win by" value={data.winCondition} />
          </div>

          {/* Setup */}
          {data.setup.length > 0 && (
            <Section icon="🗺" title="Setup">
              <ol className="space-y-1.5 list-none">
                {data.setup.map((s, i) => (
                  <li key={i} className="flex gap-2 leading-relaxed">
                    <span className="flex-shrink-0 font-bold" style={{ color:'#d4a843' }}>{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {/* Rules */}
          <Section icon="📜" title="Rules">
            <ul className="space-y-1.5 list-none">
              {data.rules.map((r, i) => (
                <li key={i} className="flex gap-2 leading-relaxed">
                  <span className="flex-shrink-0" style={{ color:'#9b2a44' }}>✦</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Tips */}
          {data.tips.length > 0 && (
            <Section icon="💡" title="Royal Tips">
              <ul className="space-y-1.5 list-none">
                {data.tips.map((t, i) => (
                  <li key={i} className="flex gap-2 leading-relaxed">
                    <span className="flex-shrink-0" style={{ color:'#d97706' }}>◆</span>
                    <span style={{ fontStyle:'italic', color:'rgba(245,240,232,0.65)' }}>{t}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex-shrink-0 border-t"
             style={{ borderColor:'rgba(212,168,67,0.2)' }}>
          <button onClick={onClose} className="btn-gold w-full py-3">
            ⚔ Begin the Game
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────── */
function Section({ icon, title, children }: { icon:string; title:string; children:React.ReactNode }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 mb-2 text-xs tracking-[0.14em] uppercase"
          style={{ fontFamily:'Cinzel,serif', color:'rgba(212,168,67,0.7)' }}>
        <span>{icon}</span>{title}
      </h3>
      {children}
    </div>
  )
}

function MiniCard({ icon, title, value }: { icon:string; title:string; value:string }) {
  return (
    <div className="rounded-lg px-3 py-2.5 text-center"
         style={{ background:'rgba(42,21,9,0.7)', border:'1px solid rgba(212,168,67,0.18)' }}>
      <div className="text-lg mb-0.5">{icon}</div>
      <div className="text-[10px] tracking-widest uppercase mb-0.5"
           style={{ fontFamily:'Cinzel,serif', color:'rgba(212,168,67,0.5)' }}>{title}</div>
      <div className="text-xs font-semibold"
           style={{ color:'#f5f0e8', fontFamily:'Crimson Text,serif' }}>{value}</div>
    </div>
  )
}

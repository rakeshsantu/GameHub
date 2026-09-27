import { useState, FormEvent } from 'react'

interface Props {
  /** Whether the player was registered via mobile OTP (no existing password) */
  isMobileOnly: boolean
  onSubmit:     (currentPw: string, newPw: string, confirm: string) => Promise<boolean>
  onClose:      () => void
  loading:      boolean
  error:        string | null
  onClearError: () => void
}

export default function ChangePassword({
  isMobileOnly, onSubmit, onClose, loading, error, onClearError,
}: Props) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [localErr,  setLocalErr]  = useState<string | null>(null)
  const [success,   setSuccess]   = useState(false)

  const displayError = localErr || error

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLocalErr(null)
    onClearError()

    if (!isMobileOnly && !currentPw) return setLocalErr('Enter your current password.')
    if (newPw.length < 6)            return setLocalErr('New password must be at least 6 characters.')
    if (newPw !== confirm)           return setLocalErr('Passwords do not match.')
    if (!isMobileOnly && newPw === currentPw)
      return setLocalErr('New password must differ from your current one.')

    const ok = await onSubmit(currentPw, newPw, confirm)
    if (ok) { setSuccess(true); setTimeout(onClose, 2000) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
         style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-sm animate-slide-up">
        <div className="panel-royal overflow-hidden">
          <div className="h-1"
               style={{ background: 'linear-gradient(90deg,transparent,#d4a843,#fbbf24,#d4a843,transparent)' }} />

          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="heading-classical text-lg">
                {isMobileOnly ? '🔑 Set Password' : '🔑 Change Password'}
              </h2>
              <button onClick={onClose}
                className="text-xl leading-none"
                style={{ color: 'rgba(212,168,67,0.4)' }}
                aria-label="Close">
                ✕
              </button>
            </div>

            <div className="divider-classical mb-4">
              <span className="text-xs tracking-widest uppercase"
                    style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Cinzel,serif' }}>
                {isMobileOnly ? 'Create a Password for Your Account' : 'Update Your Password'}
              </span>
            </div>

            {/* Success */}
            {success && (
              <div className="px-4 py-3 rounded-lg text-sm mb-4"
                   style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
                            color: '#6ee7b7', fontFamily: 'Crimson Text,serif' }}>
                ✓ Password {isMobileOnly ? 'set' : 'changed'} successfully!
              </div>
            )}

            {/* Error */}
            {displayError && !success && (
              <div className="px-4 py-3 rounded-lg text-sm mb-4"
                   style={{ background: 'rgba(155,42,68,0.25)', border: '1px solid rgba(155,42,68,0.5)',
                            color: '#fca5a5', fontFamily: 'Crimson Text,serif' }}>
                ⚠ {displayError}
              </div>
            )}

            {!success && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Current password — skip for mobile-only accounts */}
                {!isMobileOnly && (
                  <PwField label="Current Password" icon="🔒" placeholder="Your current password"
                    value={currentPw} onChange={setCurrentPw} autoComplete="current-password" />
                )}

                <PwField label="New Password" icon="🔑" placeholder="Min 6 characters"
                  value={newPw} onChange={setNewPw} autoComplete="new-password" />

                <PwField label="Confirm New Password" icon="🔐" placeholder="Repeat new password"
                  value={confirm} onChange={setConfirm} autoComplete="new-password" />

                {/* Strength indicator */}
                {newPw.length > 0 && (
                  <StrengthBar password={newPw} />
                )}

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={loading}
                    className="btn-gold flex-1 py-3 text-sm"
                    style={{ opacity: loading ? 0.7 : 1 }}>
                    {loading ? '⏳ Saving…' : isMobileOnly ? '🔑 Set Password' : '🔑 Change Password'}
                  </button>
                  <button type="button" onClick={onClose}
                    className="btn-ghost flex-1 py-3 text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="h-px"
               style={{ background: 'linear-gradient(90deg,transparent,rgba(212,168,67,0.3),transparent)' }} />
        </div>
      </div>
    </div>
  )
}

// ── Password field ────────────────────────────────────────────────────────
function PwField({ label, icon, placeholder, value, onChange, autoComplete }: {
  label: string; icon: string; placeholder: string
  value: string; onChange: (v: string) => void; autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-xs tracking-[0.15em] uppercase mb-1.5"
             style={{ color: 'rgba(212,168,67,0.6)', fontFamily: 'Cinzel,serif' }}>
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
              style={{ color: 'rgba(212,168,67,0.45)' }}>
          {icon}
        </span>
        <input
          type={show ? 'text' : 'password'}
          value={value} placeholder={placeholder} autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-9 pr-10 py-2.5 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'rgba(26,12,6,0.7)', border: '1px solid rgba(212,168,67,0.25)',
                   color: '#f5f0e8', fontFamily: 'Cinzel,serif' }}
          onFocus={e => (e.target.style.borderColor = 'rgba(212,168,67,0.55)')}
          onBlur={e  => (e.target.style.borderColor = 'rgba(212,168,67,0.25)')}
        />
        {/* Show/hide toggle */}
        <button type="button" onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
          style={{ color: 'rgba(212,168,67,0.4)' }}
          tabIndex={-1}>
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  )
}

// ── Password strength bar ─────────────────────────────────────────────────
function StrengthBar({ password }: { password: string }) {
  const score = calcStrength(password)
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a']
  return (
    <div>
      <div className="flex gap-1 mb-1">
        {[0,1,2,3].map(i => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
               style={{ background: i < score ? colors[score] : 'rgba(212,168,67,0.1)' }} />
        ))}
      </div>
      <div className="text-[10px]" style={{ color: colors[score], fontFamily: 'Crimson Text,serif' }}>
        {labels[score]}
      </div>
    </div>
  )
}

function calcStrength(pw: string): number {
  if (pw.length < 6) return 0
  let s = 1
  if (pw.length >= 8)               s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(s, 4)
}

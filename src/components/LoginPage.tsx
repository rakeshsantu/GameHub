import { useState, useEffect, useRef, FormEvent } from 'react'

// ─── Avatar options ───────────────────────────────────────────────────────
const AVATARS = ['👤','⚔','🛡','♟','🎯','👑','🦁','🐉','🦅','🌟','🔥','💎']

// ─── All auth modes the page can be in ───────────────────────────────────
type Mode =
  | 'login-email'    // sign in with email/username + password
  | 'login-otp'      // sign in with mobile OTP
  | 'register-email' // create account with email + password
  | 'register-otp'   // create account with mobile OTP
  | 'forgot'         // request password-reset email
  | 'reset'          // enter new password (came from email link)

// ─── OTP sub-steps ────────────────────────────────────────────────────────
type OtpStep = 'enter-phone' | 'enter-otp' | 'enter-name'

interface Props {
  // Email/password flows
  onLogin:          (loginId: string, password: string) => Promise<boolean>
  onRegister:       (username: string, email: string, password: string, avatar: string,
                     mobile?: string, otpToken?: string) => Promise<boolean>
  // OTP flows
  onSendOtp:        (identifier: string, purpose: 'login' | 'register') => Promise<boolean>
  onVerifyOtp:      (identifier: string, otp: string, purpose: 'login' | 'register') => Promise<string | null>
  onLoginWithOtp:   (mobile: string, verifiedToken: string) => Promise<boolean>
  // Password flows
  onForgotPassword: (email: string) => Promise<boolean>
  onResetPassword:  (uid: number, token: string, newPw: string, confirm: string) => Promise<boolean>
  // State from hook
  loading:          boolean
  error:            string | null
  otpResendAfter:   number
  onClearError:     () => void
}

export default function LoginPage({
  onLogin, onRegister,
  onSendOtp, onVerifyOtp, onLoginWithOtp,
  onForgotPassword, onResetPassword,
  loading, error, otpResendAfter, onClearError,
}: Props) {

  // ── Detect reset link in URL hash (#reset?token=...&uid=...) ─────────────
  const resetParams = parseResetHash()

  const [mode, setMode] = useState<Mode>(resetParams ? 'reset' : 'login-email')

  // ── Common fields ─────────────────────────────────────────────────────────
  const [username,    setUsername]    = useState('')
  const [email,       setEmail]       = useState('')
  const [mobile,      setMobile]      = useState('')
  const [password,    setPassword]    = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')
  const [loginId,     setLoginId]     = useState('')
  const [avatar,      setAvatar]      = useState('👤')
  const [showAvatars, setShowAvatars] = useState(false)
  const [localErr,    setLocalErr]    = useState<string | null>(null)
  const [successMsg,  setSuccessMsg]  = useState<string | null>(null)

  // ── OTP flow state ────────────────────────────────────────────────────────
  const [otpStep,      setOtpStep]      = useState<OtpStep>('enter-phone')
  const [otpCode,      setOtpCode]      = useState('')
  const [otpToken,     setOtpToken]     = useState('')  // verified token from server
  const [resendTimer,  setResendTimer]  = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start countdown when otpResendAfter changes
  useEffect(() => {
    if (otpResendAfter > 0) {
      setResendTimer(otpResendAfter)
      timerRef.current = setInterval(() => {
        setResendTimer(t => { if (t <= 1) { clearInterval(timerRef.current!); return 0 } return t - 1 })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [otpResendAfter])

  const switchMode = (m: Mode) => {
    setMode(m)
    setLocalErr(null)
    setSuccessMsg(null)
    setOtpStep('enter-phone')
    setOtpCode('')
    setOtpToken('')
    onClearError()
  }

  const displayError = localErr || error

  // ══════════════════════════════════════════════════════════════════════════
  // Submit handlers
  // ══════════════════════════════════════════════════════════════════════════

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault(); setLocalErr(null); onClearError()
    if (!loginId) return setLocalErr('Enter your username or email.')
    if (!password) return setLocalErr('Enter your password.')
    await onLogin(loginId.trim(), password)
  }

  const handleEmailRegister = async (e: FormEvent) => {
    e.preventDefault(); setLocalErr(null); onClearError()
    if (username.length < 3)          return setLocalErr('Username must be at least 3 characters.')
    if (!/\S+@\S+\.\S+/.test(email))  return setLocalErr('Enter a valid email address.')
    if (password.length < 6)          return setLocalErr('Password must be at least 6 characters.')
    if (password !== confirmPw)        return setLocalErr('Passwords do not match.')
    await onRegister(username.trim(), email.trim(), password, avatar)
  }

  // ── OTP: Step 1 — send OTP ────────────────────────────────────────────────
  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault(); setLocalErr(null); onClearError()
    const norm = normaliseMobile(mobile)
    if (!norm) return setLocalErr('Enter a valid mobile number.')
    const purpose = mode === 'login-otp' ? 'login' : 'register'
    const ok = await onSendOtp(norm, purpose)
    if (ok) setOtpStep('enter-otp')
  }

  // ── OTP: Step 2 — verify OTP ──────────────────────────────────────────────
  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault(); setLocalErr(null); onClearError()
    if (otpCode.length !== 6) return setLocalErr('Enter the 6-digit OTP.')
    const norm    = normaliseMobile(mobile)!
    const purpose = mode === 'login-otp' ? 'login' : 'register'
    const vToken  = await onVerifyOtp(norm, otpCode, purpose)
    if (!vToken) return
    setOtpToken(vToken)
    if (mode === 'login-otp') {
      await onLoginWithOtp(norm, vToken)
    } else {
      // register-otp: go to step 3 to pick username & avatar
      setOtpStep('enter-name')
    }
  }

  // ── OTP: Step 3 (register) — finish account creation ─────────────────────
  const handleOtpRegister = async (e: FormEvent) => {
    e.preventDefault(); setLocalErr(null); onClearError()
    if (username.length < 3) return setLocalErr('Username must be at least 3 characters.')
    const norm = normaliseMobile(mobile)!
    await onRegister(username.trim(), '', '', avatar, norm, otpToken)
  }

  // ── Forgot password ───────────────────────────────────────────────────────
  const handleForgot = async (e: FormEvent) => {
    e.preventDefault(); setLocalErr(null); onClearError()
    if (!email || !/\S+@\S+\.\S+/.test(email))
      return setLocalErr('Enter a valid email address.')
    const ok = await onForgotPassword(email.trim())
    if (ok) setSuccessMsg('If that email exists, a reset link has been sent. Check your inbox.')
  }

  // ── Reset password ────────────────────────────────────────────────────────
  const handleReset = async (e: FormEvent) => {
    e.preventDefault(); setLocalErr(null); onClearError()
    if (!resetParams) return
    if (password.length < 6)   return setLocalErr('Password must be at least 6 characters.')
    if (password !== confirmPw) return setLocalErr('Passwords do not match.')
    const ok = await onResetPassword(resetParams.uid, resetParams.token, password, confirmPw)
    if (ok) {
      setSuccessMsg('Password reset! You can now sign in.')
      // Clear the hash so the reset form doesn't re-appear
      window.history.replaceState(null, '', window.location.pathname)
      setTimeout(() => switchMode('login-email'), 2000)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Render helpers
  // ══════════════════════════════════════════════════════════════════════════

  const isOtpMode     = mode === 'login-otp' || mode === 'register-otp'
  const isRegisterMode= mode === 'register-email' || mode === 'register-otp'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-10 py-8">
      <div className="w-full max-w-md animate-slide-up">

        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3 animate-float drop-shadow-2xl">♟</div>
          <h1 className="heading-classical text-4xl mb-1">GameHub</h1>
          <p className="text-xs tracking-[0.18em] uppercase"
             style={{ color: 'rgba(212,168,67,0.5)', fontFamily: 'Cinzel,serif' }}>
            Royal Board Games
          </p>
        </div>

        {/* ── Card ──────────────────────────────────────────────────────── */}
        <div className="panel-royal overflow-hidden">
          <div className="h-1"
               style={{ background: 'linear-gradient(90deg,transparent,#d4a843,#fbbf24,#d4a843,transparent)' }} />

          <div className="p-7">

            {/* ── Mode is NOT reset / forgot ─── show main tabs ────────── */}
            {mode !== 'forgot' && mode !== 'reset' && (
              <>
                {/* Register / Sign In top tabs */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {([
                    { id: 'register-email', label: '⚔ Join' },
                    { id: 'login-email',    label: '🗡 Sign In' },
                  ] as const).map(t => (
                    <button key={t.id} type="button"
                      onClick={() => switchMode(t.id)}
                      className="py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
                      style={{
                        fontFamily: 'Cinzel,serif',
                        background: (mode === t.id || (t.id === 'register-email' && mode === 'register-otp') || (t.id === 'login-email' && mode === 'login-otp'))
                          ? 'linear-gradient(180deg,#9b2a44 0%,#7a1f34 100%)'
                          : 'rgba(42,21,9,0.6)',
                        border: (mode === t.id || (t.id === 'register-email' && mode === 'register-otp') || (t.id === 'login-email' && mode === 'login-otp'))
                          ? '1px solid rgba(212,168,67,0.5)'
                          : '1px solid rgba(212,168,67,0.15)',
                        color: (mode === t.id || (t.id === 'register-email' && mode === 'register-otp') || (t.id === 'login-email' && mode === 'login-otp'))
                          ? '#fde68a' : 'rgba(245,240,232,0.45)',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Email / Mobile sub-tabs */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {([
                    { email: isRegisterMode ? 'register-email' : 'login-email', label: '📧 Email' },
                    { email: isRegisterMode ? 'register-otp'   : 'login-otp',   label: '📱 Mobile OTP' },
                  ] as { email: Mode; label: string }[]).map(t => (
                    <button key={t.email} type="button"
                      onClick={() => { switchMode(t.email) }}
                      className="py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        fontFamily: 'Cinzel,serif',
                        background: mode === t.email ? 'rgba(212,168,67,0.12)' : 'transparent',
                        border: mode === t.email
                          ? '1px solid rgba(212,168,67,0.4)'
                          : '1px solid rgba(212,168,67,0.1)',
                        color: mode === t.email ? '#fde68a' : 'rgba(245,240,232,0.35)',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── Divider label ─────────────────────────────────────────── */}
            <div className="divider-classical mb-5">
              <span className="text-xs tracking-widest uppercase"
                    style={{ color: 'rgba(212,168,67,0.45)', fontFamily: 'Cinzel,serif' }}>
                {mode === 'login-email'    && 'Enter Your Credentials'}
                {mode === 'login-otp'      && (otpStep === 'enter-phone' ? 'Enter Mobile Number' : 'Enter OTP')}
                {mode === 'register-email' && 'Create Your Legend'}
                {mode === 'register-otp'   && (otpStep === 'enter-phone' ? 'Enter Mobile Number' : otpStep === 'enter-otp' ? 'Enter OTP' : 'Pick a Name')}
                {mode === 'forgot'         && 'Recover Your Account'}
                {mode === 'reset'          && 'Set New Password'}
              </span>
            </div>

            {/* ── Error / success banners ───────────────────────────────── */}
            {displayError && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm"
                   style={{ background: 'rgba(155,42,68,0.25)', border: '1px solid rgba(155,42,68,0.5)', color: '#fca5a5', fontFamily: 'Crimson Text,serif' }}>
                ⚠ {displayError}
              </div>
            )}
            {successMsg && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm"
                   style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#6ee7b7', fontFamily: 'Crimson Text,serif' }}>
                ✓ {successMsg}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                FORM: Email + Password Login
            ════════════════════════════════════════════════════════════ */}
            {mode === 'login-email' && (
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <Field label="Username or Email" icon="👤" placeholder="Enter username or email"
                  value={loginId} onChange={setLoginId} autoComplete="username" />
                <Field label="Password" icon="🔒" placeholder="Your password"
                  value={password} onChange={setPassword} type="password" autoComplete="current-password" />

                <button type="submit" disabled={loading} className="btn-gold w-full py-4 text-base"
                  style={{ opacity: loading ? 0.7 : 1 }}>
                  {loading ? '⏳ Signing in…' : '⚔ Enter the Hall'}
                </button>

                <div className="flex justify-between items-center pt-1">
                  <button type="button" onClick={() => switchMode('forgot')}
                    className="text-xs underline"
                    style={{ color: 'rgba(212,168,67,0.45)', fontFamily: 'Crimson Text,serif' }}>
                    Forgot password?
                  </button>
                  <button type="button" onClick={() => switchMode('register-email')}
                    className="text-xs underline"
                    style={{ color: 'rgba(212,168,67,0.45)', fontFamily: 'Crimson Text,serif' }}>
                    Join the realm →
                  </button>
                </div>
              </form>
            )}

            {/* ════════════════════════════════════════════════════════════
                FORM: Email + Password Register
            ════════════════════════════════════════════════════════════ */}
            {mode === 'register-email' && (
              <form onSubmit={handleEmailRegister} className="space-y-4">
                <AvatarPicker avatar={avatar} setAvatar={setAvatar}
                  showAvatars={showAvatars} setShowAvatars={setShowAvatars} />
                <Field label="Username" icon="⚔" placeholder="Your warrior name"
                  value={username} onChange={setUsername} autoComplete="username" />
                <Field label="Email" icon="📜" placeholder="your@email.com"
                  value={email} onChange={setEmail} type="email" autoComplete="email" />
                <Field label="Password" icon="🔒" placeholder="Min 6 characters"
                  value={password} onChange={setPassword} type="password" autoComplete="new-password" />
                <Field label="Confirm Password" icon="🔐" placeholder="Repeat your password"
                  value={confirmPw} onChange={setConfirmPw} type="password" autoComplete="new-password" />

                <button type="submit" disabled={loading} className="btn-gold w-full py-4 text-base"
                  style={{ opacity: loading ? 0.7 : 1 }}>
                  {loading ? '⏳ Creating…' : '🏰 Create My Legend'}
                </button>
              </form>
            )}

            {/* ════════════════════════════════════════════════════════════
                FORM: Mobile OTP Login / Register — Step 1: phone
            ════════════════════════════════════════════════════════════ */}
            {isOtpMode && otpStep === 'enter-phone' && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <Field label="Mobile Number" icon="📱" placeholder="+91 98765 43210"
                  value={mobile} onChange={setMobile} type="tel" autoComplete="tel" />
                <p className="text-xs" style={{ color: 'rgba(212,168,67,0.35)', fontFamily: 'Crimson Text,serif', fontStyle: 'italic' }}>
                  Enter your number in international format, e.g. +91 for India.
                </p>
                <button type="submit" disabled={loading} className="btn-gold w-full py-4 text-base"
                  style={{ opacity: loading ? 0.7 : 1 }}>
                  {loading ? '⏳ Sending…' : '📨 Send OTP'}
                </button>
              </form>
            )}

            {/* ════════════════════════════════════════════════════════════
                FORM: Mobile OTP — Step 2: enter OTP
            ════════════════════════════════════════════════════════════ */}
            {isOtpMode && otpStep === 'enter-otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-center text-xs mb-2"
                     style={{ color: 'rgba(212,168,67,0.5)', fontFamily: 'Crimson Text,serif' }}>
                  OTP sent to <span style={{ color: '#fde68a' }}>{mobile}</span>
                  <button type="button" onClick={() => setOtpStep('enter-phone')}
                    className="ml-2 underline" style={{ color: 'rgba(212,168,67,0.45)' }}>
                    Change
                  </button>
                </div>

                {/* 6-digit OTP input */}
                <OtpInput value={otpCode} onChange={setOtpCode} />

                <button type="submit" disabled={loading || otpCode.length !== 6}
                  className="btn-gold w-full py-4 text-base"
                  style={{ opacity: (loading || otpCode.length !== 6) ? 0.7 : 1 }}>
                  {loading ? '⏳ Verifying…' : '✓ Verify OTP'}
                </button>

                {/* Resend */}
                <div className="text-center text-xs"
                     style={{ color: 'rgba(212,168,67,0.4)', fontFamily: 'Crimson Text,serif' }}>
                  {resendTimer > 0
                    ? `Resend available in ${resendTimer}s`
                    : (
                      <button type="button"
                        onClick={() => { setOtpCode(''); onClearError(); handleSendOtp({ preventDefault: () => {} } as FormEvent) }}
                        className="underline" style={{ color: 'rgba(212,168,67,0.6)' }}>
                        Resend OTP
                      </button>
                    )}
                </div>
              </form>
            )}

            {/* ════════════════════════════════════════════════════════════
                FORM: Mobile OTP Register — Step 3: pick username + avatar
            ════════════════════════════════════════════════════════════ */}
            {mode === 'register-otp' && otpStep === 'enter-name' && (
              <form onSubmit={handleOtpRegister} className="space-y-4">
                <div className="text-center text-xs mb-2"
                     style={{ color: '#6ee7b7', fontFamily: 'Crimson Text,serif' }}>
                  ✓ Mobile {mobile} verified. Complete your profile.
                </div>
                <AvatarPicker avatar={avatar} setAvatar={setAvatar}
                  showAvatars={showAvatars} setShowAvatars={setShowAvatars} />
                <Field label="Username" icon="⚔" placeholder="Your warrior name"
                  value={username} onChange={setUsername} autoComplete="username" />
                <button type="submit" disabled={loading} className="btn-gold w-full py-4 text-base"
                  style={{ opacity: loading ? 0.7 : 1 }}>
                  {loading ? '⏳ Creating…' : '🏰 Create My Legend'}
                </button>
              </form>
            )}

            {/* ════════════════════════════════════════════════════════════
                FORM: Forgot Password
            ════════════════════════════════════════════════════════════ */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgot} className="space-y-4">
                {!successMsg && (
                  <>
                    <p className="text-xs leading-relaxed"
                       style={{ color: 'rgba(245,240,232,0.45)', fontFamily: 'Crimson Text,serif' }}>
                      Enter the email linked to your account. We'll send a reset link valid for 30 minutes.
                    </p>
                    <Field label="Email Address" icon="📜" placeholder="your@email.com"
                      value={email} onChange={setEmail} type="email" autoComplete="email" />
                    <button type="submit" disabled={loading} className="btn-gold w-full py-4 text-base"
                      style={{ opacity: loading ? 0.7 : 1 }}>
                      {loading ? '⏳ Sending…' : '📨 Send Reset Link'}
                    </button>
                  </>
                )}
                <button type="button" onClick={() => switchMode('login-email')}
                  className="btn-ghost w-full py-2.5 text-sm">
                  ← Back to Sign In
                </button>
              </form>
            )}

            {/* ════════════════════════════════════════════════════════════
                FORM: Reset Password (from email link)
            ════════════════════════════════════════════════════════════ */}
            {mode === 'reset' && (
              <form onSubmit={handleReset} className="space-y-4">
                {!successMsg && (
                  <>
                    <p className="text-xs leading-relaxed"
                       style={{ color: 'rgba(245,240,232,0.45)', fontFamily: 'Crimson Text,serif' }}>
                      Choose a new password for your account.
                    </p>
                    <Field label="New Password" icon="🔒" placeholder="Min 6 characters"
                      value={password} onChange={setPassword} type="password" autoComplete="new-password" />
                    <Field label="Confirm Password" icon="🔐" placeholder="Repeat new password"
                      value={confirmPw} onChange={setConfirmPw} type="password" autoComplete="new-password" />
                    <button type="submit" disabled={loading} className="btn-gold w-full py-4 text-base"
                      style={{ opacity: loading ? 0.7 : 1 }}>
                      {loading ? '⏳ Saving…' : '🔑 Set New Password'}
                    </button>
                  </>
                )}
                {successMsg && (
                  <button type="button" onClick={() => switchMode('login-email')}
                    className="btn-gold w-full py-3 text-sm">
                    ⚔ Go to Sign In
                  </button>
                )}
              </form>
            )}

          </div>{/* end p-7 */}

          <div className="h-px"
               style={{ background: 'linear-gradient(90deg,transparent,rgba(212,168,67,0.3),transparent)' }} />
        </div>

        {/* ── Guest note ────────────────────────────────────────────────── */}
        <p className="text-center text-xs mt-4"
           style={{ color: 'rgba(212,168,67,0.25)', fontFamily: 'Cinzel,serif', letterSpacing: '0.08em' }}>
          ✦ Your victories and rank are bound to your account ✦
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

// ── Reusable text field ───────────────────────────────────────────────────
interface FieldProps {
  label: string; icon: string; placeholder: string
  value: string; onChange: (v: string) => void
  type?: string; autoComplete?: string
}
function Field({ label, icon, placeholder, value, onChange, type = 'text', autoComplete }: FieldProps) {
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
        <input type={type} value={value} placeholder={placeholder} autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'rgba(26,12,6,0.7)', border: '1px solid rgba(212,168,67,0.25)',
                   color: '#f5f0e8', fontFamily: 'Cinzel,serif' }}
          onFocus={e => (e.target.style.borderColor = 'rgba(212,168,67,0.55)')}
          onBlur={e  => (e.target.style.borderColor = 'rgba(212,168,67,0.25)')}
        />
      </div>
    </div>
  )
}

// ── 6-box OTP input ───────────────────────────────────────────────────────
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) inputs.current[i - 1]?.focus()
  }

  const handleChange = (i: number, ch: string) => {
    const digit = ch.replace(/\D/g, '').slice(-1)
    const arr   = value.split('').slice(0, 6)
    arr[i]      = digit
    const next  = arr.join('').slice(0, 6)
    onChange(next)
    if (digit && i < 5) inputs.current[i + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) { onChange(pasted); inputs.current[Math.min(pasted.length, 5)]?.focus() }
    e.preventDefault()
  }

  return (
    <div>
      <label className="block text-xs tracking-[0.15em] uppercase mb-3"
             style={{ color: 'rgba(212,168,67,0.6)', fontFamily: 'Cinzel,serif' }}>
        6-Digit OTP
      </label>
      <div className="flex gap-2 justify-center">
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            ref={el => { inputs.current[i] = el }}
            type="text" inputMode="numeric" maxLength={1}
            value={value[i] ?? ''}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKey(i, e)}
            onPaste={handlePaste}
            className="w-11 h-12 text-center text-lg font-bold rounded-lg outline-none transition-all"
            style={{
              background: 'rgba(26,12,6,0.8)',
              border: value[i] ? '1px solid rgba(212,168,67,0.6)' : '1px solid rgba(212,168,67,0.2)',
              color: '#fde68a',
              fontFamily: 'Cinzel Decorative, serif',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Avatar picker ─────────────────────────────────────────────────────────
interface AvatarPickerProps {
  avatar: string; setAvatar: (a: string) => void
  showAvatars: boolean; setShowAvatars: (v: boolean) => void
}
function AvatarPicker({ avatar, setAvatar, showAvatars, setShowAvatars }: AvatarPickerProps) {
  return (
    <div>
      <label className="block text-xs tracking-[0.15em] uppercase mb-2"
             style={{ color: 'rgba(212,168,67,0.6)', fontFamily: 'Cinzel,serif' }}>
        Choose Your Emblem
      </label>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setShowAvatars(!showAvatars)}
          className="w-14 h-14 rounded-xl text-3xl flex items-center justify-center"
          style={{ background: 'rgba(26,12,6,0.8)', border: '1px solid rgba(212,168,67,0.4)' }}>
          {avatar}
        </button>
        <span className="text-xs" style={{ color: 'rgba(212,168,67,0.45)', fontFamily: 'Crimson Text,serif' }}>
          Click to choose your emblem
        </span>
      </div>
      {showAvatars && (
        <div className="mt-2 grid grid-cols-6 gap-2 p-3 rounded-xl"
             style={{ background: 'rgba(26,12,6,0.9)', border: '1px solid rgba(212,168,67,0.2)' }}>
          {AVATARS.map(a => (
            <button key={a} type="button"
              onClick={() => { setAvatar(a); setShowAvatars(false) }}
              className="text-2xl w-10 h-10 rounded-lg flex items-center justify-center transition-all"
              style={{
                background: avatar === a ? 'rgba(212,168,67,0.2)' : 'transparent',
                border:     avatar === a ? '1px solid rgba(212,168,67,0.5)' : '1px solid transparent',
              }}>
              {a}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function normaliseMobile(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, '')
  if (!/^\+?[\d]{7,15}$/.test(digits)) return null
  return digits.startsWith('+') ? digits : '+' + digits
}

function parseResetHash(): { uid: number; token: string } | null {
  try {
    const hash = window.location.hash // e.g. #reset?token=abc&uid=5
    if (!hash.startsWith('#reset')) return null
    const qs    = new URLSearchParams(hash.replace('#reset?', '').replace('#reset', ''))
    const token = qs.get('token')
    const uid   = parseInt(qs.get('uid') ?? '0', 10)
    if (!token || !uid) return null
    return { uid, token }
  } catch { return null }
}

// Need useRef import for OtpInput — already imported at top

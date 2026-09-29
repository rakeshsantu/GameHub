import { useState, useCallback } from 'react'
import { AuthSession, Player, GameRanking, GameResultRecord } from '../types'
import { loadGuestSession, clearGuestSession, GuestSession } from './useGuestSession'

// ─── API base URL ─────────────────────────────────────────────────────────
const API = import.meta.env?.VITE_API_URL ?? '/api'

// ─── Persistence ──────────────────────────────────────────────────────────
const SESSION_KEY = 'gh_auth_session'

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthSession) : null
  } catch { return null }
}
function saveSession(s: AuthSession | null): void {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else    localStorage.removeItem(SESSION_KEY)
  } catch {}
}

// ─── Fetch helper ─────────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res  = await fetch(`${API}${path}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`)
  return data as T
}

// ─── Public types ─────────────────────────────────────────────────────────
export interface MergeResult {
  merged:      number
  pointsDelta: number
  player:      Player
}

export interface OtpState {
  sent:         boolean
  resendAfter:  number   // seconds countdown
  verifiedToken: string  // filled after verify_otp succeeds
}

// ─── Hook ─────────────────────────────────────────────────────────────────
export function useAuth() {
  const [session,     setSession]     = useState<AuthSession | null>(loadSession)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null)
  const [otpState,    setOtpState]    = useState<OtpState>({
    sent: false, resendAfter: 0, verifiedToken: '',
  })

  const persist = (s: AuthSession | null) => { saveSession(s); setSession(s) }

  // ── Guest merge ───────────────────────────────────────────────────────────
  const attemptGuestMerge = useCallback(async (token: string): Promise<MergeResult | null> => {
    const guest: GuestSession = loadGuestSession()
    if (guest.games_played === 0) return null
    try {
      const data = await apiFetch<MergeResult & { success: boolean }>(
        '/merge_guest.php',
        { method: 'POST', body: JSON.stringify({ guest }) },
        token
      )
      if (data.success && data.merged > 0) {
        clearGuestSession()
        return { merged: data.merged, pointsDelta: data.pointsDelta, player: data.player }
      }
    } catch (e) { console.warn('Guest merge failed (non-fatal):', e) }
    return null
  }, [])

  // ── Register ──────────────────────────────────────────────────────────────
  const register = useCallback(async (
    username: string,
    email: string,
    password: string,
    avatar = '👤',
    mobile?: string,
    otpVerifiedToken?: string
  ): Promise<boolean> => {
    setLoading(true); setError(null); setMergeResult(null)
    try {
      const body = mobile && otpVerifiedToken
        ? { username, mobile, avatar, otp_verified_token: otpVerifiedToken }
        : { username, email, password, avatar }
      const data = await apiFetch<AuthSession>('/register.php', {
        method: 'POST', body: JSON.stringify(body),
      })
      const merge = await attemptGuestMerge(data.token)
      if (merge) { data.player = merge.player; setMergeResult(merge) }
      persist(data)
      return true
    } catch (e) { setError((e as Error).message); return false }
    finally { setLoading(false) }
  }, [attemptGuestMerge])

  // ── Login — email/username + password ────────────────────────────────────
  const login = useCallback(async (loginId: string, password: string): Promise<boolean> => {
    setLoading(true); setError(null); setMergeResult(null)
    try {
      const data = await apiFetch<AuthSession>('/login.php', {
        method: 'POST', body: JSON.stringify({ login: loginId, password }),
      })
      const merge = await attemptGuestMerge(data.token)
      if (merge) { data.player = merge.player; setMergeResult(merge) }
      persist(data)
      return true
    } catch (e) { setError((e as Error).message); return false }
    finally { setLoading(false) }
  }, [attemptGuestMerge])

  // ── Login — mobile OTP (after OTP verified) ──────────────────────────────
  const loginWithOtp = useCallback(async (
    mobile: string,
    otpVerifiedToken: string
  ): Promise<boolean> => {
    setLoading(true); setError(null); setMergeResult(null)
    try {
      const data = await apiFetch<AuthSession>('/login.php', {
        method: 'POST',
        body: JSON.stringify({ mobile, otp_verified_token: otpVerifiedToken }),
      })
      const merge = await attemptGuestMerge(data.token)
      if (merge) { data.player = merge.player; setMergeResult(merge) }
      persist(data)
      return true
    } catch (e) { setError((e as Error).message); return false }
    finally { setLoading(false) }
  }, [attemptGuestMerge])

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const sendOtp = useCallback(async (
    identifier: string,
    purpose: 'login' | 'register'
  ): Promise<boolean> => {
    setLoading(true); setError(null)
    try {
      const data = await apiFetch<{
        success: boolean; message: string; resend_after: number
      }>('/send_otp.php', {
        method: 'POST', body: JSON.stringify({ identifier, purpose }),
      })
      if (!data.success) { setError(data.message); return false }
      setOtpState({ sent: true, resendAfter: data.resend_after ?? 60, verifiedToken: '' })
      return true
    } catch (e) { setError((e as Error).message); return false }
    finally { setLoading(false) }
  }, [])

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const verifyOtp = useCallback(async (
    identifier: string,
    otp: string,
    purpose: 'login' | 'register'
  ): Promise<string | null> => {   // returns verifiedToken or null
    setLoading(true); setError(null)
    try {
      const data = await apiFetch<{ success: boolean; otp_verified_token: string }>('/verify_otp.php', {
        method: 'POST', body: JSON.stringify({ identifier, otp, purpose }),
      })
      setOtpState(prev => ({ ...prev, verifiedToken: data.otp_verified_token }))
      return data.otp_verified_token
    } catch (e) { setError((e as Error).message); return null }
    finally { setLoading(false) }
  }, [])

  // ── Forgot password ───────────────────────────────────────────────────────
  const forgotPassword = useCallback(async (email: string): Promise<boolean> => {
    setLoading(true); setError(null)
    try {
      await apiFetch<{ success: boolean }>('/forgot_password.php', {
        method: 'POST', body: JSON.stringify({ email }),
      })
      return true
    } catch (e) { setError((e as Error).message); return false }
    finally { setLoading(false) }
  }, [])

  // ── Reset password (from email link) ─────────────────────────────────────
  const resetPassword = useCallback(async (
    uid: number,
    token: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<boolean> => {
    setLoading(true); setError(null)
    try {
      await apiFetch<{ success: boolean }>('/reset_password.php', {
        method: 'POST',
        body: JSON.stringify({ uid, token, new_password: newPassword, confirm_password: confirmPassword }),
      })
      return true
    } catch (e) { setError((e as Error).message); return false }
    finally { setLoading(false) }
  }, [])

  // ── Change password (while logged in) ────────────────────────────────────
  const changePassword = useCallback(async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<boolean> => {
    if (!session?.token) return false
    setLoading(true); setError(null)
    try {
      await apiFetch<{ success: boolean }>('/change_password.php', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password:     newPassword,
          confirm_password: confirmPassword,
        }),
      }, session.token)
      return true
    } catch (e) { setError((e as Error).message); return false }
    finally { setLoading(false) }
  }, [session])

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async (): Promise<void> => {
    if (session?.token) {
      try { await apiFetch('/logout.php', { method: 'POST' }, session.token) } catch {}
    }
    setMergeResult(null)
    setOtpState({ sent: false, resendAfter: 0, verifiedToken: '' })
    persist(null)
  }, [session])

  // ── Refresh profile ───────────────────────────────────────────────────────
  const refreshProfile = useCallback(async (): Promise<{
    player: Player; gameRankings: GameRanking[]; recentResults: GameResultRecord[]
  } | null> => {
    if (!session?.token) return null
    setLoading(true); setError(null)
    try {
      const data = await apiFetch<{
        player: Player; gameRankings: GameRanking[]; recentResults: GameResultRecord[]
      }>('/me.php', { method: 'GET' }, session.token)
      persist({ ...session, player: data.player })
      return data
    } catch (e) { setError((e as Error).message); return null }
    finally { setLoading(false) }
  }, [session])

  // ── Save game result ──────────────────────────────────────────────────────
  const saveResult = useCallback(async (payload: {
    gameId: string; gameTitle: string; won: boolean; isDraw?: boolean
    score: number; difficulty: string; opponent: string; mode: string
  }): Promise<{ pointsDelta: number; outcome: 'win' | 'loss' | 'draw'; player: Player } | null> => {
    if (!session?.token) return null
    try {
      const data = await apiFetch<{
        pointsDelta: number; outcome: 'win' | 'loss' | 'draw'; player: Player; success: boolean
      }>('/save_result.php', { method: 'POST', body: JSON.stringify(payload) }, session.token)
      persist({ ...session, player: { ...session.player, ...data.player } })
      return data
    } catch (e) { console.error('Failed to save result:', e); return null }
  }, [session])

  const clearMergeResult = useCallback(() => setMergeResult(null), [])
  const resetOtpState    = useCallback(() =>
    setOtpState({ sent: false, resendAfter: 0, verifiedToken: '' }), [])

  return {
    // State
    session,
    player:      session?.player ?? null,
    token:       session?.token  ?? null,
    isLoggedIn:  !!session,
    loading,
    error,
    setError,
    mergeResult,
    clearMergeResult,
    otpState,
    resetOtpState,
    // Auth actions
    register,
    login,
    loginWithOtp,
    logout,
    // OTP
    sendOtp,
    verifyOtp,
    // Password
    forgotPassword,
    resetPassword,
    changePassword,
    // Profile
    refreshProfile,
    saveResult,
    apiFetch: <T>(path: string, opts?: RequestInit) =>
      apiFetch<T>(path, opts ?? {}, session?.token),
  }
}

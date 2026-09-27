/**
 * useGuestSession
 * ───────────────
 * Tracks points, rank and per-game results for unauthenticated (guest) players
 * entirely in localStorage under the key  gh_guest_session .
 *
 * Behaviour
 * ─────────
 * • Points are earned / deducted exactly like logged-in players (same formula).
 * • On login or register the caller passes the guest data to merge_guest.php,
 *   which folds it into the real account.  The guest session is then wiped.
 * • If the user never logs in, the session persists across page reloads for the
 *   lifetime of localStorage (no expiry — it IS their "account").
 */

import { useState, useCallback } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────
export interface GuestGameRecord {
  gameId:     string
  gameTitle:  string
  won:        boolean
  isDraw:     boolean
  score:      number
  difficulty: string
  opponent:   string
  mode:       string
  delta:      number      // points change (positive = earned, negative = deducted)
  playedAt:   string      // ISO date string
}

export interface GuestSession {
  guestId:      string                        // random ID for this guest
  total_points: number
  games_played: number
  games_won:    number
  rank_title:   string
  results:      GuestGameRecord[]             // full history, max 50
}

// ─── Rank thresholds (mirror server) ───────────────────────────────────────
function calcRank(pts: number): string {
  if (pts >= 2000) return 'Grand Master'
  if (pts >= 1000) return 'Master'
  if (pts >= 500)  return 'Champion'
  if (pts >= 200)  return 'Scholar'
  if (pts >= 50)   return 'Apprentice'
  return 'Novice'
}

// ─── Point formula (mirror server) ─────────────────────────────────────────
const GAME_BASE: Record<string, number> = {
  tictactoe:    10,
  kaanadua:     10,
  snakeladders: 10,
  carrom:       20,
  kaangichalla: 20,
  taayam:       20,
  chowkabara:   20,
  chess:        40,
  ludo:         40,
  kattamane:    40,
  sudoku:       15,
}

export function calcGuestDelta(
  gameId:     string,
  won:        boolean,
  isDraw:     boolean,
  difficulty: string,
  mode:       string
): number {
  if (isDraw) return 0
  const base      = GAME_BASE[gameId] ?? 15
  const diffMult  = difficulty === 'hard' ? 2.5 : difficulty === 'medium' ? 1.5 : 1.0
  const modeMult  = mode === 'multiplayer' ? 2.0 : 1.0
  const raw       = Math.round(base * diffMult * modeMult)
  return won ? raw : -Math.round(raw * 0.5)
}

// ─── Storage helpers ────────────────────────────────────────────────────────
const GUEST_KEY = 'gh_guest_session'

function makeGuestId(): string {
  return 'guest_' + Math.random().toString(36).slice(2, 10)
}

function load(): GuestSession {
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    if (raw) return JSON.parse(raw) as GuestSession
  } catch {}
  return {
    guestId:      makeGuestId(),
    total_points: 0,
    games_played: 0,
    games_won:    0,
    rank_title:   'Novice',
    results:      [],
  }
}

function save(s: GuestSession): void {
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(s)) } catch {}
}

export function clearGuestSession(): void {
  try { localStorage.removeItem(GUEST_KEY) } catch {}
}

export function loadGuestSession(): GuestSession {
  return load()
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useGuestSession() {
  const [session, setSession] = useState<GuestSession>(load)

  const persist = (s: GuestSession) => { save(s); setSession(s) }

  /**
   * Record a game result and update running totals.
   * Returns the delta (points change) so the caller can show a toast.
   */
  const recordResult = useCallback((
    gameId:     string,
    gameTitle:  string,
    won:        boolean,
    isDraw:     boolean,
    score:      number,
    difficulty: string,
    opponent:   string,
    mode:       string
  ): number => {
    const delta = calcGuestDelta(gameId, won, isDraw, difficulty, mode)

    setSession(prev => {
      const newPts  = Math.max(0, prev.total_points + delta)
      const record: GuestGameRecord = {
        gameId, gameTitle, won, isDraw, score, difficulty, opponent, mode,
        delta,
        playedAt: new Date().toISOString(),
      }
      const next: GuestSession = {
        ...prev,
        total_points: newPts,
        games_played: prev.games_played + 1,
        games_won:    prev.games_won + (won ? 1 : 0),
        rank_title:   calcRank(newPts),
        // Keep last 50 results
        results: [record, ...prev.results].slice(0, 50),
      }
      save(next)
      return next
    })

    return delta
  }, [])

  /** Wipe the guest session (called after successful merge) */
  const clear = useCallback(() => {
    const fresh: GuestSession = {
      guestId:      makeGuestId(),
      total_points: 0,
      games_played: 0,
      games_won:    0,
      rank_title:   'Novice',
      results:      [],
    }
    persist(fresh)
  }, [])

  return {
    guest: session,
    hasGuestData: session.games_played > 0,
    recordResult,
    clear,
  }
}

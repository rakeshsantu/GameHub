// ─── Existing types ────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard'
export type GameMode   = 'vs-bot' | 'multiplayer'

export interface GameConfig {
  mode:       GameMode
  difficulty: Difficulty
  players:    string[]
}

export interface GameInfo {
  id:          string
  title:       string
  emoji:       string
  description: string
  category:    'classic' | 'indian' | 'puzzle'
  players:     string          // e.g. "2" or "2-4"
  hasBot:      boolean
  color:       string          // tailwind gradient classes
  bgPattern:   string
}

export interface LeaderboardEntry {
  name:       string
  game:       string
  score:      number
  difficulty: Difficulty
  date:       string
}

// ─── Auth & Player types ───────────────────────────────────────────────────

export interface Player {
  id:           number
  username:     string
  email:        string
  avatar:       string
  total_points: number
  games_played: number
  games_won:    number
  rank_title:   RankTitle
  is_online:    number
  overall_rank?: number
  created_at?:  string
}

export type RankTitle =
  | 'Novice'
  | 'Apprentice'
  | 'Scholar'
  | 'Champion'
  | 'Master'
  | 'Grand Master'

export interface GameRanking {
  game_id:      string
  game_title:   string
  total_played: number
  total_won:    number
  best_score:   number
  total_points: number
  game_rank:    number
}

export interface GameResultRecord {
  game_id:    string
  game_title: string
  won:        number
  score:      number
  difficulty: string
  opponent:   string
  mode:       string
  played_at:  string
}

export interface PlayerProfile {
  player:        Player
  gameRankings:  GameRanking[]
  recentResults: GameResultRecord[]
}

export interface AuthSession {
  token:  string
  player: Player
}

// ─── Matchmaking types ─────────────────────────────────────────────────────

export type MatchStatus = 'idle' | 'waiting' | 'matched' | 'already_matched' | 'left'

export interface MatchOpponent {
  id?:    number
  name:   string
  avatar: string
  points: number
  rank:   string
}

export interface MatchResult {
  status:   MatchStatus
  matchId?: number
  isBot?:   boolean
  opponent?: MatchOpponent | null
  waited?:  number
}

// ─── Global Rankings ──────────────────────────────────────────────────────

export interface GlobalRankEntry {
  id:           number
  username:     string
  avatar:       string
  total_points: number
  games_played: number
  games_won:    number
  rank_title:   RankTitle
  rank:         number
}

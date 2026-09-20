export type Difficulty = 'easy' | 'medium' | 'hard'
export type GameMode  = 'vs-bot' | 'multiplayer'

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
  name:      string
  game:      string
  score:     number
  difficulty: Difficulty
  date:      string
}

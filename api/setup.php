<?php
/**
 * setup.php  —  Run ONCE to create all GameHub tables.
 * Visit: https://yourdomain.com/api/setup.php
 * DELETE this file after first run!
 *
 * Safe to re-run — all CREATE TABLE statements use IF NOT EXISTS,
 * and ALTER TABLE statements are wrapped in error-ignore logic.
 */
require_once 'config.php';
$db = getDB();

$tables = [

// ── Players ──────────────────────────────────────────────────────────────
"CREATE TABLE IF NOT EXISTS players (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(30)   NOT NULL UNIQUE,
    email         VARCHAR(120)  NOT NULL UNIQUE,
    mobile        VARCHAR(15)   NULL UNIQUE,          -- E.164 e.g. +919876543210
    password_hash VARCHAR(255)  NOT NULL DEFAULT '',  -- empty when mobile-only account
    avatar        VARCHAR(10)   NOT NULL DEFAULT '👤',
    total_points  INT UNSIGNED  NOT NULL DEFAULT 0,
    games_played  INT UNSIGNED  NOT NULL DEFAULT 0,
    games_won     INT UNSIGNED  NOT NULL DEFAULT 0,
    rank_title    VARCHAR(40)   NOT NULL DEFAULT 'Novice',
    is_online     TINYINT(1)    NOT NULL DEFAULT 0,
    last_seen     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

// ── Game Results ─────────────────────────────────────────────────────────
"CREATE TABLE IF NOT EXISTS game_results (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    player_id  INT UNSIGNED NOT NULL,
    game_id    VARCHAR(30)  NOT NULL,
    game_title VARCHAR(60)  NOT NULL,
    won        TINYINT(1)   NOT NULL DEFAULT 0,
    score      INT          NOT NULL DEFAULT 0,
    difficulty VARCHAR(10)  NOT NULL DEFAULT 'medium',
    opponent   VARCHAR(30)  NOT NULL DEFAULT 'Bot',
    mode       VARCHAR(20)  NOT NULL DEFAULT 'vs-bot',
    played_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

// ── Per-Game Rankings ─────────────────────────────────────────────────────
"CREATE TABLE IF NOT EXISTS game_rankings (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    player_id    INT UNSIGNED NOT NULL,
    game_id      VARCHAR(30)  NOT NULL,
    game_title   VARCHAR(60)  NOT NULL,
    total_played INT UNSIGNED NOT NULL DEFAULT 0,
    total_won    INT UNSIGNED NOT NULL DEFAULT 0,
    best_score   INT          NOT NULL DEFAULT 0,
    total_points INT UNSIGNED NOT NULL DEFAULT 0,
    UNIQUE KEY uq_player_game (player_id, game_id),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

// ── Matchmaking Queue ─────────────────────────────────────────────────────
"CREATE TABLE IF NOT EXISTS match_queue (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    player_id  INT UNSIGNED NOT NULL UNIQUE,
    game_id    VARCHAR(30)  NOT NULL,
    points     INT UNSIGNED NOT NULL DEFAULT 0,
    rank_title VARCHAR(40)  NOT NULL DEFAULT 'Novice',
    joined_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

// ── Active Matches ────────────────────────────────────────────────────────
"CREATE TABLE IF NOT EXISTS active_matches (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    game_id     VARCHAR(30)  NOT NULL,
    player1_id  INT UNSIGNED NOT NULL,
    player2_id  INT UNSIGNED,
    is_bot      TINYINT(1)   NOT NULL DEFAULT 0,
    status      ENUM('waiting','active','finished') NOT NULL DEFAULT 'waiting',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

// ── OTP Tokens (mobile login + email OTP) ─────────────────────────────────
// one active OTP per identifier at a time (UNIQUE on identifier)
"CREATE TABLE IF NOT EXISTS otp_tokens (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(120) NOT NULL,               -- mobile or email
    otp_hash   VARCHAR(255) NOT NULL,               -- bcrypt of the 6-digit OTP
    purpose    ENUM('login','register') NOT NULL DEFAULT 'login',
    attempts   TINYINT UNSIGNED NOT NULL DEFAULT 0, -- max 5 wrong attempts
    expires_at DATETIME     NOT NULL,               -- 10 min TTL
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_identifier (identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

// ── Password Reset Tokens ─────────────────────────────────────────────────
"CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    player_id  INT UNSIGNED NOT NULL,
    token_hash VARCHAR(255) NOT NULL,               -- SHA-256 of the random token
    expires_at DATETIME     NOT NULL,               -- 30 min TTL
    used       TINYINT(1)   NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
];

$errors = [];
foreach ($tables as $sql) {
    if (!$db->query($sql)) {
        $errors[] = $db->error;
    }
}

// ── ALTER existing players table if columns missing (for re-runs) ─────────
$alters = [
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS mobile VARCHAR(15) NULL UNIQUE AFTER email",
];
foreach ($alters as $sql) {
    $db->query($sql); // ignore errors — column may already exist
}

if (empty($errors)) {
    respond(['success' => true, 'message' => 'All tables ready. DELETE this file now!']);
} else {
    respond(['success' => false, 'errors' => $errors], 500);
}

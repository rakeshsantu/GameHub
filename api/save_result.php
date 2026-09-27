<?php
/**
 * POST /api/save_result.php
 * Header: Authorization: Bearer <token>
 * Body: { gameId, gameTitle, won, score, difficulty, opponent, mode }
 *
 * ══════════════════════════════════════════════════════════════════
 *  POINT SYSTEM
 * ══════════════════════════════════════════════════════════════════
 *
 *  Each game has a BASE_POINTS value reflecting its complexity.
 *  That base is then multiplied by a DIFFICULTY multiplier,
 *  and by a MODE multiplier (PvP is worth more than Bot).
 *
 *  WIN  → +base × diff_mult × mode_mult   (always positive)
 *  LOSS → −base × diff_mult × mode_mult × 0.5  (half the win value, deducted)
 *  DRAW →  0   (no change — honours the tie)
 *
 *  Points can never go below 0.
 *
 * ──────────────────────────────────────────────────────────────────
 *  GAME BASE POINTS (complexity tier)
 * ──────────────────────────────────────────────────────────────────
 *  Tier 1 — Simple / luck-based (10)
 *      Tic-Tac-Toe, Kaana Dua, Snake & Ladders
 *
 *  Tier 2 — Moderate strategy (20)
 *      Carrom, Kaangi Challa, Taayam, Chowka Bara
 *
 *  Tier 3 — Deep strategy / skill (40)
 *      Chess, Ludo, Katta Mane (Pallanguzhi)
 *
 *  Tier 4 — Solo puzzle (15)
 *      Sudoku — win only, no opponent loss possible
 *
 * ──────────────────────────────────────────────────────────────────
 *  DIFFICULTY MULTIPLIERS
 * ──────────────────────────────────────────────────────────────────
 *  easy   → ×1.0
 *  medium → ×1.5
 *  hard   → ×2.5
 *
 * ──────────────────────────────────────────────────────────────────
 *  MODE MULTIPLIERS
 * ──────────────────────────────────────────────────────────────────
 *  vs-bot      → ×1.0
 *  multiplayer → ×2.0   (real human, higher stakes)
 *
 * ──────────────────────────────────────────────────────────────────
 *  WORKED EXAMPLES
 * ──────────────────────────────────────────────────────────────────
 *  Chess Win  vs Bot  Hard        = 40 × 2.5 × 1.0 = +100 pts
 *  Chess Loss vs Bot  Hard        = 40 × 2.5 × 1.0 × 0.5 = −50 pts
 *  Chess Win  vs Human Medium     = 40 × 1.5 × 2.0 = +120 pts
 *  Chess Loss vs Human Medium     = 40 × 1.5 × 2.0 × 0.5 = −60 pts
 *  Tic-Tac-Toe Win vs Bot Easy    = 10 × 1.0 × 1.0 = +10 pts
 *  Tic-Tac-Toe Loss vs Bot Easy   = 10 × 1.0 × 1.0 × 0.5 = −5 pts
 *  Carrom Win vs Human Hard       = 20 × 2.5 × 2.0 = +100 pts
 *  Sudoku Win Hard                = 15 × 2.5 × 1.0 = +37 pts
 *  Draw (any)                     = 0 pts
 * ══════════════════════════════════════════════════════════════════
 */
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Method not allowed', 405);

$uid  = requireAuth();
$body = getBody();

$gameId    = trim($body['gameId']    ?? '');
$gameTitle = trim($body['gameTitle'] ?? '');
$won       = (bool) ($body['won']       ?? false);
$isDraw    = (bool) ($body['isDraw']    ?? false);
$score     = (int)  ($body['score']     ?? 0);
$difficulty= trim($body['difficulty'] ?? 'medium');
$opponent  = trim($body['opponent']   ?? 'Bot');
$mode      = trim($body['mode']       ?? 'vs-bot');

if (!$gameId || !$gameTitle) respondError('gameId and gameTitle are required.');

// ── Game complexity base points ───────────────────────────────────────────
$gameBase = [
    // Tier 1 — Simple
    'tictactoe'   => 10,
    'kaanadua'    => 10,
    'snakeladders'=> 10,
    // Tier 2 — Moderate
    'carrom'      => 20,
    'kaangichalla'=> 20,
    'taayam'      => 20,
    'chowkabara'  => 20,
    // Tier 3 — Deep strategy
    'chess'       => 40,
    'ludo'        => 40,
    'kattamane'   => 40,
    // Tier 4 — Solo puzzle
    'sudoku'      => 15,
];
$base = $gameBase[$gameId] ?? 15; // fallback for unknown games

// ── Difficulty multiplier ─────────────────────────────────────────────────
$diffMult = match($difficulty) {
    'easy'   => 1.0,
    'medium' => 1.5,
    'hard'   => 2.5,
    default  => 1.0,
};

// ── Mode multiplier ───────────────────────────────────────────────────────
$modeMult = ($mode === 'multiplayer') ? 2.0 : 1.0;

// ── Calculate delta ───────────────────────────────────────────────────────
if ($isDraw) {
    $delta       = 0;   // Draw → no change
    $isDeduction = false;
} elseif ($won) {
    $delta       = (int) round($base * $diffMult * $modeMult);
    $isDeduction = false;
} else {
    // Loss → deduct half the win value, floor at 0 later
    $delta       = (int) round($base * $diffMult * $modeMult * 0.5);
    $isDeduction = true;
}

$db = getDB();

// ── Fetch current player points (to enforce floor of 0) ──────────────────
$curStmt = $db->prepare('SELECT total_points FROM players WHERE id = ?');
$curStmt->bind_param('i', $uid);
$curStmt->execute();
$curRow = $curStmt->get_result()->fetch_assoc();
$curStmt->close();
$currentPts = (int) ($curRow['total_points'] ?? 0);

// Clamp: can't go below 0
if ($isDeduction && $delta > $currentPts) {
    $delta = $currentPts; // lose only what you have
}

$wonInt = $won ? 1 : 0;

// ── Insert game result ────────────────────────────────────────────────────
$drawInt = $isDraw ? 1 : 0;
$ins = $db->prepare(
    'INSERT INTO game_results (player_id, game_id, game_title, won, score, difficulty, opponent, mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
$ins->bind_param('issiisss', $uid, $gameId, $gameTitle, $wonInt, $score, $difficulty, $opponent, $mode);
if (!$ins->execute()) respondError('Failed to save result: ' . $ins->error, 500);
$ins->close();

// ── Update player totals ──────────────────────────────────────────────────
// Use signed arithmetic: positive delta for win, negative for loss
$signedDelta = $isDeduction ? -$delta : $delta;

$upd = $db->prepare(
    'UPDATE players
     SET total_points = GREATEST(0, total_points + ?),
         games_played = games_played + 1,
         games_won    = games_won + ?,
         rank_title   = CASE
             WHEN GREATEST(0, total_points + ?) >= 2000 THEN "Grand Master"
             WHEN GREATEST(0, total_points + ?) >= 1000 THEN "Master"
             WHEN GREATEST(0, total_points + ?) >= 500  THEN "Champion"
             WHEN GREATEST(0, total_points + ?) >= 200  THEN "Scholar"
             WHEN GREATEST(0, total_points + ?) >= 50   THEN "Apprentice"
             ELSE "Novice"
         END
     WHERE id = ?'
);
$upd->bind_param('iiiiiiii',
    $signedDelta,
    $wonInt,
    $signedDelta, $signedDelta, $signedDelta, $signedDelta, $signedDelta,
    $uid
);
$upd->execute();
$upd->close();

// ── Upsert per-game ranking ───────────────────────────────────────────────
// Per-game points also use signed delta (can go negative per game too, floor 0)
$db->query(
    "INSERT INTO game_rankings (player_id, game_id, game_title, total_played, total_won, best_score, total_points)
     VALUES ($uid, '$gameId', '$gameTitle', 1, $wonInt, $score, GREATEST(0, $signedDelta))
     ON DUPLICATE KEY UPDATE
         total_played = total_played + 1,
         total_won    = total_won + $wonInt,
         best_score   = GREATEST(best_score, $score),
         total_points = GREATEST(0, total_points + $signedDelta)"
);

// ── Fetch updated player ──────────────────────────────────────────────────
$sel = $db->prepare(
    'SELECT total_points, games_played, games_won, rank_title FROM players WHERE id = ?'
);
$sel->bind_param('i', $uid);
$sel->execute();
$updated = $sel->get_result()->fetch_assoc();
$sel->close();
$db->close();

respond([
    'success'      => true,
    'outcome'      => $isDraw ? 'draw' : ($won ? 'win' : 'loss'),
    'pointsDelta'  => $signedDelta,   // positive = earned, negative = deducted
    'breakdown'    => [
        'base'       => $base,
        'diffMult'   => $diffMult,
        'modeMult'   => $modeMult,
        'lossHalf'   => $isDeduction,
    ],
    'player'       => $updated,
]);

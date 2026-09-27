<?php
/**
 * POST /api/merge_guest.php
 * Header: Authorization: Bearer <token>
 *
 * Body (JSON):
 * {
 *   "guest": {
 *     "total_points": 120,
 *     "games_played": 8,
 *     "games_won":    5,
 *     "results": [
 *       {
 *         "gameId":     "chess",
 *         "gameTitle":  "Chess",
 *         "won":        true,
 *         "isDraw":     false,
 *         "score":      0,
 *         "difficulty": "medium",
 *         "opponent":   "Bot",
 *         "mode":       "vs-bot",
 *         "delta":      60,
 *         "playedAt":   "2026-09-27T10:00:00.000Z"
 *       }, …
 *     ]
 *   }
 * }
 *
 * ── What this does ───────────────────────────────────────────────────────
 *  1. Reads the authenticated player's current state.
 *  2. Inserts every guest game_result row (skips if total_played would exceed
 *     a sanity cap to prevent abuse — max 200 guest results merged at once).
 *  3. Updates the player's total_points, games_played, games_won and rank.
 *  4. Upserts game_rankings for each game touched.
 *  5. Returns the updated player object and a merge summary.
 *
 * ── Safety guards ────────────────────────────────────────────────────────
 *  • Max 200 results per merge call.
 *  • Points delta is RE-COMPUTED server-side from each result's fields —
 *    the client-supplied delta value is IGNORED to prevent tampering.
 *  • total_points can never go below 0.
 * ─────────────────────────────────────────────────────────────────────────
 */
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Method not allowed', 405);

$uid  = requireAuth();
$body = getBody();

$guest = $body['guest'] ?? null;
if (!$guest || !isset($guest['results']) || !is_array($guest['results'])) {
    respond(['success' => true, 'message' => 'No guest data to merge.', 'merged' => 0]);
}

$results = array_slice($guest['results'], 0, 200); // hard cap

// ── Server-side point formula (mirrors save_result.php) ───────────────────
$gameBase = [
    'tictactoe'    => 10,
    'kaanadua'     => 10,
    'snakeladders' => 10,
    'carrom'       => 20,
    'kaangichalla' => 20,
    'taayam'       => 20,
    'chowkabara'   => 20,
    'chess'        => 40,
    'ludo'         => 40,
    'kattamane'    => 40,
    'sudoku'       => 15,
];

function serverDelta(array $r, array $gameBase): int {
    $isDraw = (bool) ($r['isDraw'] ?? false);
    $won    = (bool) ($r['won']    ?? false);
    if ($isDraw) return 0;

    $base      = $gameBase[$r['gameId'] ?? ''] ?? 15;
    $diff      = $r['difficulty'] ?? 'medium';
    $mode      = $r['mode']       ?? 'vs-bot';
    $diffMult  = match($diff) { 'hard' => 2.5, 'medium' => 1.5, default => 1.0 };
    $modeMult  = $mode === 'multiplayer' ? 2.0 : 1.0;
    $raw       = (int) round($base * $diffMult * $modeMult);
    return $won ? $raw : -(int) round($raw * 0.5);
}

$db = getDB();

// ── Fetch current player points ───────────────────────────────────────────
$ps = $db->prepare('SELECT total_points, games_played, games_won FROM players WHERE id = ?');
$ps->bind_param('i', $uid);
$ps->execute();
$cur = $ps->get_result()->fetch_assoc();
$ps->close();
if (!$cur) respondError('Player not found.', 404);

$runningPts   = (int) $cur['total_points'];
$totalMerged  = 0;
$totalDelta   = 0;
$gamesPlayed  = 0;
$gamesWon     = 0;

// ── Process each guest result ─────────────────────────────────────────────
// Per-game accumulators for ranking upsert
$gameAccum = []; // [ gameId => [title, played, won, bestScore, pts] ]

foreach ($results as $r) {
    $gameId    = trim($r['gameId']    ?? '');
    $gameTitle = trim($r['gameTitle'] ?? '');
    $won       = (bool) ($r['won']    ?? false);
    $isDraw    = (bool) ($r['isDraw'] ?? false);
    $score     = (int)  ($r['score']  ?? 0);
    $difficulty= trim($r['difficulty'] ?? 'medium');
    $opponent  = trim($r['opponent']   ?? 'Bot');
    $mode      = trim($r['mode']       ?? 'vs-bot');
    $playedAt  = trim($r['playedAt']   ?? date('Y-m-d H:i:s'));

    if (!$gameId || !$gameTitle) continue;

    // Re-compute delta server-side
    $delta    = serverDelta($r, $gameBase);
    $wonInt   = $won ? 1 : 0;
    $drawInt  = $isDraw ? 1 : 0;

    // Convert ISO date to MySQL datetime
    try {
        $dt = (new DateTime($playedAt))->format('Y-m-d H:i:s');
    } catch (\Exception $e) {
        $dt = date('Y-m-d H:i:s');
    }

    // Insert game result (mark as guest-merged via opponent prefix if needed)
    $ins = $db->prepare(
        'INSERT INTO game_results
            (player_id, game_id, game_title, won, score, difficulty, opponent, mode, played_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $ins->bind_param('issiiisss', $uid, $gameId, $gameTitle, $wonInt, $score, $difficulty, $opponent, $mode, $dt);
    if (!$ins->execute()) { $ins->close(); continue; } // skip bad rows
    $ins->close();

    // Accumulate for ranking upsert
    if (!isset($gameAccum[$gameId])) {
        $gameAccum[$gameId] = [
            'title'  => $gameTitle,
            'played' => 0,
            'won'    => 0,
            'best'   => 0,
            'pts'    => 0,
        ];
    }
    $gameAccum[$gameId]['played']++;
    $gameAccum[$gameId]['won']  += $wonInt;
    $gameAccum[$gameId]['best']  = max($gameAccum[$gameId]['best'], $score);
    $gameAccum[$gameId]['pts']  += $delta;

    $runningPts += $delta;
    if ($runningPts < 0) $runningPts = 0;

    $totalDelta  += $delta;
    $gamesPlayed++;
    $gamesWon    += $wonInt;
    $totalMerged++;
}

// ── Upsert per-game rankings ──────────────────────────────────────────────
foreach ($gameAccum as $gid => $acc) {
    $gTitle = $db->real_escape_string($acc['title']);
    $db->query(
        "INSERT INTO game_rankings (player_id, game_id, game_title, total_played, total_won, best_score, total_points)
         VALUES ($uid, '$gid', '$gTitle', {$acc['played']}, {$acc['won']}, {$acc['best']}, GREATEST(0, {$acc['pts']}))
         ON DUPLICATE KEY UPDATE
             total_played = total_played + {$acc['played']},
             total_won    = total_won    + {$acc['won']},
             best_score   = GREATEST(best_score, {$acc['best']}),
             total_points = GREATEST(0, total_points + {$acc['pts']})"
    );
}

// ── Update player totals ──────────────────────────────────────────────────
$signedDelta = $totalDelta; // already net (wins minus losses)
$upd = $db->prepare(
    'UPDATE players
     SET total_points = GREATEST(0, total_points + ?),
         games_played = games_played + ?,
         games_won    = games_won    + ?,
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
$upd->bind_param('iiiiiiiii',
    $signedDelta,
    $gamesPlayed,
    $gamesWon,
    $signedDelta, $signedDelta, $signedDelta, $signedDelta, $signedDelta,
    $uid
);
$upd->execute();
$upd->close();

// ── Fetch updated player ──────────────────────────────────────────────────
$sel = $db->prepare(
    'SELECT id, username, email, avatar, total_points, games_played, games_won, rank_title
     FROM players WHERE id = ?'
);
$sel->bind_param('i', $uid);
$sel->execute();
$updated = $sel->get_result()->fetch_assoc();
$sel->close();
$db->close();

respond([
    'success'      => true,
    'merged'       => $totalMerged,
    'pointsDelta'  => $totalDelta,
    'player'       => $updated,
]);

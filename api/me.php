<?php
/**
 * GET /api/me.php
 * Header: Authorization: Bearer <token>
 * Returns full player profile + per-game rankings
 */
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') respondError('Method not allowed', 405);

$uid = requireAuth();
$db  = getDB();

// ── Player row ────────────────────────────────────────────────────────────
$stmt = $db->prepare(
    'SELECT id, username, email, avatar, total_points, games_played, games_won, rank_title, is_online, created_at
     FROM players WHERE id = ?'
);
$stmt->bind_param('i', $uid);
$stmt->execute();
$player = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$player) respondError('Player not found.', 404);

// ── Overall rank (by total_points) ────────────────────────────────────────
$rankStmt = $db->prepare(
    'SELECT COUNT(*) + 1 AS overall_rank FROM players WHERE total_points > ?'
);
$pts = (int) $player['total_points'];
$rankStmt->bind_param('i', $pts);
$rankStmt->execute();
$player['overall_rank'] = (int) $rankStmt->get_result()->fetch_assoc()['overall_rank'];
$rankStmt->close();

// ── Per-game rankings ─────────────────────────────────────────────────────
$grStmt = $db->prepare(
    'SELECT gr.game_id, gr.game_title, gr.total_played, gr.total_won, gr.best_score, gr.total_points,
            (SELECT COUNT(*) + 1 FROM game_rankings gr2 WHERE gr2.game_id = gr.game_id AND gr2.total_points > gr.total_points) AS game_rank
     FROM game_rankings gr WHERE gr.player_id = ?
     ORDER BY gr.total_points DESC'
);
$grStmt->bind_param('i', $uid);
$grStmt->execute();
$gameRankings = $grStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$grStmt->close();

// ── Recent results ────────────────────────────────────────────────────────
$resStmt = $db->prepare(
    'SELECT game_id, game_title, won, score, difficulty, opponent, mode, played_at
     FROM game_results WHERE player_id = ? ORDER BY played_at DESC LIMIT 10'
);
$resStmt->bind_param('i', $uid);
$resStmt->execute();
$recentResults = $resStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$resStmt->close();

// Mark still online
$db->query("UPDATE players SET is_online=1, last_seen=NOW() WHERE id=$uid");
$db->close();

respond([
    'player'       => $player,
    'gameRankings' => $gameRankings,
    'recentResults'=> $recentResults,
]);

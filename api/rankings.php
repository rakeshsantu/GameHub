<?php
/**
 * GET /api/rankings.php?game=all|<gameId>&limit=20
 * Public endpoint — no auth required.
 * Returns global or per-game leaderboard.
 */
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') respondError('Method not allowed', 405);

$game  = trim($_GET['game']  ?? 'all');
$limit = min((int) ($_GET['limit'] ?? 20), 100);

$db = getDB();

if ($game === 'all') {
    // ── Global leaderboard ────────────────────────────────────────────────
    $stmt = $db->prepare(
        'SELECT id, username, avatar, total_points, games_played, games_won, rank_title,
                (@rank := @rank + 1) AS rank
         FROM players, (SELECT @rank := 0) r
         ORDER BY total_points DESC LIMIT ?'
    );
    $stmt->bind_param('i', $limit);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    respond(['type' => 'global', 'rankings' => $rows]);
} else {
    // ── Per-game leaderboard ──────────────────────────────────────────────
    $stmt = $db->prepare(
        'SELECT p.id, p.username, p.avatar, p.rank_title,
                gr.game_id, gr.game_title, gr.total_played, gr.total_won, gr.best_score, gr.total_points,
                (@rank := @rank + 1) AS game_rank
         FROM game_rankings gr
         JOIN players p ON p.id = gr.player_id,
         (SELECT @rank := 0) r
         WHERE gr.game_id = ?
         ORDER BY gr.total_points DESC LIMIT ?'
    );
    $stmt->bind_param('si', $game, $limit);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    respond(['type' => 'game', 'game' => $game, 'rankings' => $rows]);
}
$db->close();

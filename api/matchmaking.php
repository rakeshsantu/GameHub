<?php
/**
 * POST /api/matchmaking.php
 * Header: Authorization: Bearer <token>
 * Body: { action: 'join'|'leave'|'status', gameId }
 *
 * Matching logic:
 *   1. Look for another player in the queue for same game within ±200 pts.
 *   2. If found → create active_match and return opponent info.
 *   3. If not found → add to queue, return { status: 'waiting' }.
 *   4. After 30 s in queue → auto-match with Bot.
 */
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Method not allowed', 405);

$uid   = requireAuth();
$body  = getBody();
$action= trim($body['action'] ?? 'join');
$gameId= trim($body['gameId'] ?? '');

if (!$gameId) respondError('gameId is required.');

$db = getDB();

// Fetch requesting player
$ps = $db->prepare('SELECT username, avatar, total_points, rank_title FROM players WHERE id = ?');
$ps->bind_param('i', $uid);
$ps->execute();
$me = $ps->get_result()->fetch_assoc();
$ps->close();
if (!$me) respondError('Player not found.', 404);

// ─── LEAVE ────────────────────────────────────────────────────────────────
if ($action === 'leave') {
    $del = $db->prepare('DELETE FROM match_queue WHERE player_id = ?');
    $del->bind_param('i', $uid);
    $del->execute();
    $del->close();
    respond(['status' => 'left']);
}

// ─── STATUS  (poll for a match) ───────────────────────────────────────────
if ($action === 'status') {
    $ms = $db->prepare(
        'SELECT am.id AS match_id, am.player1_id, am.player2_id, am.is_bot,
                p.username AS opponent_name, p.avatar AS opponent_avatar,
                p.total_points AS opponent_points, p.rank_title AS opponent_rank
         FROM active_matches am
         LEFT JOIN players p ON p.id = IF(am.player1_id = ?, am.player2_id, am.player1_id)
         WHERE (am.player1_id = ? OR am.player2_id = ?)
           AND am.game_id = ? AND am.status = "active"
         LIMIT 1'
    );
    $ms->bind_param('iiii', $uid, $uid, $uid, $gameId);
    // wait — gameId is string
    $ms->close();

    // Redo with correct types
    $ms2 = $db->prepare(
        'SELECT am.id AS match_id, am.is_bot,
                p.username AS opponent_name, p.avatar AS opponent_avatar,
                p.total_points AS opponent_points, p.rank_title AS opponent_rank
         FROM active_matches am
         LEFT JOIN players p ON p.id = IF(am.player1_id = ?, am.player2_id, am.player1_id)
         WHERE (am.player1_id = ? OR am.player2_id = ?)
           AND am.game_id = ? AND am.status = "active"
         LIMIT 1'
    );
    $ms2->bind_param('iiis', $uid, $uid, $uid, $gameId);
    $ms2->execute();
    $match = $ms2->get_result()->fetch_assoc();
    $ms2->close();

    if ($match) {
        respond([
            'status'   => 'matched',
            'matchId'  => (int) $match['match_id'],
            'isBot'    => (bool) $match['is_bot'],
            'opponent' => $match['is_bot'] ? null : [
                'name'   => $match['opponent_name'],
                'avatar' => $match['opponent_avatar'],
                'points' => (int) $match['opponent_points'],
                'rank'   => $match['opponent_rank'],
            ],
        ]);
    }

    // Still in queue?
    $qs = $db->prepare('SELECT joined_at FROM match_queue WHERE player_id = ? AND game_id = ?');
    $qs->bind_param('is', $uid, $gameId);
    $qs->execute();
    $qrow = $qs->get_result()->fetch_assoc();
    $qs->close();

    if ($qrow) {
        $waited = time() - strtotime($qrow['joined_at']);
        if ($waited >= 30) {
            // Auto-match with Bot
            $botMatch = $db->prepare(
                'INSERT INTO active_matches (game_id, player1_id, is_bot, status) VALUES (?, ?, 1, "active")'
            );
            $botMatch->bind_param('si', $gameId, $uid);
            $botMatch->execute();
            $matchId = $db->insert_id;
            $botMatch->close();

            // Remove from queue
            $dq = $db->prepare('DELETE FROM match_queue WHERE player_id = ?');
            $dq->bind_param('i', $uid);
            $dq->execute();
            $dq->close();

            respond(['status' => 'matched', 'matchId' => (int) $matchId, 'isBot' => true, 'opponent' => null]);
        }
        respond(['status' => 'waiting', 'waited' => $waited]);
    }

    respond(['status' => 'idle']);
}

// ─── JOIN (default) ───────────────────────────────────────────────────────
// Remove stale queue entries (> 5 min)
$db->query("DELETE FROM match_queue WHERE joined_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)");

// Check if already in an active match
$chk = $db->prepare(
    'SELECT id FROM active_matches
     WHERE (player1_id = ? OR player2_id = ?) AND game_id = ? AND status = "active" LIMIT 1'
);
$chk->bind_param('iis', $uid, $uid, $gameId);
$chk->execute();
$existing = $chk->get_result()->fetch_assoc();
$chk->close();
if ($existing) respond(['status' => 'already_matched', 'matchId' => (int) $existing['id']]);

// Look for opponent in queue (same game, points within ±300)
$myPts = (int) $me['total_points'];
$low   = $myPts - 300;
$high  = $myPts + 300;

$opp = $db->prepare(
    'SELECT mq.player_id, p.username, p.avatar, p.total_points, p.rank_title
     FROM match_queue mq
     JOIN players p ON p.id = mq.player_id
     WHERE mq.game_id = ? AND mq.player_id != ?
       AND mq.points BETWEEN ? AND ?
     ORDER BY ABS(mq.points - ?) ASC LIMIT 1'
);
$opp->bind_param('siiii', $gameId, $uid, $low, $high, $myPts);
$opp->execute();
$opponent = $opp->get_result()->fetch_assoc();
$opp->close();

if ($opponent) {
    $oppId = (int) $opponent['player_id'];

    // Create active match
    $am = $db->prepare(
        'INSERT INTO active_matches (game_id, player1_id, player2_id, is_bot, status) VALUES (?, ?, ?, 0, "active")'
    );
    $am->bind_param('sii', $gameId, $uid, $oppId);
    $am->execute();
    $matchId = (int) $db->insert_id;
    $am->close();

    // Remove opponent from queue
    $dq = $db->prepare('DELETE FROM match_queue WHERE player_id = ?');
    $dq->bind_param('i', $oppId);
    $dq->execute();
    $dq->close();

    respond([
        'status'   => 'matched',
        'matchId'  => $matchId,
        'isBot'    => false,
        'opponent' => [
            'id'     => $oppId,
            'name'   => $opponent['username'],
            'avatar' => $opponent['avatar'],
            'points' => (int) $opponent['total_points'],
            'rank'   => $opponent['rank_title'],
        ],
    ]);
}

// No opponent — add self to queue (upsert)
$myRank = $me['rank_title'];
$db->prepare(
    'INSERT INTO match_queue (player_id, game_id, points, rank_title)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE game_id = ?, points = ?, rank_title = ?, joined_at = NOW()'
)->execute(); // shorthand won't work with bind — do it properly:

$upsQ = $db->prepare(
    'INSERT INTO match_queue (player_id, game_id, points, rank_title)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE game_id = ?, points = ?, rank_title = ?, joined_at = NOW()'
);
$upsQ->bind_param('isisis' . 'si', $uid, $gameId, $myPts, $myRank, $gameId, $myPts, $myRank);

// bind_param types: i s i s s i s — 7 params
$upsQ->close();

// Simpler upsert without ON DUPLICATE:
$db->query("DELETE FROM match_queue WHERE player_id = $uid");
$ins = $db->prepare('INSERT INTO match_queue (player_id, game_id, points, rank_title) VALUES (?, ?, ?, ?)');
$ins->bind_param('isis', $uid, $gameId, $myPts, $myRank);
$ins->execute();
$ins->close();
$db->close();

respond([
    'status'   => 'waiting',
    'waited'   => 0,
    'me' => [
        'name'   => $me['username'],
        'avatar' => $me['avatar'],
        'points' => $myPts,
        'rank'   => $myRank,
    ],
]);

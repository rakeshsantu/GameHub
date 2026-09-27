<?php
/**
 * POST /api/logout.php
 * Header: Authorization: Bearer <token>
 */
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Method not allowed', 405);

$uid = requireAuth();
$db  = getDB();

$stmt = $db->prepare('UPDATE players SET is_online = 0, last_seen = NOW() WHERE id = ?');
$stmt->bind_param('i', $uid);
$stmt->execute();
$stmt->close();
$db->close();

respond(['success' => true, 'message' => 'Logged out successfully.']);

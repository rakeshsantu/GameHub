<?php
/**
 * POST /api/change_password.php
 * Header: Authorization: Bearer <token>
 * Body: { current_password, new_password, confirm_password }
 *
 * For mobile-only accounts (password_hash is empty), current_password
 * check is skipped — they set a password for the first time.
 */
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Method not allowed', 405);

$uid  = requireAuth();
$body = getBody();

$current = $body['current_password'] ?? '';
$new     = trim($body['new_password']     ?? '');
$confirm = trim($body['confirm_password'] ?? '');

if (strlen($new) < 6)      respondError('New password must be at least 6 characters.');
if ($new !== $confirm)     respondError('Passwords do not match.');

$db   = getDB();
$stmt = $db->prepare('SELECT password_hash FROM players WHERE id = ?');
$stmt->bind_param('i', $uid);
$stmt->execute();
$row  = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$row) respondError('Player not found.', 404);

$existingHash = $row['password_hash'];

// If player already has a password, verify current one
if ($existingHash !== '') {
    if (!$current) respondError('Current password is required.');
    if (!password_verify($current, $existingHash))
        respondError('Current password is incorrect.', 401);
}

// Prevent reuse of same password
if ($existingHash !== '' && password_verify($new, $existingHash))
    respondError('New password must differ from your current password.');

$newHash = password_hash($new, PASSWORD_BCRYPT);
$upd     = $db->prepare('UPDATE players SET password_hash = ? WHERE id = ?');
$upd->bind_param('si', $newHash, $uid);
$upd->execute(); $upd->close();
$db->close();

respond(['success' => true, 'message' => 'Password changed successfully.']);

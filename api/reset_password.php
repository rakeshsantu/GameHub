<?php
/**
 * POST /api/reset_password.php
 * Body: { uid, token, new_password, confirm_password }
 *
 * Validates the reset token and sets a new password.
 * Token is single-use — marked used=1 on success.
 */
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Method not allowed', 405);

$body        = getBody();
$uid         = (int)  ($body['uid']              ?? 0);
$rawToken    = trim(   $body['token']             ?? '');
$newPassword = trim(   $body['new_password']      ?? '');
$confirm     = trim(   $body['confirm_password']  ?? '');

if (!$uid || !$rawToken)   respondError('uid and token are required.');
if (strlen($newPassword) < 6) respondError('Password must be at least 6 characters.');
if ($newPassword !== $confirm)respondError('Passwords do not match.');

$tokenHash = hash('sha256', $rawToken);

$db   = getDB();
$stmt = $db->prepare(
    'SELECT id, expires_at, used FROM password_reset_tokens
     WHERE player_id = ? AND token_hash = ? LIMIT 1'
);
$stmt->bind_param('is', $uid, $tokenHash);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$row)                                 respondError('Invalid reset link.',   401);
if ($row['used'])                          respondError('This link has already been used.', 401);
if (strtotime($row['expires_at']) < time()) respondError('Reset link expired. Please request a new one.', 401);

// ── Mark token used ───────────────────────────────────────────────────────
$rowId = (int) $row['id'];
$db->query("UPDATE password_reset_tokens SET used = 1 WHERE id = $rowId");

// ── Update password ───────────────────────────────────────────────────────
$hash = password_hash($newPassword, PASSWORD_BCRYPT);
$upd  = $db->prepare('UPDATE players SET password_hash = ? WHERE id = ?');
$upd->bind_param('si', $hash, $uid);
$upd->execute(); $upd->close();
$db->close();

respond(['success' => true, 'message' => 'Password reset successfully. You can now sign in.']);

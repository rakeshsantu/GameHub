<?php
/**
 * POST /api/verify_otp.php
 * Body: { identifier, otp, purpose }
 *
 * On success returns a short-lived  otp_verified_token  that the caller
 * passes to login.php or register.php to complete authentication.
 *
 * The verified token is:  base64( mobile:timestamp:hmac )
 * It is valid for 5 minutes and is single-use (OTP row deleted on success).
 *
 * Error codes:
 *   400  — missing fields / wrong OTP / max attempts
 *   401  — expired
 *   404  — no pending OTP found
 */
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Method not allowed', 405);

$body       = getBody();
$identifier = trim($body['identifier'] ?? '');
$otp        = trim($body['otp']        ?? '');
$purpose    = trim($body['purpose']    ?? 'login');

if (!$identifier || !$otp) respondError('identifier and otp are required.');
if (strlen($otp) !== 6 || !ctype_digit($otp)) respondError('OTP must be 6 digits.');

// Normalise mobile
if (preg_match('/^\+?[\d]{7,15}$/', preg_replace('/[\s\-]/', '', $identifier))) {
    $identifier = '+' . preg_replace('/[^\d]/', '', $identifier);
}

$db   = getDB();
$stmt = $db->prepare(
    'SELECT id, otp_hash, attempts, expires_at
     FROM otp_tokens WHERE identifier = ? AND purpose = ? LIMIT 1'
);
$stmt->bind_param('ss', $identifier, $purpose);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$row) respondError('No pending OTP found. Please request a new one.', 404);

// ── Expiry check ──────────────────────────────────────────────────────────
if (strtotime($row['expires_at']) < time()) {
    $db->query("DELETE FROM otp_tokens WHERE identifier = '$identifier'");
    $db->close();
    respondError('OTP expired. Please request a new one.', 401);
}

// ── Attempt limit (max 5) ─────────────────────────────────────────────────
if ((int)$row['attempts'] >= 5) {
    $db->query("DELETE FROM otp_tokens WHERE identifier = '$identifier'");
    $db->close();
    respondError('Too many wrong attempts. Please request a new OTP.', 400);
}

// ── Verify OTP ────────────────────────────────────────────────────────────
if (!password_verify($otp, $row['otp_hash'])) {
    // Increment attempt counter
    $inc = $db->prepare('UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = ?');
    $inc->bind_param('i', $row['id']); $inc->execute(); $inc->close();
    $remaining = 4 - (int)$row['attempts'];
    $db->close();
    respondError("Wrong OTP. $remaining attempt(s) remaining.", 400);
}

// ── Success: delete OTP row, issue verified token ─────────────────────────
$db->query("DELETE FROM otp_tokens WHERE id = {$row['id']}");
$db->close();

$ts    = time();
$sig   = hash_hmac('sha256', $identifier . ':' . $ts, TOKEN_SECRET);
$vToken = base64_encode($identifier . ':' . $ts . ':' . $sig);

respond([
    'success'             => true,
    'otp_verified_token'  => $vToken,
    'message'             => 'OTP verified successfully.',
]);

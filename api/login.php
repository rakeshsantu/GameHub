<?php
/**
 * POST /api/login.php
 *
 * Three login paths:
 *   A) Email/Username + Password  — Body: { login, password }
 *   B) Mobile OTP (verified)      — Body: { mobile, otp_verified_token }
 *
 * Returns: { token, player }
 */
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Method not allowed', 405);

$body     = getBody();
$login    = trim($body['login']    ?? '');
$password = $body['password']      ?? '';
$mobile   = trim($body['mobile']   ?? '');
$otpToken = trim($body['otp_verified_token'] ?? '');

$db = getDB();

// ── Path B: Mobile OTP login ──────────────────────────────────────────────
if ($mobile !== '' && $otpToken !== '') {
    $mobile = '+' . preg_replace('/[^\d]/', '', $mobile);

    // Validate otp_verified_token
    $parts = explode(':', base64_decode($otpToken));
    if (count($parts) !== 3) respondError('Invalid or expired OTP token.', 401);
    [$tokMobile, $tokTime, $tokSig] = $parts;
    $expected = hash_hmac('sha256', $tokMobile . ':' . $tokTime, TOKEN_SECRET);
    if (!hash_equals($expected, $tokSig))  respondError('Invalid OTP token.', 401);
    if ((int)$tokTime < time() - 300)       respondError('OTP token expired. Please verify again.', 401);
    if ($tokMobile !== $mobile)             respondError('Mobile mismatch.', 401);

    $stmt = $db->prepare(
        'SELECT id, username, email, mobile, avatar, total_points, games_played, games_won, rank_title
         FROM players WHERE mobile = ? LIMIT 1'
    );
    $stmt->bind_param('s', $mobile);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) respondError('No account found for this mobile number. Please register first.', 404);

// ── Path A: Email/Username + Password ─────────────────────────────────────
} elseif ($login !== '' && $password !== '') {
    $stmt = $db->prepare(
        'SELECT id, username, email, mobile, avatar, total_points, games_played, games_won,
                rank_title, password_hash
         FROM players WHERE username = ? OR email = ? LIMIT 1'
    );
    $stmt->bind_param('ss', $login, $login);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row || !password_verify($password, $row['password_hash']))
        respondError('Invalid credentials.', 401);

} else {
    respondError('Provide (login + password) or (mobile + otp_verified_token).');
}

// ── Mark online ───────────────────────────────────────────────────────────
$uid = (int) $row['id'];
$upd = $db->prepare('UPDATE players SET is_online = 1, last_seen = NOW() WHERE id = ?');
$upd->bind_param('i', $uid); $upd->execute(); $upd->close();
$db->close();

$token = createToken($uid);

respond([
    'token'  => $token,
    'player' => [
        'id'           => $uid,
        'username'     => $row['username'],
        'email'        => $row['email'],
        'mobile'       => $row['mobile'] ?? null,
        'avatar'       => $row['avatar'],
        'total_points' => (int) $row['total_points'],
        'games_played' => (int) $row['games_played'],
        'games_won'    => (int) $row['games_won'],
        'rank_title'   => $row['rank_title'],
        'is_online'    => 1,
    ],
]);

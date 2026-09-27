<?php
/**
 * POST /api/register.php
 *
 * Two registration paths:
 *   A) Email + Password  — Body: { username, email, password, avatar? }
 *   B) Mobile + OTP      — Body: { username, mobile, avatar?, otp_verified_token }
 *      (otp_verified_token is the short-lived token returned by verify_otp.php)
 *
 * Returns: { token, player }
 */
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Method not allowed', 405);

$body     = getBody();
$username = trim($body['username'] ?? '');
$email    = trim($body['email']    ?? '');
$mobile   = trim($body['mobile']   ?? '');
$password = $body['password']      ?? '';
$avatar   = $body['avatar']        ?? '👤';
$otpToken = trim($body['otp_verified_token'] ?? '');

// ── Determine registration path ───────────────────────────────────────────
$isMobileReg = ($mobile !== '' && $otpToken !== '');
$isEmailReg  = ($email  !== '' && $password !== '');

if (!$isMobileReg && !$isEmailReg)
    respondError('Provide either (email + password) or (mobile + otp_verified_token).');

if (strlen($username) < 3 || strlen($username) > 30)
    respondError('Username must be 3–30 characters.');

$db = getDB();

// ── Mobile path: verify the otp_verified_token ────────────────────────────
if ($isMobileReg) {
    // Normalize mobile to E.164 (keep + and digits only)
    $mobile = '+' . preg_replace('/[^\d]/', '', $mobile);
    if (strlen($mobile) < 8 || strlen($mobile) > 16)
        respondError('Invalid mobile number.');

    // otp_verified_token = base64( mobile:timestamp:hmac )
    $parts = explode(':', base64_decode($otpToken));
    if (count($parts) !== 3) respondError('Invalid or expired OTP token.', 401);
    [$tokMobile, $tokTime, $tokSig] = $parts;
    $expected = hash_hmac('sha256', $tokMobile . ':' . $tokTime, TOKEN_SECRET);
    if (!hash_equals($expected, $tokSig))   respondError('Invalid OTP token.', 401);
    if ((int)$tokTime < time() - 300)        respondError('OTP token expired. Please verify again.', 401);
    if ($tokMobile !== $mobile)              respondError('Mobile mismatch.', 401);

    // Check unique username + mobile
    $chk = $db->prepare('SELECT id FROM players WHERE username = ? OR mobile = ?');
    $chk->bind_param('ss', $username, $mobile);
    $chk->execute(); $chk->store_result();
    if ($chk->num_rows > 0) respondError('Username or mobile already taken.');
    $chk->close();

    $ins = $db->prepare(
        'INSERT INTO players (username, email, mobile, password_hash, avatar)
         VALUES (?, ?, ?, ?, ?)'
    );
    // email defaults to mobile@gamehub.local (placeholder) so NOT NULL is satisfied
    $placeholderEmail = 'mobile_' . ltrim($mobile, '+') . '@gamehub.local';
    $ins->bind_param('sssss', $username, $placeholderEmail, $mobile, /* hash */ '', $avatar);
    if (!$ins->execute()) respondError('Registration failed: ' . $ins->error, 500);
    $newId = (int) $db->insert_id;
    $ins->close();

} else {
    // ── Email + password path ─────────────────────────────────────────────
    if (!filter_var($email, FILTER_VALIDATE_EMAIL))
        respondError('Invalid email address.');
    if (strlen($password) < 6)
        respondError('Password must be at least 6 characters.');

    $chk = $db->prepare('SELECT id FROM players WHERE username = ? OR email = ?');
    $chk->bind_param('ss', $username, $email);
    $chk->execute(); $chk->store_result();
    if ($chk->num_rows > 0) respondError('Username or email already taken.');
    $chk->close();

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $ins  = $db->prepare(
        'INSERT INTO players (username, email, password_hash, avatar) VALUES (?, ?, ?, ?)'
    );
    $ins->bind_param('ssss', $username, $email, $hash, $avatar);
    if (!$ins->execute()) respondError('Registration failed: ' . $ins->error, 500);
    $newId = (int) $db->insert_id;
    $ins->close();
}

$db->close();
$token = createToken($newId);

respond([
    'token'  => $token,
    'player' => [
        'id'           => $newId,
        'username'     => $username,
        'email'        => $email,
        'mobile'       => $mobile ?: null,
        'avatar'       => $avatar,
        'total_points' => 0,
        'games_played' => 0,
        'games_won'    => 0,
        'rank_title'   => 'Novice',
        'is_online'    => 1,
    ],
]);

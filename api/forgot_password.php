<?php
/**
 * POST /api/forgot_password.php
 * Body: { email }
 *
 * Generates a secure reset token, stores its hash, and emails a link.
 * Always returns success=true (never confirm whether an email exists — prevents enumeration).
 *
 * Reset link format:
 *   https://yourdomain.com/#reset?token=<raw_token>&uid=<player_id>
 *   (Frontend reads the hash fragment and calls reset_password.php)
 */
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Method not allowed', 405);

$body  = getBody();
$email = trim($body['email'] ?? '');

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL))
    respondError('A valid email address is required.');

$db   = getDB();
$stmt = $db->prepare('SELECT id, username FROM players WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$player = $stmt->get_result()->fetch_assoc();
$stmt->close();

// Always respond success — no enumeration
if (!$player) {
    $db->close();
    respond(['success' => true, 'message' => 'If that email exists, a reset link has been sent.']);
}

$uid = (int) $player['id'];

// ── Invalidate any previous reset tokens for this player ─────────────────
$db->query("DELETE FROM password_reset_tokens WHERE player_id = $uid");

// ── Generate a 40-byte random token ──────────────────────────────────────
$rawToken  = bin2hex(random_bytes(32));          // 64 hex chars
$tokenHash = hash('sha256', $rawToken);          // stored in DB
$expires   = date('Y-m-d H:i:s', time() + 1800); // 30 min

$ins = $db->prepare(
    'INSERT INTO password_reset_tokens (player_id, token_hash, expires_at) VALUES (?, ?, ?)'
);
$ins->bind_param('iss', $uid, $tokenHash, $expires);
$ins->execute(); $ins->close();
$db->close();

// ── Build reset URL ───────────────────────────────────────────────────────
$baseUrl  = defined('APP_URL') ? APP_URL : 'https://yourdomain.com';
$resetUrl = "$baseUrl/#reset?token=$rawToken&uid=$uid";

// ── Send email ─────────────────────────────────────────────────────────────
$name    = $player['username'];
$subject = 'GameHub — Reset Your Password';
$body    = "Hello $name,\n\n"
         . "You requested a password reset for your GameHub account.\n\n"
         . "Click the link below (valid for 30 minutes):\n"
         . "$resetUrl\n\n"
         . "If you did not request this, ignore this email — your account is safe.\n\n"
         . "— The GameHub Team";

$from    = defined('MAIL_FROM') ? MAIL_FROM : 'noreply@gamehub.local';
$headers = "From: GameHub <$from>\r\nContent-Type: text/plain; charset=UTF-8";
$sent    = @mail($email, $subject, $body, $headers);

// Dev fallback: log token to file
if (!$sent) {
    $logDir = __DIR__ . '/logs';
    if (!is_dir($logDir)) @mkdir($logDir, 0700, true);
    @file_put_contents(
        $logDir . '/reset_dev.log',
        date('Y-m-d H:i:s') . " uid=$uid email=$email reset_url=$resetUrl\n",
        FILE_APPEND
    );
}

respond([
    'success'  => true,
    'message'  => 'If that email exists, a reset link has been sent.',
    'dev_note' => $sent ? null : 'Reset URL logged to api/logs/reset_dev.log (dev mode)',
]);

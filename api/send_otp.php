<?php
/**
 * POST /api/send_otp.php
 * Body: { identifier, purpose }
 *   identifier — mobile number (E.164) OR email address
 *   purpose    — "login" | "register"
 *
 * ── How OTP delivery works ────────────────────────────────────────────────
 *  • Mobile  → SMS via Twilio (configure credentials in config.php).
 *              Falls back to a log file if Twilio is not configured (dev mode).
 *  • Email   → PHP mail() / SMTP.  Replace with PHPMailer/SMTP in production.
 *
 * ── Rate limiting ─────────────────────────────────────────────────────────
 *  One OTP per identifier; new request invalidates the previous one.
 *  Minimum gap: 60 s between re-sends (enforced by created_at check).
 *
 * Returns: { success, message, resend_after }   (never returns the OTP itself)
 */
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respondError('Method not allowed', 405);

$body       = getBody();
$identifier = trim($body['identifier'] ?? '');
$purpose    = trim($body['purpose']    ?? 'login');

if (!$identifier) respondError('identifier is required.');
if (!in_array($purpose, ['login', 'register'])) respondError('Invalid purpose.');

// ── Normalise ─────────────────────────────────────────────────────────────
$isMobile = preg_match('/^\+?[\d\s\-]{7,15}$/', $identifier);
if ($isMobile) {
    $identifier = '+' . preg_replace('/[^\d]/', '', $identifier);
} else {
    if (!filter_var($identifier, FILTER_VALIDATE_EMAIL))
        respondError('Invalid email or mobile number.');
}

// ── For login: check account exists ───────────────────────────────────────
if ($purpose === 'login') {
    $db = getDB();
    $col = $isMobile ? 'mobile' : 'email';
    $chk = $db->prepare("SELECT id FROM players WHERE $col = ? LIMIT 1");
    $chk->bind_param('s', $identifier);
    $chk->execute(); $chk->store_result();
    if ($chk->num_rows === 0)
        respondError('No account found for this ' . ($isMobile ? 'mobile number' : 'email') . '.', 404);
    $chk->close();
} else {
    $db = getDB();
}

// ── Rate-limit: 60 s between re-sends ─────────────────────────────────────
$rl = $db->prepare(
    'SELECT created_at FROM otp_tokens WHERE identifier = ? LIMIT 1'
);
$rl->bind_param('s', $identifier);
$rl->execute();
$existing = $rl->get_result()->fetch_assoc();
$rl->close();

if ($existing) {
    $secondsSince = time() - strtotime($existing['created_at']);
    if ($secondsSince < 60) {
        respond([
            'success'      => false,
            'message'      => 'Please wait before requesting a new OTP.',
            'resend_after' => 60 - $secondsSince,
        ]);
    }
}

// ── Generate 6-digit OTP ──────────────────────────────────────────────────
$otp     = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
$otpHash = password_hash($otp, PASSWORD_BCRYPT);
$expires = date('Y-m-d H:i:s', time() + 600); // 10 minutes

// ── Upsert otp_tokens (replace any existing row for this identifier) ───────
$ups = $db->prepare(
    'INSERT INTO otp_tokens (identifier, otp_hash, purpose, attempts, expires_at)
     VALUES (?, ?, ?, 0, ?)
     ON DUPLICATE KEY UPDATE
         otp_hash   = VALUES(otp_hash),
         purpose    = VALUES(purpose),
         attempts   = 0,
         expires_at = VALUES(expires_at),
         created_at = NOW()'
);
$ups->bind_param('ssss', $identifier, $otpHash, $purpose, $expires);
if (!$ups->execute()) respondError('Failed to store OTP.', 500);
$ups->close();
$db->close();

// ── Deliver OTP ───────────────────────────────────────────────────────────
$delivered = false;
$message   = "Your GameHub OTP is: $otp  (valid 10 minutes, do not share)";

if ($isMobile) {
    $delivered = sendSmsTwilio($identifier, $message);
} else {
    $delivered = sendEmail($identifier, 'Your GameHub OTP', $message);
}

// Dev fallback: log OTP to file (REMOVE IN PRODUCTION)
if (!$delivered) {
    $logDir = __DIR__ . '/logs';
    if (!is_dir($logDir)) @mkdir($logDir, 0700, true);
    @file_put_contents(
        $logDir . '/otp_dev.log',
        date('Y-m-d H:i:s') . " [$identifier] OTP=$otp\n",
        FILE_APPEND
    );
}

respond([
    'success'      => true,
    'message'      => 'OTP sent to ' . ($isMobile ? 'your mobile' : 'your email') . '.',
    'resend_after' => 60,
    'dev_note'     => $delivered ? null : 'OTP logged to api/logs/otp_dev.log (dev mode)',
]);

// ─────────────────────────────────────────────────────────────────────────
// Delivery helpers — replace with real credentials / service in production
// ─────────────────────────────────────────────────────────────────────────

function sendSmsTwilio(string $to, string $msg): bool {
    // Set these in config.php or as server env vars
    $sid   = defined('TWILIO_SID')   ? TWILIO_SID   : (getenv('TWILIO_SID')   ?: '');
    $token = defined('TWILIO_TOKEN') ? TWILIO_TOKEN : (getenv('TWILIO_TOKEN') ?: '');
    $from  = defined('TWILIO_FROM')  ? TWILIO_FROM  : (getenv('TWILIO_FROM')  ?: '');
    if (!$sid || !$token || !$from) return false;

    $url  = "https://api.twilio.com/2010-04-01/Accounts/$sid/Messages.json";
    $data = http_build_query(['To' => $to, 'From' => $from, 'Body' => $msg]);
    $ch   = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $data,
        CURLOPT_USERPWD        => "$sid:$token",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code === 201;
}

function sendEmail(string $to, string $subject, string $body): bool {
    $from    = defined('MAIL_FROM') ? MAIL_FROM : 'noreply@gamehub.local';
    $headers = "From: GameHub <$from>\r\nContent-Type: text/plain; charset=UTF-8";
    return @mail($to, $subject, $body, $headers);
}

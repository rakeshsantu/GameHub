<?php
// ─── Database Configuration ────────────────────────────────────────────────
define('DB_HOST',     'auth-db471.hstgr.io');
define('DB_USER',     'u209879126_gamehub');
define('DB_PASS',     'GameHub@2026');
define('DB_NAME',     'u209879126_GameHub');

// ─── CORS & JSON Headers ───────────────────────────────────────────────────
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ─── DB Connection ─────────────────────────────────────────────────────────
function getDB(): mysqli {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]);
        exit();
    }
    $conn->set_charset('utf8mb4');
    return $conn;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function respond(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data);
    exit();
}

function respondError(string $msg, int $code = 400): void {
    respond(['error' => $msg], $code);
}

function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

// ─── JWT-like token (simple HMAC token) ────────────────────────────────────
define('TOKEN_SECRET', 'GH_S3CR3T_2026_royal');
define('TOKEN_TTL',    86400 * 7); // 7 days

function createToken(int $userId): string {
    $payload = base64_encode(json_encode([
        'uid' => $userId,
        'exp' => time() + TOKEN_TTL,
    ]));
    $sig = base64_encode(hash_hmac('sha256', $payload, TOKEN_SECRET, true));
    return $payload . '.' . $sig;
}

function verifyToken(string $token): ?int {
    $parts = explode('.', $token);
    if (count($parts) !== 2) return null;
    [$payload, $sig] = $parts;
    $expected = base64_encode(hash_hmac('sha256', $payload, TOKEN_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(base64_decode($payload), true);
    if (!$data || $data['exp'] < time()) return null;
    return (int) $data['uid'];
}

function requireAuth(): int {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($header, 'Bearer ')) respondError('Unauthorized', 401);
    $token = substr($header, 7);
    $uid   = verifyToken($token);
    if (!$uid) respondError('Invalid or expired token', 401);
    return $uid;
}

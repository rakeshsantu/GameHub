<?php
/**
 * page_views.php
 *
 * GET  /api/page_views.php          — returns { views: <total> }
 * POST /api/page_views.php          — increments counter, returns { views: <new_total> }
 *
 * Uses a single-row table `page_views` keyed on page = 'home'.
 * Safe to call on every page load (POST on mount, GET for read-only).
 */
require_once 'config.php';

$db = getDB();

// Ensure table exists (idempotent — safe to call every request)
$db->query("
    CREATE TABLE IF NOT EXISTS page_views (
        page      VARCHAR(60)      NOT NULL PRIMARY KEY,
        views     BIGINT UNSIGNED  NOT NULL DEFAULT 0,
        updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

$page = 'home';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Atomically increment
    $stmt = $db->prepare("
        INSERT INTO page_views (page, views)
        VALUES (?, 1)
        ON DUPLICATE KEY UPDATE views = views + 1
    ");
    $stmt->bind_param('s', $page);
    $stmt->execute();
    $stmt->close();
}

// Always return current count
$stmt = $db->prepare("SELECT views FROM page_views WHERE page = ?");
$stmt->bind_param('s', $page);
$stmt->execute();
$result = $stmt->get_result();
$row    = $result->fetch_assoc();
$stmt->close();

respond(['views' => (int)($row['views'] ?? 0)]);

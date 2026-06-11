-- Run in Supabase → SQL Editor
-- Cleans up Insights & Reports noise from BEFORE RazorpayX went live.
-- Does not delete claims or people — only old activity/log rows.
--
-- Go-live: 2026-06-10 11:00 AM IST = 05:30 UTC
-- (Same cutoff as scripts/claims-cleanup-pre-razorpay.sql)

-- ── Step 1: Preview activity rows to DELETE ──
SELECT
  type,
  COUNT(*) AS rows_to_delete,
  MIN("createdAt") AS oldest,
  MAX("createdAt") AS newest
FROM "PlatformActivity"
WHERE "createdAt" < TIMESTAMPTZ '2026-06-10 05:30:00+00'
GROUP BY type
ORDER BY rows_to_delete DESC;

-- ── Step 2: Sample rows (spot-check test logins / failed payouts) ──
SELECT id, type, summary, "createdAt"
FROM "PlatformActivity"
WHERE "createdAt" < TIMESTAMPTZ '2026-06-10 05:30:00+00'
ORDER BY "createdAt" DESC
LIMIT 30;

-- ── Step 3: DELETE pre-live activity (run after Step 1 looks right) ──
DELETE FROM "PlatformActivity"
WHERE "createdAt" < TIMESTAMPTZ '2026-06-10 05:30:00+00';

-- ── Step 4: Verify — oldest activity should be on/after go-live ──
SELECT
  COUNT(*) AS remaining_activity,
  MIN("createdAt") AS oldest,
  MAX("createdAt") AS newest
FROM "PlatformActivity";

SELECT type, COUNT(*) AS count
FROM "PlatformActivity"
GROUP BY type
ORDER BY count DESC;

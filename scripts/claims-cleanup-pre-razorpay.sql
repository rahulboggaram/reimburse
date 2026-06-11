-- Run in Supabase → SQL Editor (Reimburse - mumbai project)
-- Removes ALL claims from BEFORE the droplet relay went live.
-- Keeps every claim created on/after go-live (11:00 AM IST, 10 June 2026).
--
-- Why the old script only showed ~7 rows to delete:
-- Pre-live test claims often have payoutError / payoutStatus from failed
-- Razorpay tries. The old rules treated those as "real" and kept them.
-- This version uses the go-live DATE only — much simpler.
--
-- Receipts on deleted claims are removed automatically (ON DELETE CASCADE).

-- Go-live moment (droplet relay): 2026-06-10 11:00 AM IST = 05:30 UTC
-- Change this one timestamp if your relay went live at a different time.

-- ── Step 1: Preview claims to KEEP (on/after go-live) ──
SELECT
  r.id,
  r."createdAt",
  r.status,
  r.amount,
  r.category,
  r."employeeName",
  r."razorpayPayoutId",
  r."payoutStatus"
FROM "Reimbursement" r
WHERE r."createdAt" >= TIMESTAMPTZ '2026-06-10 05:30:00+00'
ORDER BY r."createdAt";

-- ── Step 2: Preview claims to DELETE (everything before go-live) ──
SELECT
  r.id,
  r."createdAt",
  r.status,
  r.amount,
  r.category,
  r."employeeName",
  r."razorpayPayoutId",
  r."payoutStatus",
  r."payoutError"
FROM "Reimbursement" r
WHERE r."createdAt" < TIMESTAMPTZ '2026-06-10 05:30:00+00'
ORDER BY r."createdAt";

-- ── Step 3: DELETE (run only after Step 2 looks right) ──
DELETE FROM "Reimbursement" r
WHERE r."createdAt" < TIMESTAMPTZ '2026-06-10 05:30:00+00';

-- ── Step 4: Optional — remove payout log rows for deleted claims ──
DELETE FROM "PlatformActivity" a
WHERE a.type IN ('PAYOUT_INITIATED', 'PAYOUT_COMPLETED', 'PAYOUT_FAILED')
  AND a.metadata IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Reimbursement" r
    WHERE r.id = (a.metadata::jsonb ->> 'claimId')
  );

-- ── Step 5: Verify ──
SELECT
  COUNT(*) AS remaining_claims,
  COUNT(*) FILTER (WHERE "razorpayPayoutId" IS NOT NULL) AS with_razorpay_payout,
  MIN("createdAt") AS oldest,
  MAX("createdAt") AS newest
FROM "Reimbursement";

SELECT id, "createdAt", status, amount, category, "employeeName", "razorpayPayoutId"
FROM "Reimbursement"
ORDER BY "createdAt";

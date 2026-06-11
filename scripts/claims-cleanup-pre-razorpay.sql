-- Run in Supabase → SQL Editor (Reimburse - mumbai project)
-- Removes pre–RazorpayX test claims. Keeps live claims (droplet relay era).
--
-- KEEP a claim when ANY of:
--   • razorpayPayoutId, payoutInitiatedAt, payoutStatus, or payoutError is set
--   • createdAt is on/after go-live (default: 2026-06-10 11:00 IST)
--
-- Receipts on deleted claims are removed automatically (ON DELETE CASCADE).

-- ── 1) Preview go-live cutoff ──
-- Adjust if your relay went live at a different time:
--   SET LOCAL timezone = 'Asia/Kolkata';
--   SELECT '2026-06-10 11:00:00+05:30'::timestamptz AS go_live_at;

-- ── 2) Preview: claims to KEEP ──
SELECT
  r.id,
  r."createdAt",
  r.status,
  r.amount,
  r.category,
  r."employeeName",
  r."razorpayPayoutId",
  r."payoutStatus",
  CASE
    WHEN r."razorpayPayoutId" IS NOT NULL
      OR r."payoutInitiatedAt" IS NOT NULL
      OR r."payoutStatus" IS NOT NULL
      OR r."payoutError" IS NOT NULL THEN 'razorpay'
    ELSE 'post-live'
  END AS keep_reason
FROM "Reimbursement" r
WHERE
  r."razorpayPayoutId" IS NOT NULL
  OR r."payoutInitiatedAt" IS NOT NULL
  OR r."payoutStatus" IS NOT NULL
  OR r."payoutError" IS NOT NULL
  OR r."createdAt" >= TIMESTAMPTZ '2026-06-10 05:30:00+00'
ORDER BY r."createdAt";

-- ── 3) Preview: claims to DELETE (test / pre-live) ──
SELECT
  r.id,
  r."createdAt",
  r.status,
  r.amount,
  r.category,
  r."employeeName"
FROM "Reimbursement" r
WHERE
  r."razorpayPayoutId" IS NULL
  AND r."payoutInitiatedAt" IS NULL
  AND r."payoutStatus" IS NULL
  AND r."payoutError" IS NULL
  AND r."createdAt" < TIMESTAMPTZ '2026-06-10 05:30:00+00'
ORDER BY r."createdAt";

-- ── 4) DELETE test claims (run only after reviewing step 3) ──
DELETE FROM "Reimbursement" r
WHERE
  r."razorpayPayoutId" IS NULL
  AND r."payoutInitiatedAt" IS NULL
  AND r."payoutStatus" IS NULL
  AND r."payoutError" IS NULL
  AND r."createdAt" < TIMESTAMPTZ '2026-06-10 05:30:00+00';

-- ── 5) Remove payout activity rows for deleted claims (optional cleanup) ──
DELETE FROM "PlatformActivity" a
WHERE a.type IN ('PAYOUT_INITIATED', 'PAYOUT_COMPLETED', 'PAYOUT_FAILED')
  AND a.metadata IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Reimbursement" r
    WHERE r.id = (a.metadata::jsonb ->> 'claimId')
  );

-- ── 6) Verify ──
SELECT
  COUNT(*) AS remaining_claims,
  COUNT(*) FILTER (WHERE "razorpayPayoutId" IS NOT NULL) AS with_razorpay_payout,
  MIN("createdAt") AS oldest,
  MAX("createdAt") AS newest
FROM "Reimbursement";

SELECT id, "createdAt", status, amount, category, "employeeName", "razorpayPayoutId"
FROM "Reimbursement"
ORDER BY "createdAt";

-- Run in Supabase → SQL Editor (Mumbai project).
-- Removes today's test claims (IST) but keeps the most recent one with working receipt photos.
-- Receipt rows cascade automatically when a claim is deleted.

-- Step 1: Preview today's claims
WITH bounds AS (
  SELECT
    (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS day_start,
    ((date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') + interval '1 day') AT TIME ZONE 'Asia/Kolkata') AS day_end
),
today_claims AS (
  SELECT r.*
  FROM "Reimbursement" r
  CROSS JOIN bounds b
  WHERE r."createdAt" >= b.day_start
    AND r."createdAt" < b.day_end
),
working_claim AS (
  SELECT tc.id
  FROM today_claims tc
  WHERE EXISTS (
    SELECT 1
    FROM "ReimbursementReceipt" rec
    WHERE rec."reimbursementId" = tc.id
      AND rec."filePath" LIKE '%/%'
      AND rec."filePath" NOT LIKE 'data:%'
      AND rec."filePath" NOT LIKE '/uploads/%'
      AND TRIM(rec."filePath") <> ''
  )
  ORDER BY tc."createdAt" DESC
  LIMIT 1
)
SELECT
  tc.id,
  tc."createdAt",
  tc.status,
  tc.amount,
  tc.category,
  tc."employeeName",
  CASE WHEN wc.id IS NOT NULL THEN 'KEEP (latest working photos)' ELSE 'DELETE' END AS action
FROM today_claims tc
LEFT JOIN working_claim wc ON wc.id = tc.id
ORDER BY tc."createdAt";

-- Step 2: Delete (run only if Step 1 looks right)
WITH bounds AS (
  SELECT
    (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS day_start,
    ((date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') + interval '1 day') AT TIME ZONE 'Asia/Kolkata') AS day_end
),
today_claims AS (
  SELECT r.id, r."createdAt"
  FROM "Reimbursement" r
  CROSS JOIN bounds b
  WHERE r."createdAt" >= b.day_start
    AND r."createdAt" < b.day_end
),
working_claim AS (
  SELECT tc.id
  FROM today_claims tc
  WHERE EXISTS (
    SELECT 1
    FROM "ReimbursementReceipt" rec
    WHERE rec."reimbursementId" = tc.id
      AND rec."filePath" LIKE '%/%'
      AND rec."filePath" NOT LIKE 'data:%'
      AND rec."filePath" NOT LIKE '/uploads/%'
      AND TRIM(rec."filePath") <> ''
  )
  ORDER BY tc."createdAt" DESC
  LIMIT 1
)
DELETE FROM "Reimbursement" r
USING today_claims tc, working_claim wc
WHERE r.id = tc.id
  AND r.id <> wc.id;

-- Step 3: Verify
WITH bounds AS (
  SELECT
    (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS day_start,
    ((date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') + interval '1 day') AT TIME ZONE 'Asia/Kolkata') AS day_end
)
SELECT COUNT(*) AS claims_left_today
FROM "Reimbursement" r
CROSS JOIN bounds b
WHERE r."createdAt" >= b.day_start
  AND r."createdAt" < b.day_end;

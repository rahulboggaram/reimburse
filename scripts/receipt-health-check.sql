-- Find receipt rows that cannot be served (run in Supabase SQL Editor).
-- Broken rows: empty path, legacy /uploads/ on Vercel, or invalid data URLs.

SELECT
  r.id AS receipt_id,
  r."reimbursementId" AS claim_id,
  r."fileName",
  r."mimeType",
  r."sizeBytes",
  LENGTH(r."filePath") AS path_length,
  CASE
    WHEN r."filePath" IS NULL OR TRIM(r."filePath") = '' THEN 'empty_path'
    WHEN r."filePath" LIKE '/uploads/%' THEN 'legacy_disk_path'
    WHEN r."filePath" NOT LIKE 'data:%' THEN 'unknown_format'
    WHEN LENGTH(r."filePath") < 100 THEN 'truncated_data_url'
    ELSE 'ok'
  END AS status,
  rm."createdAt" AS claim_created_at,
  rm.category,
  rm.amount
FROM "ReimbursementReceipt" r
JOIN "Reimbursement" rm ON rm.id = r."reimbursementId"
WHERE
  r."filePath" IS NULL
  OR TRIM(r."filePath") = ''
  OR r."filePath" LIKE '/uploads/%'
  OR r."filePath" NOT LIKE 'data:%'
  OR LENGTH(r."filePath") < 100
ORDER BY rm."createdAt" DESC;

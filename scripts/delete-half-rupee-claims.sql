-- Run in Supabase → SQL Editor (Mumbai project)
-- Removes test claims for ₹0.50 (below Razorpay minimum).
-- Receipts are removed automatically (ON DELETE CASCADE).

-- Step 1: Preview
SELECT
  id,
  "createdAt",
  status,
  amount,
  category,
  "employeeName",
  "razorpayPayoutId"
FROM "Reimbursement"
WHERE amount = 0.5
ORDER BY "createdAt";

-- Step 2: Delete (run only if Step 1 shows the two claims you want gone)
DELETE FROM "Reimbursement"
WHERE amount = 0.5;

-- Step 3: Verify
SELECT COUNT(*) AS half_rupee_claims_left
FROM "Reimbursement"
WHERE amount = 0.5;

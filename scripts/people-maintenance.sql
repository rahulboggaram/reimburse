-- Run in Supabase → SQL Editor (Reimburse - mumbai project)
-- 1) Permanently remove inactive users with no claims or activity history
-- 2) Make +91 90603 33300 an active Admin at Head Office

-- Preview inactive users first
SELECT u.id, u.phone, u.name, u.role,
  (SELECT COUNT(*) FROM "Reimbursement" r
   WHERE r."employeeId" = u.id OR r."approverId" = u.id OR r."paymentApproverId" = u.id) AS claim_refs,
  (SELECT COUNT(*) FROM "PlatformActivity" a
   WHERE a."actorId" = u.id OR a."targetUserId" = u.id) AS activity_refs
FROM "User" u
WHERE u.active = false
ORDER BY u.phone;

-- Delete inactive profiles that are safe to remove (no reimbursements / activity tied to them)
DELETE FROM "User" u
WHERE u.active = false
  AND NOT EXISTS (
    SELECT 1 FROM "Reimbursement" r
    WHERE r."employeeId" = u.id
       OR r."approverId" = u.id
       OR r."paymentApproverId" = u.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM "PlatformActivity" a
    WHERE a."actorId" = u.id OR a."targetUserId" = u.id
  );

-- Promote 9060333300 to Admin at Head Office (reactivate if inactive)
UPDATE "User"
SET
  role = 'ADMIN',
  active = true,
  "branchId" = (SELECT id FROM "Branch" WHERE name = 'Head Office' LIMIT 1),
  "updatedAt" = NOW()
WHERE phone = '+919060333300';

-- Verify
SELECT u.phone, u.name, u.role, u.active, b.name AS branch
FROM "User" u
LEFT JOIN "Branch" b ON b.id = u."branchId"
WHERE u.phone = '+919060333300'
   OR u.active = false
ORDER BY u.active DESC, u.phone;

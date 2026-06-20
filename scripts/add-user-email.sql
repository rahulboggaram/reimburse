-- Run in Supabase → SQL Editor to add optional work email on user profiles

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Example: add work email for +91 90603 33300
-- UPDATE "User"
-- SET email = 'you@yellowmetal.com', "updatedAt" = NOW()
-- WHERE phone = '+919060333300';

-- Verify
SELECT phone, email, name, role, active
FROM "User"
WHERE phone = '+919060333300';

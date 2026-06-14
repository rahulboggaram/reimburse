-- Run in Supabase → SQL Editor after deploying email OTP
-- Adds optional work email used for login codes

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Example: add your admin email for +91 90603 33300
-- UPDATE "User"
-- SET email = 'you@yellowmetal.com', "updatedAt" = NOW()
-- WHERE phone = '+919060333300';

-- Verify
SELECT phone, email, name, role, active
FROM "User"
WHERE phone = '+919060333300';

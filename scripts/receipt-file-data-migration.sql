-- Run once in Supabase → SQL Editor (Reimburse project).
-- Stores receipt photos as binary bytes instead of huge text strings.

ALTER TABLE "ReimbursementReceipt"
ADD COLUMN IF NOT EXISTS "fileData" BYTEA;

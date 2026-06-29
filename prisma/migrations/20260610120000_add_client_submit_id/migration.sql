-- Safe idempotency for claim submits (retries after network / DB blips).
ALTER TABLE "Reimbursement" ADD COLUMN IF NOT EXISTS "clientSubmitId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Reimbursement_clientSubmitId_key"
  ON "Reimbursement"("clientSubmitId");

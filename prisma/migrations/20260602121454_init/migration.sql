-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('EMPLOYEE', 'BRANCH_MANAGER', 'APPROVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReimbursementStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "PlatformActivityType" AS ENUM ('USER_ADDED', 'USER_REMOVED', 'APPROVER_ENABLED', 'APPROVER_DISABLED', 'ADMIN_ENABLED', 'ADMIN_DISABLED', 'PROFILE_UPDATED', 'PROFILE_COMPLETED', 'USER_LOGIN', 'PAYOUT_INITIATED', 'PAYOUT_COMPLETED', 'PAYOUT_FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "ifscCode" TEXT,
    "bankAccountNumber" TEXT,
    "razorpayContactId" TEXT,
    "razorpayFundAccountId" TEXT,
    "role" "UserRole" NOT NULL,
    "branchId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformActivity" (
    "id" TEXT NOT NULL,
    "type" "PlatformActivityType" NOT NULL,
    "actorId" TEXT,
    "targetUserId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementReceipt" (
    "id" TEXT NOT NULL,
    "reimbursementId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReimbursementReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reimbursement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "ReimbursementStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "razorpayPayoutId" TEXT,
    "payoutStatus" TEXT,
    "payoutUtr" TEXT,
    "payoutError" TEXT,
    "payoutInitiatedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "approverId" TEXT NOT NULL,
    "paymentApproverId" TEXT NOT NULL,
    "refiledFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reimbursement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");

-- CreateIndex
CREATE INDEX "Branch_active_name_idx" ON "Branch"("active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE INDEX "ExpenseCategory_active_name_idx" ON "ExpenseCategory"("active", "name");

-- CreateIndex
CREATE INDEX "PlatformActivity_createdAt_idx" ON "PlatformActivity"("createdAt");

-- CreateIndex
CREATE INDEX "ReimbursementReceipt_reimbursementId_idx" ON "ReimbursementReceipt"("reimbursementId");

-- CreateIndex
CREATE INDEX "OtpChallenge_phone_expiresAt_idx" ON "OtpChallenge"("phone", "expiresAt");

-- CreateIndex
CREATE INDEX "Reimbursement_employeeId_createdAt_idx" ON "Reimbursement"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "Reimbursement_status_createdAt_idx" ON "Reimbursement"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Reimbursement_approverId_idx" ON "Reimbursement"("approverId");

-- CreateIndex
CREATE INDEX "Reimbursement_branchId_idx" ON "Reimbursement"("branchId");

-- CreateIndex
CREATE INDEX "Reimbursement_paymentApproverId_idx" ON "Reimbursement"("paymentApproverId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformActivity" ADD CONSTRAINT "PlatformActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformActivity" ADD CONSTRAINT "PlatformActivity_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementReceipt" ADD CONSTRAINT "ReimbursementReceipt_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "Reimbursement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_paymentApproverId_fkey" FOREIGN KEY ("paymentApproverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

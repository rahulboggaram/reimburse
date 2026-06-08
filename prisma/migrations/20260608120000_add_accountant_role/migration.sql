-- Add Accountant role (reports + own reimbursements, no approvals or admin tools)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ACCOUNTANT';

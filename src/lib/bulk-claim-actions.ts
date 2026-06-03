import { prisma } from "@/lib/db";
import {
  tryAutoPayAfterAdminApproval,
  userCanReceivePayout,
} from "@/lib/admin-auto-payout";
import { adminApprovalQueueWhere } from "@/lib/claim-decide-access";
import { paymentWaitingWhereForSession } from "@/lib/claim-payment-queue";
import { initiateClaimPayout } from "@/lib/payouts";
import { getRazorpayConfig } from "@/lib/razorpayx";

const employeeForPayoutSelect = {
  id: true,
  name: true,
  phone: true,
  ifscCode: true,
  bankAccountNumber: true,
  razorpayContactId: true,
  razorpayFundAccountId: true,
} as const;

export type BulkItemResult = {
  claimId: string;
  employeeName: string;
  ok: boolean;
  error?: string;
};

export type BulkActionSummary = {
  total: number;
  succeeded: number;
  failed: number;
  results: BulkItemResult[];
};

export async function countPaymentWaiting(session: {
  id: string;
  role: string;
}) {
  const where = paymentWaitingWhereForSession(session);
  if (!where) return 0;
  return prisma.reimbursement.count({ where });
}

export async function countAdminPendingApproval() {
  return prisma.reimbursement.count({ where: adminApprovalQueueWhere() });
}

export async function bulkPayPaymentQueue(session: {
  id: string;
  role: string;
}): Promise<BulkActionSummary | { error: string }> {
  const where = paymentWaitingWhereForSession(session);
  if (!where) {
    return { error: "Your role cannot run bulk payment." };
  }

  const razorpay = getRazorpayConfig();
  if (!razorpay.enabled) {
    return {
      error:
        "RazorpayX is not configured. Set RAZORPAYX_MOCK=true for demo payouts, or add API keys on Vercel.",
    };
  }

  const claims = await prisma.reimbursement.findMany({
    where,
    orderBy: { decidedAt: "asc" },
    include: { employee: { select: employeeForPayoutSelect } },
  });

  const results: BulkItemResult[] = [];

  for (const claim of claims) {
    if (!userCanReceivePayout(claim.employee)) {
      results.push({
        claimId: claim.id,
        employeeName: claim.employeeName,
        ok: false,
        error: "Missing name or bank details on profile",
      });
      continue;
    }

    try {
      await initiateClaimPayout({ claim, actorId: session.id });
      results.push({
        claimId: claim.id,
        employeeName: claim.employeeName,
        ok: true,
      });
    } catch (err) {
      results.push({
        claimId: claim.id,
        employeeName: claim.employeeName,
        ok: false,
        error: err instanceof Error ? err.message : "Payment failed",
      });
    }
  }

  return summarize(results);
}

export async function bulkAdminApproveQueue(
  adminId: string,
): Promise<BulkActionSummary> {
  const claims = await prisma.reimbursement.findMany({
    where: adminApprovalQueueWhere(),
    orderBy: { createdAt: "asc" },
    include: {
      employee: { select: { role: true, ...employeeForPayoutSelect } },
      approver: { select: { role: true } },
    },
  });

  const results: BulkItemResult[] = [];

  for (const claim of claims) {
    try {
      await prisma.reimbursement.update({
        where: { id: claim.id },
        data: {
          status: "APPROVED",
          decidedAt: new Date(),
          approverId: adminId,
          rejectionReason: null,
        },
      });

      const payoutResult = await tryAutoPayAfterAdminApproval(claim.id, adminId);
      if (!payoutResult.ok && "error" in payoutResult) {
        results.push({
          claimId: claim.id,
          employeeName: claim.employeeName,
          ok: true,
          error: `Approved; payout: ${payoutResult.error}`,
        });
        continue;
      }

      results.push({
        claimId: claim.id,
        employeeName: claim.employeeName,
        ok: true,
      });
    } catch (err) {
      results.push({
        claimId: claim.id,
        employeeName: claim.employeeName,
        ok: false,
        error: err instanceof Error ? err.message : "Could not approve",
      });
    }
  }

  return summarize(results);
}

function summarize(results: BulkItemResult[]): BulkActionSummary {
  const succeeded = results.filter((r) => r.ok).length;
  return {
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}

import { after } from "next/server";
import { prisma } from "@/lib/db";
import {
  tryAutoPayAfterAdminApproval,
  userCanReceivePayout,
} from "@/lib/admin-auto-payout";
import { adminApprovalQueueWhere } from "@/lib/claim-decide-access";
import { paymentWaitingWhereForSession } from "@/lib/claim-payment-queue";
import { payClaimInBackground } from "@/lib/pay-claim-background";
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
  branchId?: string | null;
}) {
  const where = paymentWaitingWhereForSession(session);
  if (!where) return 0;
  return prisma.reimbursement.count({ where });
}

export async function countAdminPendingApproval() {
  return prisma.reimbursement.count({
    where: adminApprovalQueueWhere(),
  });
}

export async function bulkPayClaimIds(
  session: { id: string; role: string; branchId?: string | null },
  claimIds: string[],
): Promise<BulkActionSummary | { error: string }> {
  if (claimIds.length === 0) {
    return { error: "Select at least one reimbursement to pay." };
  }

  const where = paymentWaitingWhereForSession(session);
  if (!where) {
    return { error: "Your role cannot run bulk payment." };
  }

  const razorpay = getRazorpayConfig();
  if (!razorpay.enabled) {
    return {
      error:
        "RazorpayX is not configured. Add API keys or VPS relay settings on Vercel.",
    };
  }

  const claims = await prisma.reimbursement.findMany({
    where: { AND: [where, { id: { in: claimIds } }] },
    orderBy: { decidedAt: "asc" },
    include: { employee: { select: employeeForPayoutSelect } },
  });

  if (claims.length !== claimIds.length) {
    return {
      error:
        "Some selections are no longer in the payment queue. Refresh the page and try again.",
    };
  }

  const payable = claims.filter((claim) => userCanReceivePayout(claim.employee));
  const blocked = claims.filter((claim) => !userCanReceivePayout(claim.employee));

  const results: BulkItemResult[] = blocked.map((claim) => ({
    claimId: claim.id,
    employeeName: claim.employeeName,
    ok: false,
    error: "Missing name or bank details on profile",
  }));

  if (payable.length === 0) {
    return summarize(results);
  }

  const actorId = session.id;
  const payableIds = payable.map((claim) => claim.id);
  after(async () => {
    for (const claimId of payableIds) {
      await payClaimInBackground(claimId, actorId);
    }
  });

  results.push(
    ...payable.map((claim) => ({
      claimId: claim.id,
      employeeName: claim.employeeName,
      ok: true as const,
    })),
  );

  return summarize(results);
}

/** Pay every claim in the payment queue (legacy / tests). */
export async function bulkPayPaymentQueue(session: {
  id: string;
  role: string;
}): Promise<BulkActionSummary | { error: string }> {
  const where = paymentWaitingWhereForSession(session);
  if (!where) {
    return { error: "Your role cannot run bulk payment." };
  }
  const claims = await prisma.reimbursement.findMany({
    where,
    select: { id: true },
  });
  return bulkPayClaimIds(
    session,
    claims.map((c) => c.id),
  );
}

export async function bulkAdminApproveClaimIds(
  adminId: string,
  claimIds: string[],
): Promise<BulkActionSummary | { error: string }> {
  if (claimIds.length === 0) {
    return { error: "Select at least one reimbursement to approve." };
  }

  const claims = await prisma.reimbursement.findMany({
    where: {
      AND: [adminApprovalQueueWhere(), { id: { in: claimIds } }],
    },
    orderBy: { createdAt: "asc" },
    include: {
      employee: { select: { role: true, ...employeeForPayoutSelect } },
      approver: { select: { role: true } },
    },
  });

  if (claims.length !== claimIds.length) {
    return {
      error:
        "Some selections are no longer waiting for approval. Refresh the page and try again.",
    };
  }

  const results: BulkItemResult[] = [];
  const approvedIds: string[] = [];

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
      approvedIds.push(claim.id);
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

  if (approvedIds.length > 0) {
    after(async () => {
      for (const claimId of approvedIds) {
        const payoutResult = await tryAutoPayAfterAdminApproval(claimId, adminId);
        if (!payoutResult.ok && "error" in payoutResult) {
          console.error("background payout after bulk admin approval failed", {
            claimId,
            error: payoutResult.error,
          });
        }
      }
    });
  }

  return summarize(results);
}

/** Approve every claim in the admin queue (legacy / tests). */
export async function bulkAdminApproveQueue(
  adminId: string,
): Promise<BulkActionSummary> {
  const claims = await prisma.reimbursement.findMany({
    where: adminApprovalQueueWhere(),
    select: { id: true },
  });
  const result = await bulkAdminApproveClaimIds(
    adminId,
    claims.map((c) => c.id),
  );
  if ("error" in result) {
    return { total: 0, succeeded: 0, failed: 0, results: [] };
  }
  return result;
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

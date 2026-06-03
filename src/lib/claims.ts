import type { Prisma } from "@prisma/client";
import { receiptViewUrl } from "@/lib/receipt-url";

const employeeSelect = {
  id: true,
  name: true,
  phone: true,
  role: true,
} as const;

export const claimInclude = {
  employee: { select: employeeSelect },
  approver: { select: { id: true, name: true, phone: true, role: true } },
  paymentApprover: { select: { id: true, name: true, phone: true, role: true } },
  branch: { select: { id: true, name: true, active: true } },
  receipts: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ReimbursementInclude;

export const claimListInclude = {
  employee: { select: employeeSelect },
  approver: { select: { id: true, name: true, phone: true, role: true } },
  paymentApprover: { select: { id: true, name: true, phone: true, role: true } },
  branch: { select: { id: true, name: true, active: true } },
  _count: { select: { receipts: true } },
} satisfies Prisma.ReimbursementInclude;

export type ClaimWithRelations = Prisma.ReimbursementGetPayload<{
  include: typeof claimInclude;
}>;

export type ClaimListItem = Prisma.ReimbursementGetPayload<{
  include: typeof claimListInclude;
}>;

function serializeClaimCore(
  claim: ClaimWithRelations | ClaimListItem,
  receipts: { id: string; url: string; fileName: string | null; mimeType: string }[],
  receiptCount: number,
) {
  return {
    id: claim.id,
    employeeId: claim.employeeId,
    employeeName: claim.employeeName,
    employee: claim.employee,
    amount: Number(claim.amount),
    category: claim.category,
    description: claim.description,
    expenseDate: claim.expenseDate.toISOString(),
    branchId: claim.branchId,
    branch: claim.branch,
    status: claim.status,
    rejectionReason: claim.rejectionReason,
    decidedAt: claim.decidedAt?.toISOString() ?? null,
    razorpayPayoutId: claim.razorpayPayoutId,
    payoutStatus: claim.payoutStatus,
    payoutUtr: claim.payoutUtr,
    payoutError: claim.payoutError,
    payoutInitiatedAt: claim.payoutInitiatedAt?.toISOString() ?? null,
    paidAt: claim.paidAt?.toISOString() ?? null,
    approverId: claim.approverId,
    approver: claim.approver,
    paymentApproverId: claim.paymentApproverId,
    paymentApprover: claim.paymentApprover,
    refiledFromId: claim.refiledFromId,
    receipts,
    receiptCount,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  };
}

export function serializeClaim(claim: ClaimWithRelations) {
  const receipts = claim.receipts.map((receipt) => ({
    id: receipt.id,
    url: receiptViewUrl(receipt.id),
    fileName: receipt.fileName,
    mimeType: receipt.mimeType,
  }));
  return serializeClaimCore(claim, receipts, receipts.length);
}

/** List views — skips receipt file payloads (can be large data URLs). */
export function serializeClaimListItem(claim: ClaimListItem) {
  const receiptCount = claim._count.receipts;
  return serializeClaimCore(claim, [], receiptCount);
}

import type { Prisma } from "@prisma/client";
import { receiptClientUrl } from "@/lib/receipt-url";

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

/** Approvals queue — includes branch for detail popup without an extra join on receipts. */
export const claimPendingListInclude = {
  employee: { select: employeeSelect },
  approver: { select: { id: true, name: true, phone: true, role: true } },
  paymentApprover: { select: { id: true, name: true, phone: true, role: true } },
  branch: { select: { id: true, name: true, active: true } },
  _count: { select: { receipts: true } },
} satisfies Prisma.ReimbursementInclude;

/** Manager / payment queue lists — no user/branch joins. */
export const claimQueueSelect = {
  id: true,
  employeeId: true,
  employeeName: true,
  amount: true,
  category: true,
  description: true,
  expenseDate: true,
  branchId: true,
  status: true,
  rejectionReason: true,
  decidedAt: true,
  razorpayPayoutId: true,
  payoutStatus: true,
  payoutUtr: true,
  payoutError: true,
  payoutInitiatedAt: true,
  paidAt: true,
  approverId: true,
  paymentApproverId: true,
  refiledFromId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { receipts: true } },
} satisfies Prisma.ReimbursementSelect;

export type ClaimWithRelations = Prisma.ReimbursementGetPayload<{
  include: typeof claimInclude;
}>;

export type ClaimListItem = Prisma.ReimbursementGetPayload<{
  include: typeof claimListInclude;
}>;

export type ClaimPendingListItem = Prisma.ReimbursementGetPayload<{
  include: typeof claimPendingListInclude;
}>;

export type ClaimQueueRow = Prisma.ReimbursementGetPayload<{
  select: typeof claimQueueSelect;
}>;

const missingPerson = {
  id: "",
  name: null as string | null,
  phone: "",
  role: "EMPLOYEE",
};

const missingBranch = {
  id: "",
  name: "",
  active: true,
};

function serializeClaimCore(
  claim: ClaimWithRelations | ClaimListItem,
  receipts: { id: string; url: string; fileName: string | null; mimeType: string }[],
  receiptCount: number,
) {
  return {
    id: claim.id,
    employeeId: claim.employeeId,
    employeeName: claim.employeeName,
    employee: claim.employee ?? { ...missingPerson, id: claim.employeeId },
    amount: Number(claim.amount),
    category: claim.category,
    description: claim.description,
    expenseDate: claim.expenseDate.toISOString(),
    branchId: claim.branchId,
    branch: claim.branch ?? { ...missingBranch, id: claim.branchId },
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
    approver: claim.approver ?? { ...missingPerson, id: claim.approverId, role: "BRANCH_MANAGER" },
    paymentApproverId: claim.paymentApproverId,
    paymentApprover: claim.paymentApprover ?? {
      ...missingPerson,
      id: claim.paymentApproverId,
      role: "APPROVER",
    },
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
    url: receiptClientUrl({ id: receipt.id, filePath: receipt.filePath }),
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

/** Manager / payment approver pending and approved queues. */
export function serializeClaimPendingListItem(claim: ClaimPendingListItem) {
  const receiptCount = claim._count.receipts;
  return serializeClaimCore(claim, [], receiptCount);
}

const queueRelationStub = {
  name: null as string | null,
  phone: "",
};

/** Approval / payment queue tables — minimal payload; detail modal loads full claim. */
export function serializeClaimQueueItem(claim: ClaimQueueRow) {
  const receiptCount = claim._count.receipts;
  return {
    id: claim.id,
    employeeId: claim.employeeId,
    employeeName: claim.employeeName,
    employee: {
      id: claim.employeeId,
      ...queueRelationStub,
      role: "EMPLOYEE",
    },
    amount: Number(claim.amount),
    category: claim.category,
    description: claim.description,
    expenseDate: claim.expenseDate.toISOString(),
    branchId: claim.branchId,
    branch: { id: claim.branchId, name: "", active: true },
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
    approver: {
      id: claim.approverId,
      ...queueRelationStub,
      role: "BRANCH_MANAGER",
    },
    paymentApproverId: claim.paymentApproverId,
    paymentApprover: {
      id: claim.paymentApproverId,
      ...queueRelationStub,
      role: "APPROVER",
    },
    refiledFromId: claim.refiledFromId,
    receipts: [],
    receiptCount,
    queueList: true as const,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  };
}

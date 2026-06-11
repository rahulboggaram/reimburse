import type { SerializedClaim } from "@/lib/claim-types";
import { claimsMineCacheKey } from "@/lib/claims-cache";
import { readClientCache, writeClientCache } from "@/lib/client-cache";

const CACHE_TTL_MS = 5 * 60 * 1000;
const PENDING_EVENT = "pending-claims-changed";

export type PendingClaimSubmit = {
  tempId: string;
  userId: string;
  amount: number;
  category: string;
  description: string;
  branchId: string;
  branchName: string;
  employeeName: string;
  employeePhone: string;
  employeeRole: string;
  receiptCount: number;
  claimStatus: "PENDING" | "APPROVED";
  state: "uploading" | "failed";
  error?: string;
  submittedAt: number;
};

function storageKey(userId: string) {
  return `reimburse-pending-claims:${userId}`;
}

function readAll(userId: string): PendingClaimSubmit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as PendingClaimSubmit[];
  } catch {
    return [];
  }
}

function writeAll(userId: string, rows: PendingClaimSubmit[]) {
  if (typeof window === "undefined") return;
  try {
    if (rows.length === 0) {
      sessionStorage.removeItem(storageKey(userId));
    } else {
      sessionStorage.setItem(storageKey(userId), JSON.stringify(rows));
    }
    window.dispatchEvent(new Event(PENDING_EVENT));
  } catch {
    // ignore quota errors
  }
}

export function subscribePendingClaims(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PENDING_EVENT, listener);
  return () => window.removeEventListener(PENDING_EVENT, listener);
}

export function readPendingClaimSubmits(userId: string) {
  return readAll(userId).filter(
    (row) => row.state === "uploading" || row.state === "failed",
  );
}

export function clearFailedClaimSubmit(userId: string, tempId?: string) {
  writeAll(
    userId,
    readAll(userId).filter((row) => {
      if (row.state !== "failed") return true;
      if (!tempId) return false;
      return row.tempId !== tempId;
    }),
  );
}

export function registerPendingClaimSubmit(row: PendingClaimSubmit) {
  const existing = readAll(row.userId).filter((item) => item.tempId !== row.tempId);
  writeAll(row.userId, [row, ...existing]);
}

export function resolvePendingClaimSubmit(userId: string, tempId: string) {
  writeAll(
    userId,
    readAll(userId).filter((item) => item.tempId !== tempId),
  );
}

export function failPendingClaimSubmit(
  userId: string,
  tempId: string,
  error: string,
) {
  writeAll(
    userId,
    readAll(userId).map((item) =>
      item.tempId === tempId
        ? { ...item, state: "failed" as const, error }
        : item,
    ),
  );
}

function personStub(input: {
  id: string;
  name: string;
  phone: string;
  role: string;
}) {
  return {
    id: input.id,
    name: input.name,
    phone: input.phone,
    role: input.role,
  };
}

export function buildOptimisticClaim(input: PendingClaimSubmit): SerializedClaim {
  const now = new Date(input.submittedAt).toISOString();
  const employee = personStub({
    id: input.userId,
    name: input.employeeName,
    phone: input.employeePhone,
    role: input.employeeRole,
  });

  return {
    id: input.tempId,
    employeeId: input.userId,
    employeeName: input.employeeName,
    employee,
    amount: input.amount,
    category: input.category,
    description: input.description,
    expenseDate: now,
    branchId: input.branchId,
    branch: { id: input.branchId, name: input.branchName, active: true },
    status: input.claimStatus,
    rejectionReason: null,
    decidedAt: input.claimStatus === "APPROVED" ? now : null,
    razorpayPayoutId: null,
    payoutStatus: null,
    payoutUtr: null,
    payoutError: null,
    payoutInitiatedAt: null,
    paidAt: null,
    approverId: input.userId,
    approver: employee,
    paymentApproverId: input.userId,
    paymentApprover: employee,
    refiledFromId: null,
    receipts: [],
    receiptCount: input.receiptCount,
    createdAt: now,
    updatedAt: now,
    submitting: input.state === "uploading",
    submitError: input.state === "failed" ? (input.error ?? "Could not submit claim.") : null,
  };
}

export function prependOptimisticClaimToCache(
  userId: string,
  pending: PendingClaimSubmit,
) {
  const key = claimsMineCacheKey(userId);
  const cached = readClientCache<SerializedClaim[]>(key) ?? [];
  const optimistic = buildOptimisticClaim(pending);
  writeClientCache(
    key,
    [optimistic, ...cached.filter((row) => row.id !== pending.tempId)],
    CACHE_TTL_MS,
  );
}

export function mergeClaimsWithPending(
  claims: SerializedClaim[],
  pending: PendingClaimSubmit[],
): SerializedClaim[] {
  if (pending.length === 0) return claims;
  const pendingIds = new Set(pending.map((row) => row.tempId));
  const withoutDupes = claims.filter((claim) => !pendingIds.has(claim.id));
  return [
    ...pending.map((row) => buildOptimisticClaim(row)),
    ...withoutDupes,
  ];
}

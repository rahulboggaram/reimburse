import type { PrismaClient } from "@prisma/client";

export function istDayBounds(now = new Date()) {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  const start = new Date(
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) -
      istOffsetMs,
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function isWorkingReceiptPath(filePath: string) {
  const path = filePath.trim();
  if (!path) return false;
  if (path.startsWith("data:")) return false;
  if (path.startsWith("/uploads/")) return false;
  return path.includes("/");
}

export type TodayClaimRow = {
  id: string;
  createdAt: Date;
  amount: number;
  category: string;
  employeeName: string;
  status: string;
  receipts: { id: string; filePath: string }[];
};

export function summarizeTodayClaims(claims: TodayClaimRow[]) {
  return claims.map((claim) => {
    const workingReceipts = claim.receipts.filter((receipt) =>
      isWorkingReceiptPath(receipt.filePath),
    );
    return {
      id: claim.id,
      createdAt: claim.createdAt.toISOString(),
      amount: claim.amount,
      category: claim.category,
      employeeName: claim.employeeName,
      status: claim.status,
      receiptCount: claim.receipts.length,
      workingReceiptCount: workingReceipts.length,
      hasWorkingReceipts: workingReceipts.length > 0,
    };
  });
}

export function pickClaimToKeep(claims: TodayClaimRow[]) {
  const withWorking = claims.filter((claim) =>
    claim.receipts.some((receipt) => isWorkingReceiptPath(receipt.filePath)),
  );
  if (withWorking.length === 0) return null;
  return withWorking.reduce((latest, claim) =>
    claim.createdAt > latest.createdAt ? claim : latest,
  );
}

export async function previewTodayTestClaimCleanup(prisma: PrismaClient) {
  const { start, end } = istDayBounds();
  const claims = await prisma.reimbursement.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      amount: true,
      category: true,
      employeeName: true,
      status: true,
      receipts: { select: { id: true, filePath: true } },
    },
  });

  const normalized: TodayClaimRow[] = claims.map((claim) => ({
    ...claim,
    amount: Number(claim.amount),
  }));

  const keep = pickClaimToKeep(normalized);
  const toDelete = keep
    ? normalized.filter((claim) => claim.id !== keep.id)
    : normalized;

  return {
    istDayStart: start.toISOString(),
    istDayEnd: end.toISOString(),
    totalToday: normalized.length,
    keep: keep
      ? {
          id: keep.id,
          createdAt: keep.createdAt.toISOString(),
          amount: Number(keep.amount),
          category: keep.category,
          employeeName: keep.employeeName,
          status: keep.status,
        }
      : null,
    toDelete: toDelete.map((claim) => ({
      id: claim.id,
      createdAt: claim.createdAt.toISOString(),
      amount: Number(claim.amount),
      category: claim.category,
      employeeName: claim.employeeName,
      status: claim.status,
      receiptCount: claim.receipts.length,
    })),
    claims: summarizeTodayClaims(normalized),
  };
}

export async function executeTodayTestClaimCleanup(prisma: PrismaClient) {
  const preview = await previewTodayTestClaimCleanup(prisma);
  if (!preview.keep) {
    return {
      ...preview,
      deletedCount: 0,
      error:
        "No claim from today has working receipt photos in storage. Nothing was deleted.",
    };
  }
  if (preview.toDelete.length === 0) {
    return { ...preview, deletedCount: 0 };
  }

  const deleteIds = preview.toDelete.map((claim) => claim.id);
  const deleted = await prisma.reimbursement.deleteMany({
    where: { id: { in: deleteIds } },
  });

  return { ...preview, deletedCount: deleted.count };
}

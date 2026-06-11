import type { ReimbursementStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/access-roles";
import {
  activityCreatedSinceFilter,
  claimCreatedSinceFilter,
  productionDataSince,
} from "@/lib/production-go-live";

export type AnalyticsDayPoint = {
  date: string;
  claims: number;
  claimAmount: number;
  logins: number;
};

export type AnalyticsLabelCount = {
  label: string;
  count: number;
  amount: number;
};

export type AdminAnalytics = {
  rangeDays: number;
  generatedAt: string;
  users: {
    total: number;
    active: number;
    newInPeriod: number;
    byRole: { role: UserRole; label: string; count: number }[];
  };
  claims: {
    totalAllTime: number;
    submittedInPeriod: number;
    pendingNow: number;
    byStatus: { status: ReimbursementStatus; count: number }[];
    amountSubmittedInPeriod: number;
    amountPaidInPeriod: number;
    averageClaimAmount: number;
    approvalRatePercent: number | null;
    medianDaysToDecision: number | null;
  };
  usage: {
    loginsInPeriod: number;
    uniqueUsersLoggedIn: number;
    uniqueSubmittersInPeriod: number;
    claimsPerDay: AnalyticsDayPoint[];
  };
  topCategories: AnalyticsLabelCount[];
  topBranches: AnalyticsLabelCount[];
  topSubmitters: AnalyticsLabelCount[];
};

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function utcDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDayRange(days: number) {
  const end = startOfUtcDay(new Date());
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - offset);
    keys.push(utcDayKey(day));
  }
  const since = new Date(end);
  since.setUTCDate(end.getUTCDate() - (days - 1));
  return { since, keys };
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export async function getAdminAnalytics(
  rangeDays: number,
): Promise<AdminAnalytics> {
  const days = Math.min(Math.max(rangeDays, 7), 90);
  const { since: rangeSince, keys } = buildDayRange(days);
  const since = productionDataSince(rangeSince);
  const claimFilter = claimCreatedSinceFilter(since);
  const activityFilter = activityCreatedSinceFilter(since);
  const chartKeys = keys.filter((date) => new Date(`${date}T00:00:00.000Z`) >= since);
  const emptyDay = (date: string): AnalyticsDayPoint => ({
    date,
    claims: 0,
    claimAmount: 0,
    logins: 0,
  });

  // Run in small batches — Supabase pooler + serverless chokes on 15 parallel queries.
  const [usersTotal, usersActive, usersNew, usersByRole] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.groupBy({
      by: ["role"],
      where: { active: true },
      _count: { _all: true },
    }),
  ]);

  const [claimsTotal, claimsSubmittedCount, pendingNow, statusInPeriod] =
    await Promise.all([
      prisma.reimbursement.count({ where: claimCreatedSinceFilter() }),
      prisma.reimbursement.count({ where: claimFilter }),
      prisma.reimbursement.count({
        where: { status: "PENDING", ...claimCreatedSinceFilter() },
      }),
      prisma.reimbursement.groupBy({
        by: ["status"],
        where: claimFilter,
        _count: { _all: true },
      }),
    ]);

  const [amountSubmitted, amountPaid, loginEvents, claimsInPeriod] =
    await Promise.all([
      prisma.reimbursement.aggregate({
        where: claimFilter,
        _sum: { amount: true },
        _avg: { amount: true },
      }),
      prisma.reimbursement.aggregate({
        where: {
          paidAt: { gte: since },
          ...claimCreatedSinceFilter(),
        },
        _sum: { amount: true },
      }),
      prisma.platformActivity.findMany({
        where: { type: "USER_LOGIN", ...activityFilter },
        select: { createdAt: true, actorId: true },
      }),
      prisma.reimbursement.findMany({
        where: claimFilter,
        select: {
          createdAt: true,
          amount: true,
          employeeId: true,
          status: true,
          decidedAt: true,
        },
      }),
    ]);

  const [topCategories, topBranches, topSubmittersById] = await Promise.all([
    prisma.reimbursement.groupBy({
      by: ["category"],
      where: claimFilter,
      _count: { _all: true },
      _sum: { amount: true },
      orderBy: { _count: { category: "desc" } },
      take: 6,
    }),
    prisma.reimbursement.groupBy({
      by: ["branchId"],
      where: claimFilter,
      _count: { _all: true },
      _sum: { amount: true },
      orderBy: { _count: { branchId: "desc" } },
      take: 6,
    }),
    prisma.reimbursement.groupBy({
      by: ["employeeId"],
      where: claimFilter,
      _count: { _all: true },
      _sum: { amount: true },
      orderBy: { _count: { employeeId: "desc" } },
      take: 6,
    }),
  ]);

  const submitterIds = topSubmittersById.map((row) => row.employeeId);
  const submitterNameRows =
    submitterIds.length > 0
      ? await prisma.reimbursement.findMany({
          where: { employeeId: { in: submitterIds } },
          select: { employeeId: true, employeeName: true },
          orderBy: { createdAt: "desc" },
          distinct: ["employeeId"],
        })
      : [];
  const submitterNameById = new Map(
    submitterNameRows.map((row) => [row.employeeId, row.employeeName]),
  );
  const topSubmitters = topSubmittersById.map((row) => ({
    employeeId: row.employeeId,
    employeeName: submitterNameById.get(row.employeeId) ?? "Unknown",
    _count: row._count,
    _sum: row._sum,
  }));

  const dayMap = new Map(
    chartKeys.map((date) => [
      date,
      { date, claims: 0, claimAmount: 0, logins: 0 },
    ]),
  );

  for (const claim of claimsInPeriod) {
    const key = utcDayKey(claim.createdAt);
    const bucket = dayMap.get(key);
    if (!bucket) continue;
    bucket.claims += 1;
    bucket.claimAmount += Number(claim.amount);
  }

  const loginUserIds = new Set<string>();
  for (const login of loginEvents) {
    const key = utcDayKey(login.createdAt);
    const bucket = dayMap.get(key);
    if (bucket) bucket.logins += 1;
    if (login.actorId) loginUserIds.add(login.actorId);
  }

  const decisionDays: number[] = [];
  let decidedCount = 0;
  let approvedCount = 0;
  const uniqueSubmitterIds = new Set<string>();

  for (const claim of claimsInPeriod) {
    uniqueSubmitterIds.add(claim.employeeId);
    if (claim.decidedAt) {
      decidedCount += 1;
      const ms = claim.decidedAt.getTime() - claim.createdAt.getTime();
      if (ms >= 0) decisionDays.push(ms / (1000 * 60 * 60 * 24));
      if (claim.status === "APPROVED" || claim.status === "PAID") {
        approvedCount += 1;
      }
    }
  }

  const branchIds = topBranches.map((row) => row.branchId);
  const branchNames =
    branchIds.length > 0
      ? await prisma.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true },
        })
      : [];
  const branchNameById = new Map(branchNames.map((b) => [b.id, b.name]));

  const amountSubmittedNum = Number(amountSubmitted._sum.amount ?? 0);
  const amountPaidNum = Number(amountPaid._sum.amount ?? 0);

  return {
    rangeDays: days,
    generatedAt: new Date().toISOString(),
    users: {
      total: usersTotal,
      active: usersActive,
      newInPeriod: usersNew,
      byRole: usersByRole
        .map((row) => ({
          role: row.role,
          label: ROLE_LABELS[row.role],
          count: row._count._all,
        }))
        .sort((a, b) => b.count - a.count),
    },
    claims: {
      totalAllTime: claimsTotal,
      submittedInPeriod: claimsSubmittedCount,
      pendingNow,
      byStatus: statusInPeriod.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      amountSubmittedInPeriod: amountSubmittedNum,
      amountPaidInPeriod: amountPaidNum,
      averageClaimAmount: Number(amountSubmitted._avg.amount ?? 0),
      approvalRatePercent:
        decidedCount > 0
          ? Math.round((approvedCount / decidedCount) * 100)
          : null,
      medianDaysToDecision: median(decisionDays),
    },
    usage: {
      loginsInPeriod: loginEvents.length,
      uniqueUsersLoggedIn: loginUserIds.size,
      uniqueSubmittersInPeriod: uniqueSubmitterIds.size,
      claimsPerDay: chartKeys.map((date) => dayMap.get(date) ?? emptyDay(date)),
    },
    topCategories: topCategories.map((row) => ({
      label: row.category,
      count: row._count._all,
      amount: Number(row._sum.amount ?? 0),
    })),
    topBranches: topBranches.map((row) => ({
      label: branchNameById.get(row.branchId) ?? "Unknown",
      count: row._count._all,
      amount: Number(row._sum.amount ?? 0),
    })),
    topSubmitters: topSubmitters.map((row) => ({
      label: row.employeeName ?? "Unknown",
      count: row._count._all,
      amount: Number(row._sum.amount ?? 0),
    })),
  };
}

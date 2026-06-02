import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/dates";
import { formatPhoneDisplay } from "@/lib/phone";
import {
  buildActivityReportCsv,
  buildPermissionsReportCsv,
  buildReimbursementsReportCsv,
  buildTransactionsReportCsv,
} from "@/lib/report-csv";
import {
  createdAtFilter,
  parseReportDateRange,
  PERMISSION_ACTIVITY_TYPES,
  reportFilename,
  TRANSACTION_ACTIVITY_TYPES,
  type DateRangeFilter,
  type ReportType,
} from "@/lib/reports";

function actorName(user: { name: string | null; phone: string } | null) {
  if (!user) return "—";
  return user.name ?? formatPhoneDisplay(user.phone);
}

function serializeActivity(
  activity: Prisma.PlatformActivityGetPayload<{
    include: {
      actor: { select: { name: true; phone: true } };
      targetUser: { select: { name: true; phone: true } };
    };
  }>,
) {
  return {
    summary: activity.summary,
    type: activity.type,
    createdAt: formatDisplayDateTime(activity.createdAt),
    actorName: actorName(activity.actor),
    targetName: actorName(activity.targetUser),
  };
}

function inRange(date: Date | null | undefined, range: DateRangeFilter) {
  if (!date) return false;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

export async function GET(request: Request) {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as ReportType | null;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (
    !type ||
    !["reimbursements", "activity", "permissions", "transactions"].includes(type)
  ) {
    return Response.json({ error: "Invalid report type." }, { status: 400 });
  }

  const parsedRange = parseReportDateRange({ from: fromParam, to: toParam });
  if (parsedRange instanceof Response) return parsedRange;

  const range = parsedRange;
  const createdFilter = createdAtFilter(range);
  const generatedAt = formatDisplayDateTime(new Date());
  const from = fromParam ? formatDisplayDate(fromParam) : undefined;
  const to = toParam ? formatDisplayDate(toParam) : undefined;

  if (type === "reimbursements") {
    const claims = await prisma.reimbursement.findMany({
      where: createdFilter ? { createdAt: createdFilter } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        employee: { select: { phone: true } },
        approver: { select: { name: true } },
        receipts: { select: { id: true } },
      },
    });

    const csv = buildReimbursementsReportCsv({
      generatedAt,
      from,
      to,
      claims: claims.map((claim) => ({
        employeeName: claim.employeeName,
        employeePhone: formatPhoneDisplay(claim.employee.phone),
        category: claim.category,
        amount: Number(claim.amount),
        expenseDate: formatDisplayDate(claim.expenseDate),
        status: claim.status,
        description: claim.description,
        approverName: claim.approver.name ?? "—",
        rejectionReason: claim.rejectionReason,
        receiptCount: claim.receipts.length,
        submittedAt: formatDisplayDateTime(claim.createdAt),
        decidedAt: claim.decidedAt ? formatDisplayDateTime(claim.decidedAt) : "",
        paidAt: claim.paidAt ? formatDisplayDateTime(claim.paidAt) : "",
        payoutUtr: claim.payoutUtr ?? "",
      })),
    });

    return csvResponse(csv, reportFilename(type, from, to));
  }

  if (type === "activity") {
    const activities = await prisma.platformActivity.findMany({
      where: createdFilter ? { createdAt: createdFilter } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { name: true, phone: true } },
        targetUser: { select: { name: true, phone: true } },
      },
    });

    const csv = buildActivityReportCsv({
      generatedAt,
      from,
      to,
      activities: activities.map(serializeActivity),
    });

    return csvResponse(csv, reportFilename(type, from, to));
  }

  if (type === "permissions") {
    const activities = await prisma.platformActivity.findMany({
      where: {
        type: { in: [...PERMISSION_ACTIVITY_TYPES] },
        ...(createdFilter ? { createdAt: createdFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { name: true, phone: true } },
        targetUser: { select: { name: true, phone: true } },
      },
    });

    const csv = buildPermissionsReportCsv({
      generatedAt,
      from,
      to,
      activities: activities.map(serializeActivity),
    });

    return csvResponse(csv, reportFilename(type, from, to));
  }

  const [claims, payoutActivities] = await Promise.all([
    prisma.reimbursement.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        employee: { select: { phone: true } },
      },
    }),
    prisma.platformActivity.findMany({
      where: {
        type: { in: [...TRANSACTION_ACTIVITY_TYPES] },
        ...(createdFilter ? { createdAt: createdFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { name: true, phone: true } },
        targetUser: { select: { name: true, phone: true } },
      },
    }),
  ]);

  const rows: Array<{
    sortAt: number;
    when: string;
    event: string;
    employeeName: string;
    amount: string;
    status: string;
    reference: string;
    detail: string;
  }> = [];

  for (const claim of claims) {
    if (inRange(claim.createdAt, range)) {
      rows.push({
        sortAt: claim.createdAt.getTime(),
        when: formatDisplayDateTime(claim.createdAt),
        event: "Submitted",
        employeeName: claim.employeeName,
        amount: String(Number(claim.amount)),
        status: claim.status,
        reference: claim.id,
        detail: claim.category,
      });
    }

    if (claim.decidedAt && inRange(claim.decidedAt, range)) {
      rows.push({
        sortAt: claim.decidedAt.getTime(),
        when: formatDisplayDateTime(claim.decidedAt),
        event: claim.status === "REJECTED" ? "Rejected" : "Approved",
        employeeName: claim.employeeName,
        amount: String(Number(claim.amount)),
        status: claim.status,
        reference: claim.id,
        detail: claim.rejectionReason ?? claim.category,
      });
    }

    if (claim.paidAt && inRange(claim.paidAt, range)) {
      rows.push({
        sortAt: claim.paidAt.getTime(),
        when: formatDisplayDateTime(claim.paidAt),
        event: "Paid",
        employeeName: claim.employeeName,
        amount: String(Number(claim.amount)),
        status: "PAID",
        reference: claim.payoutUtr ?? claim.razorpayPayoutId ?? claim.id,
        detail: claim.category,
      });
    }
  }

  for (const activity of payoutActivities) {
    rows.push({
      sortAt: activity.createdAt.getTime(),
      when: formatDisplayDateTime(activity.createdAt),
      event: activity.type.replace("PAYOUT_", "").toLowerCase(),
      employeeName: actorName(activity.targetUser),
      amount: "",
      status: activity.type,
      reference: activity.id,
      detail: activity.summary,
    });
  }

  rows.sort((a, b) => b.sortAt - a.sortAt);

  const csv = buildTransactionsReportCsv({
    generatedAt,
    from,
    to,
    rows: rows.map(({ sortAt: _sortAt, ...row }) => row),
  });

  return csvResponse(csv, reportFilename(type, from, to));
}

function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

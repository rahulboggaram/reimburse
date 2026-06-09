import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import { displayName, logPlatformActivity } from "@/lib/activity-log";
import { normalizePhone, formatPhoneDisplay } from "@/lib/phone";
import { isReimbursementSubmitterRole } from "@/lib/access-roles";
import { branchHasPaymentApprover } from "@/lib/branch-staff";
import { adminCreateEmployeeSchema } from "@/lib/validators";
import { isProfileComplete } from "@/lib/user-profile";
import { userRoleRequiresBranch } from "@/lib/user-branch";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const employees = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      phone: true,
      name: true,
      ifscCode: true,
      bankAccountNumber: true,
      role: true,
      branchId: true,
      branch: { select: { name: true, active: true } },
      active: true,
      createdAt: true,
      _count: { select: { claimsSubmitted: true } },
    },
  });

  return Response.json(
    employees.map((user) => ({
      id: user.id,
      phone: user.phone,
      name: user.name,
      ifscCode: user.ifscCode,
      bankAccountNumber: user.bankAccountNumber,
      role: user.role,
      branchId: user.branchId,
      branchName: user.branch?.name ?? null,
      branchActive: user.branch?.active ?? null,
      active: user.active,
      signedUp: isProfileComplete(user),
      claimCount: user._count.claimsSubmitted,
      createdAt: user.createdAt.toISOString(),
    })),
  );
}

export async function POST(request: Request) {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const body = adminCreateEmployeeSchema.safeParse(await request.json());
  if (!body.success) {
    return Response.json(
      { error: "Enter a valid mobile number, role, and branch." },
      { status: 400 },
    );
  }

  const phone = normalizePhone(body.data.phone);
  if (!phone) {
    return Response.json({ error: "Invalid mobile number" }, { status: 400 });
  }

  const role = body.data.role;
  const needsBranch = userRoleRequiresBranch(role);
  const branch = needsBranch
    ? await prisma.branch.findFirst({
        where: { id: body.data.branchId, active: true },
        select: { id: true, name: true },
      })
    : null;
  if (needsBranch && !branch) {
    return Response.json({ error: "Select an active branch." }, { status: 400 });
  }

  if (branch && isReimbursementSubmitterRole(role)) {
    const hasApprover = await branchHasPaymentApprover(branch.id);
    if (!hasApprover) {
      const assignId = body.data.assignPaymentApproverUserId;
      if (!assignId) {
        return Response.json(
          {
            error: `No payment approver assigned for ${branch.name} yet. Assign one to continue.`,
          },
          { status: 422 },
        );
      }

      const assignee = await prisma.user.findFirst({
        where: { id: assignId, active: true },
      });
      if (!assignee) {
        return Response.json(
          { error: "Could not assign payment approver." },
          { status: 400 },
        );
      }

      await prisma.user.update({
        where: { id: assignId },
        data: { role: "APPROVER", branchId: branch.id },
      });

      await logPlatformActivity({
        type: "APPROVER_ENABLED",
        actorId: session.id,
        targetUserId: assignId,
        summary: `${displayName(session.name, session.phone)} assigned ${displayName(assignee.name, assignee.phone)} as payment approver for ${branch.name}`,
      });
    }
  }

  const existing = await prisma.user.findUnique({ where: { phone } });

  if (existing) {
    if (existing.active) {
      return Response.json(
        { error: "This phone number is already on the people list." },
        { status: 409 },
      );
    }

    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        active: true,
        role,
        branchId: branch?.id ?? null,
      },
    });

    await logPlatformActivity({
      type: "USER_ADDED",
      actorId: session.id,
      targetUserId: user.id,
      summary: `${displayName(session.name, session.phone)} restored ${formatPhoneDisplay(phone)}`,
    });

    return Response.json(user, { status: 201 });
  }

  try {
    const user = await prisma.user.create({
      data: {
        phone,
        role,
        active: true,
        branchId: branch?.id ?? null,
      },
    });

    await logPlatformActivity({
      type: "USER_ADDED",
      actorId: session.id,
      targetUserId: user.id,
      summary: `${displayName(session.name, session.phone)} added ${formatPhoneDisplay(phone)}`,
    });

    return Response.json(user, { status: 201 });
  } catch {
    return Response.json(
      { error: "This phone number is already registered." },
      { status: 409 },
    );
  }
}

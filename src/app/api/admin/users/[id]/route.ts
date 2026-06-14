import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import { setSessionCookie, userToSession } from "@/lib/session";
import { displayName, logPlatformActivity } from "@/lib/activity-log";
import { formatRole } from "@/lib/access-roles";
import { userRoleRequiresBranch } from "@/lib/user-branch";
import { formatPhoneDisplay } from "@/lib/phone";
import { normalizeEmail } from "@/lib/email";
import { adminUpdateEmployeeSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const body = adminUpdateEmployeeSchema.safeParse(await request.json());
  if (!body.success) {
    return Response.json({ error: "Invalid update" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return Response.json({ error: "Employee not found" }, { status: 404 });
  }

  const nextRole = body.data.role ?? target.role;
  const nextBranchId =
    body.data.branchId !== undefined ? body.data.branchId : target.branchId;

  if (body.data.role !== "ADMIN" && id === session.id) {
    return Response.json(
      { error: "You cannot remove your own admin access." },
      { status: 400 },
    );
  }

  if (userRoleRequiresBranch(nextRole) && !nextBranchId) {
    return Response.json(
      {
        error:
          "Branch is required for employees, branch managers, admins, and payment approvers.",
      },
      { status: 400 },
    );
  }

  if (userRoleRequiresBranch(nextRole) && nextBranchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: nextBranchId, active: true },
      select: { id: true },
    });
    if (!branch) {
      return Response.json(
        { error: "Select an active branch before restoring access." },
        { status: 400 },
      );
    }
  }

  const reactivating = body.data.active === true && !target.active;

  let nextEmail = target.email;
  if (body.data.email !== undefined) {
    if (body.data.email === "") {
      nextEmail = null;
    } else {
      const normalized = normalizeEmail(body.data.email);
      if (!normalized) {
        return Response.json({ error: "Enter a valid email address." }, { status: 400 });
      }
      const taken = await prisma.user.findUnique({ where: { email: normalized } });
      if (taken && taken.id !== id) {
        return Response.json(
          { error: "This email is already used by someone else." },
          { status: 409 },
        );
      }
      nextEmail = normalized;
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      role: nextRole,
      branchId: nextBranchId,
      email: nextEmail,
      ...(body.data.active === true ? { active: true } : {}),
    },
  });

  const actorLabel = displayName(session.name, session.phone);
  const targetLabel = displayName(target.name, target.phone);
  const roleChanged = target.role !== nextRole;
  const branchChanged = target.branchId !== nextBranchId;
  const emailChanged = target.email !== nextEmail;

  if (reactivating) {
    await logPlatformActivity({
      type: "USER_ADDED",
      actorId: session.id,
      targetUserId: user.id,
      summary: `${actorLabel} restored ${formatPhoneDisplay(target.phone)}`,
    });
  } else if (roleChanged || branchChanged || emailChanged) {
    const parts: string[] = [];
    if (roleChanged) parts.push(`role to ${formatRole(nextRole)}`);
    if (branchChanged) parts.push(`branch assignment`);
    if (emailChanged) parts.push(`work email`);

    await logPlatformActivity({
      type: "PROFILE_UPDATED",
      actorId: session.id,
      targetUserId: user.id,
      summary: `${actorLabel} updated ${targetLabel}'s ${parts.join(" and ")}`,
    });
  }

  if (id === session.id) {
    await setSessionCookie(userToSession(user));
  }

  return Response.json(user);
}

/** Deactivates the user; reimbursements and activity history are never deleted. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  if (id === session.id) {
    return Response.json(
      { error: "You cannot remove your own account." },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id },
    data: { active: false },
  });

  await logPlatformActivity({
    type: "USER_REMOVED",
    actorId: session.id,
    targetUserId: user.id,
    summary: `${displayName(session.name, session.phone)} removed ${displayName(user.name, user.phone)}`,
  });

  return Response.json(user);
}

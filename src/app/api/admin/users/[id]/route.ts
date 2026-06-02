import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import { displayName, logPlatformActivity } from "@/lib/activity-log";
import { formatRole } from "@/lib/access-roles";
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

  if (body.data.role !== "ADMIN" && id === session.id) {
    return Response.json(
      { error: "You cannot remove your own admin access." },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role: body.data.role },
  });

  if (target.role !== body.data.role) {
    const actorLabel = displayName(session.name, session.phone);
    const targetLabel = displayName(target.name, target.phone);
    await logPlatformActivity({
      type: "PROFILE_UPDATED",
      actorId: session.id,
      targetUserId: user.id,
      summary: `${actorLabel} set ${targetLabel}'s role to ${formatRole(body.data.role)}`,
    });
  }

  return Response.json(user);
}

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

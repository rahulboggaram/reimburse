import { prisma } from "@/lib/db";
import { requireEmployeePortalAccess } from "@/lib/auth-api";
import { displayName, logPlatformActivity } from "@/lib/activity-log";
import {
  setSessionCookie,
  userToSession,
} from "@/lib/session";
import { employeeProfileSchema } from "@/lib/validators";
import { formatRole } from "@/lib/access-roles";
import { getAppHomePathForRole } from "@/lib/home-path";
import { isProfileComplete } from "@/lib/user-profile";

export async function GET() {
  const session = await requireEmployeePortalAccess();
  if (session instanceof Response) return session;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      name: true,
      ifscCode: true,
      bankAccountNumber: true,
      phone: true,
      role: true,
    },
  });

  return Response.json({
    ...user,
    accessRole: user ? formatRole(user.role) : "Employee",
  });
}

export async function PATCH(request: Request) {
  const session = await requireEmployeePortalAccess();
  if (session instanceof Response) return session;

  const body = employeeProfileSchema.safeParse(await request.json());
  if (!body.success) {
    return Response.json(
      { error: body.error.issues[0]?.message ?? "Invalid profile" },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
  });
  const wasComplete = isProfileComplete(existing);

  const user = await prisma.user.update({
    where: { id: session.id },
    data: {
      name: body.data.name,
      ifscCode: body.data.ifscCode,
      bankAccountNumber: body.data.bankAccountNumber,
    },
  });

  const sessionUser = userToSession(user);
  await setSessionCookie(sessionUser);

  const isComplete = isProfileComplete(user);
  const label = displayName(user.name, user.phone);

  if (!wasComplete && isComplete) {
    await logPlatformActivity({
      type: "PROFILE_COMPLETED",
      actorId: user.id,
      targetUserId: user.id,
      summary: `${label} completed their profile`,
    });
  } else if (wasComplete) {
    await logPlatformActivity({
      type: "PROFILE_UPDATED",
      actorId: user.id,
      targetUserId: user.id,
      summary: `${label} updated bank details`,
    });
  }

  return Response.json({
    ok: true,
    user: sessionUser,
    redirectTo: getAppHomePathForRole(user.role),
  });
}

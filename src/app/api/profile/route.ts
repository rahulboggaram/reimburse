import { prisma } from "@/lib/db";
import { requireEmployeePortalAccess } from "@/lib/auth-api";
import { displayName, logPlatformActivity } from "@/lib/activity-log";
import { normalizeEmail } from "@/lib/email";
import {
  setSessionCookie,
  userToSession,
} from "@/lib/session";
import {
  employeeProfileSchema,
  profileEmailSchema,
  updateProfileSchema,
} from "@/lib/validators";
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
      email: true,
      ifscCode: true,
      bankAccountNumber: true,
      phone: true,
      role: true,
      branch: { select: { name: true } },
    },
  });

  return Response.json({
    ...user,
    accessRole: user ? formatRole(user.role) : "Employee",
    branchName: user?.branch?.name ?? null,
  });
}

export async function PATCH(request: Request) {
  const session = await requireEmployeePortalAccess();
  if (session instanceof Response) return session;

  const json = await request.json();
  const body = updateProfileSchema.safeParse(json);
  if (!body.success) {
    return Response.json(
      { error: body.error.issues[0]?.message ?? "Invalid profile" },
      { status: 400 },
    );
  }

  const emailOnly = profileEmailSchema.safeParse(json);
  if (emailOnly.success) {
    const normalized = normalizeEmail(emailOnly.data.email);
    if (!normalized) {
      return Response.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    const taken = await prisma.user.findUnique({ where: { email: normalized } });
    if (taken && taken.id !== session.id) {
      return Response.json(
        { error: "This email is already registered to someone else." },
        { status: 409 },
      );
    }

    const user = await prisma.user.update({
      where: { id: session.id },
      data: { email: normalized },
    });

    const sessionUser = userToSession(user);
    await setSessionCookie(sessionUser);

    await logPlatformActivity({
      type: "PROFILE_UPDATED",
      actorId: user.id,
      targetUserId: user.id,
      summary: `${displayName(user.name, user.phone)} updated login email`,
    });

    return Response.json({
      ok: true,
      user: sessionUser,
      email: user.email,
      redirectTo: getAppHomePathForRole(user.role),
    });
  }

  const profileBody = employeeProfileSchema.safeParse(json);
  if (!profileBody.success) {
    return Response.json(
      { error: profileBody.error.issues[0]?.message ?? "Invalid profile" },
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
      name: profileBody.data.name,
      ifscCode: profileBody.data.ifscCode,
      bankAccountNumber: profileBody.data.bankAccountNumber,
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

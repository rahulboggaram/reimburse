import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import { displayName, logPlatformActivity } from "@/lib/activity-log";
import { normalizePhone, formatPhoneDisplay } from "@/lib/phone";
import { adminCreateEmployeeSchema } from "@/lib/validators";
import { isProfileComplete } from "@/lib/user-profile";

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
    return Response.json({ error: "Enter a valid mobile number." }, { status: 400 });
  }

  const phone = normalizePhone(body.data.phone);
  if (!phone) {
    return Response.json({ error: "Invalid mobile number" }, { status: 400 });
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
        role: "EMPLOYEE",
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
        role: "EMPLOYEE",
        active: true,
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

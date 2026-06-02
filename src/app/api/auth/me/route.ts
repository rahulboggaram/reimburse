import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ user: null }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      phone: true,
      name: true,
      ifscCode: true,
      bankAccountNumber: true,
      role: true,
    },
  });

  if (!user) {
    return Response.json({ user: null }, { status: 401 });
  }

  return Response.json({
    user: {
      ...user,
      profileComplete: session.profileComplete,
    },
  });
}

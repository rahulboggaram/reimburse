import { requireSession } from "@/lib/auth-api";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await requireSession();
    if (session instanceof Response) return session;

    const [categories, user] = await Promise.all([
      prisma.expenseCategory.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: session.id },
        select: {
          branchId: true,
          branch: { select: { id: true, name: true, active: true } },
        },
      }),
    ]);

    const userBranch =
      user?.branchId && user.branch
        ? { id: user.branch.id, name: user.branch.name }
        : null;

    return Response.json(
      { categories, userBranch },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
        },
      },
    );
  } catch (err) {
    console.error("app/bootstrap failed", err);
    return Response.json(
      { error: "Could not load form options. Please refresh and try again." },
      { status: 500 },
    );
  }
}

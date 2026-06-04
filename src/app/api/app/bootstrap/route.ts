import { requireSession } from "@/lib/auth-api";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await requireSession();
  if (session instanceof Response) return session;

  const [branches, categories, user] = await Promise.all([
    prisma.branch.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.expenseCategory.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: session.id },
      select: { branchId: true },
    }),
  ]);

  return Response.json(
    { branches, categories, userBranchId: user?.branchId ?? null },
    {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    },
  );
}

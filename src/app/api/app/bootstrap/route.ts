import { requireSession } from "@/lib/auth-api";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await requireSession();
  if (session instanceof Response) return session;

  const [branches, categories] = await Promise.all([
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
  ]);

  return Response.json(
    { branches, categories },
    {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    },
  );
}

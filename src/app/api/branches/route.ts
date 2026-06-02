import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";

export async function GET() {
  const session = await requireSession();
  if (session instanceof Response) return session;

  const branches = await prisma.branch.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return Response.json(branches, {
    headers: { "Cache-Control": "private, max-age=120" },
  });
}


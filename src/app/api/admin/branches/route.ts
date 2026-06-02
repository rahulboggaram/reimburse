import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import { createBranchSchema } from "@/lib/validators";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const branches = await prisma.branch.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, active: true, createdAt: true },
  });

  return Response.json(branches);
}

export async function POST(request: Request) {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const json = await request.json().catch(() => null);
  const parsed = createBranchSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid branch details" }, { status: 400 });
  }

  try {
    const branch = await prisma.branch.create({
      data: { name: parsed.data.name },
      select: { id: true, name: true, active: true, createdAt: true },
    });
    return Response.json(branch, { status: 201 });
  } catch {
    return Response.json(
      { error: "Branch already exists or could not be created" },
      { status: 409 },
    );
  }
}


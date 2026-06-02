import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import { createExpenseCategorySchema } from "@/lib/validators";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const categories = await prisma.expenseCategory.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, active: true, createdAt: true },
  });

  return Response.json(categories);
}

export async function POST(request: Request) {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const json = await request.json().catch(() => null);
  const parsed = createExpenseCategorySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid category details" }, { status: 400 });
  }

  try {
    const category = await prisma.expenseCategory.create({
      data: { name: parsed.data.name },
      select: { id: true, name: true, active: true, createdAt: true },
    });
    return Response.json(category, { status: 201 });
  } catch {
    return Response.json(
      { error: "Category already exists or could not be created" },
      { status: 409 },
    );
  }
}


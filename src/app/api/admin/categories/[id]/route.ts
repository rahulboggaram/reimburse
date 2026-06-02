import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import { createExpenseCategorySchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const { id } = await context.params;
  const json = await request.json().catch(() => null);

  const name =
    json && typeof json.name === "string"
      ? createExpenseCategorySchema
          .pick({ name: true })
          .safeParse({ name: json.name })
      : null;
  const active =
    json && typeof json.active === "boolean" ? json.active : undefined;

  if (!name?.success && active === undefined) {
    return Response.json({ error: "No updates provided" }, { status: 400 });
  }

  try {
    const category = await prisma.expenseCategory.update({
      where: { id },
      data: {
        name: name?.success ? name.data.name : undefined,
        active,
      },
      select: { id: true, name: true, active: true, createdAt: true },
    });
    return Response.json(category);
  } catch {
    return Response.json({ error: "Could not update category" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const { id } = await context.params;
  try {
    await prisma.expenseCategory.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch {
    return Response.json(
      { error: "Could not delete category (may be in use)" },
      { status: 409 },
    );
  }
}


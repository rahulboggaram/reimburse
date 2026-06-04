import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import { deactivateBranch } from "@/lib/soft-deactivate";
import { createBranchSchema } from "@/lib/validators";

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
      ? createBranchSchema.pick({ name: true }).safeParse({ name: json.name })
      : null;
  const active =
    json && typeof json.active === "boolean" ? json.active : undefined;

  if (!name?.success && active === undefined) {
    return Response.json({ error: "No updates provided" }, { status: 400 });
  }

  try {
    const branch = await prisma.branch.update({
      where: { id },
      data: {
        name: name?.success ? name.data.name : undefined,
        active,
      },
      select: { id: true, name: true, active: true, createdAt: true },
    });
    return Response.json(branch);
  } catch {
    return Response.json({ error: "Could not update branch" }, { status: 400 });
  }
}

/** Deactivates the branch; past reimbursements and records are kept. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const { id } = await context.params;
  try {
    const branch = await deactivateBranch(id);
    return Response.json(branch);
  } catch {
    return Response.json({ error: "Branch not found" }, { status: 404 });
  }
}

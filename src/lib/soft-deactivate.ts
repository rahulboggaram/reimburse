import { prisma } from "@/lib/db";

/** Branches and categories are never hard-deleted — only deactivated. */
export async function deactivateBranch(id: string) {
  return prisma.branch.update({
    where: { id },
    data: { active: false },
    select: { id: true, name: true, active: true, createdAt: true },
  });
}

export async function deactivateExpenseCategory(id: string) {
  return prisma.expenseCategory.update({
    where: { id },
    data: { active: false },
    select: { id: true, name: true, active: true, createdAt: true },
  });
}

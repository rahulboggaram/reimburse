import type { z } from "zod";
import { createReimbursementSchema } from "@/lib/validators";

export function parseClaimFieldsFromFormData(
  formData: FormData,
): z.infer<typeof createReimbursementSchema> | null {
  const amount = Number.parseFloat(String(formData.get("amount") ?? ""));
  const branchId = String(formData.get("branchId") ?? "");
  const category = String(formData.get("category") ?? "");
  const description = String(formData.get("description") ?? "");

  const parsed = createReimbursementSchema.safeParse({
    amount,
    branchId,
    category,
    description,
  });

  if (!parsed.success) return null;
  return parsed.data;
}

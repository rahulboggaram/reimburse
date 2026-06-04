import type { z } from "zod";
import { createReimbursementFormSchema } from "@/lib/validators";

export function parseClaimFieldsFromFormData(
  formData: FormData,
): z.infer<typeof createReimbursementFormSchema> | null {
  const amount = Number.parseFloat(String(formData.get("amount") ?? ""));
  const category = String(formData.get("category") ?? "");
  const description = String(formData.get("description") ?? "");

  const parsed = createReimbursementFormSchema.safeParse({
    amount,
    category,
    description,
  });

  if (!parsed.success) return null;
  return parsed.data;
}

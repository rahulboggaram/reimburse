import type { ReceiptFileItem } from "@/components/receipt-upload-field";

export function buildClaimFormData(input: {
  amount: number;
  category: string;
  description: string;
  receipts: ReceiptFileItem[];
  clientSubmitId?: string;
}) {
  const formData = new FormData();
  formData.set("amount", String(input.amount));
  formData.set("category", input.category);
  formData.set("description", input.description);
  if (input.clientSubmitId) {
    formData.set("clientSubmitId", input.clientSubmitId);
  }
  for (const item of input.receipts) {
    formData.append("receipts", item.file);
  }
  return formData;
}

export function readClientSubmitId(formData: FormData): string | null {
  const raw = String(formData.get("clientSubmitId") ?? "").trim();
  if (!raw || raw.length > 80) return null;
  return raw;
}

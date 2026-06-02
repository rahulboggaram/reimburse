import type { SerializedClaim } from "@/lib/claim-types";

export function claimReceiptCount(claim: SerializedClaim): number {
  return claim.receiptCount ?? claim.receipts.length;
}

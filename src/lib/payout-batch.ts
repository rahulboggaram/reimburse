import { randomUUID } from "crypto";
import { isPayoutFailed, isPayoutSuccessful } from "@/lib/razorpayx";

export function createPayoutBatchId() {
  return `pb_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function sumClaimAmounts(claims: { amount: number | { toString(): string } }[]) {
  return claims.reduce((sum, claim) => sum + Number(claim.amount), 0);
}

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** Shared label for claims paid together in one Pay all run. */
export function describePayoutBatchStatus(
  statuses: (string | null | undefined)[],
): string {
  if (statuses.length === 0) return "empty";
  const failed = statuses.filter((s) => s && isPayoutFailed(s)).length;
  const paid = statuses.filter((s) => s && isPayoutSuccessful(s)).length;
  if (paid === statuses.length) return "paid";
  if (failed === statuses.length) return "failed";
  if (failed > 0) return "partial";
  return "in_progress";
}

export function payoutBatchStatusLabel(status: string) {
  switch (status) {
    case "paid":
      return "Batch paid";
    case "failed":
      return "Batch failed";
    case "partial":
      return "Batch partially paid";
    default:
      return "Batch in progress";
  }
}

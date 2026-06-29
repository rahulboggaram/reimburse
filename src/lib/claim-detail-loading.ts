import type { SerializedClaim } from "@/lib/claim-types";

export function claimDetailReady(claim: SerializedClaim) {
  return Boolean(claim.branch?.name?.trim());
}

/** True while claim detail should show skeletons instead of list-stub fields. */
export function isClaimDetailContentLoading(
  claim: SerializedClaim,
  loadingDetail: boolean,
) {
  if (claim.submitError || claim.id.startsWith("pending-")) return false;
  if (loadingDetail) return true;
  if (!claim.queueList) return false;
  return !claimDetailReady(claim);
}

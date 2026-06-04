import { readJson } from "@/lib/api";
import { fetchClientCache, readClientCache } from "@/lib/client-cache";
import { fetchMyClaims } from "@/lib/fetch-own-claims";
import { fetchFormBootstrap, warmAdminNavCaches } from "@/lib/admin-fetch";
import type { SerializedClaim } from "@/lib/claim-types";

type ActionCounts = {
  paymentWaiting: number;
  adminPending: number;
};

type TabPayload = {
  claims: SerializedClaim[];
  counts: ActionCounts | null;
};

function pendingCacheKey(tab: "waiting" | "approved") {
  return `claims-pending-${tab}`;
}

async function fetchPendingTab(
  tab: "waiting" | "approved",
): Promise<TabPayload> {
  const response = await fetch(`/api/claims/pending?tab=${tab}`);
  const data = await readJson<
    SerializedClaim[] | { claims: SerializedClaim[] }
  >(response);
  const claims = Array.isArray(data) ? data : data.claims;
  return { claims, counts: null };
}

function warmPendingTab(tab: "waiting" | "approved") {
  const key = pendingCacheKey(tab);
  if (readClientCache(key)) return;
  void fetchClientCache(key, () => fetchPendingTab(tab), 90_000);
}

/** Prefetch likely API responses when the account menu opens. */
export function warmNavCaches(user: {
  id: string;
  role: string;
  profileComplete: boolean;
}) {
  if (user.profileComplete) {
    void fetchMyClaims(user.id);
    void fetchFormBootstrap();
  }

  if (
    user.role === "ADMIN" ||
    user.role === "APPROVER" ||
    user.role === "BRANCH_MANAGER"
  ) {
    warmPendingTab("waiting");
    window.setTimeout(() => warmPendingTab("approved"), 2000);
  }

  if (user.role === "ADMIN") {
    warmAdminNavCaches();
  }
}

import { readJson } from "@/lib/api";
import { fetchClientCache, readClientCache } from "@/lib/client-cache";
import { fetchMyClaims } from "@/lib/fetch-own-claims";
import { warmAdminNavCaches } from "@/lib/admin-fetch";
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

function wantsPendingCounts(role: string) {
  return role === "ADMIN" || role === "APPROVER";
}

async function fetchPendingTab(
  tab: "waiting" | "approved",
  role: string,
): Promise<TabPayload> {
  const countsQuery = wantsPendingCounts(role) ? "&counts=1" : "";
  const response = await fetch(`/api/claims/pending?tab=${tab}${countsQuery}`);
  const data = await readJson<
    SerializedClaim[] | { claims: SerializedClaim[]; counts: ActionCounts }
  >(response);
  if (Array.isArray(data)) {
    return { claims: data, counts: null };
  }
  return { claims: data.claims, counts: data.counts };
}

function warmPendingTab(tab: "waiting" | "approved", role: string) {
  const key = pendingCacheKey(tab);
  if (readClientCache(key)) return;
  void fetchClientCache(key, () => fetchPendingTab(tab, role), 90_000);
}

/** Prefetch likely API responses when the account menu opens. */
export function warmNavCaches(user: {
  id: string;
  role: string;
  profileComplete: boolean;
}) {
  if (user.profileComplete) {
    void fetchMyClaims(user.id);
  }

  if (
    user.role === "ADMIN" ||
    user.role === "APPROVER" ||
    user.role === "BRANCH_MANAGER"
  ) {
    warmPendingTab("waiting", user.role);
    warmPendingTab("approved", user.role);
  }

  if (user.role === "ADMIN") {
    warmAdminNavCaches();
  }
}

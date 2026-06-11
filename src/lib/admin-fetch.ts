import { readJson } from "@/lib/api";
import { fetchClientCache, invalidateClientCache, readClientCache, writeClientCache } from "@/lib/client-cache";

export const ADMIN_USERS_KEY = "admin-users";
export const ADMIN_CLAIMS_KEY = "admin-claims";
export const ADMIN_BRANCHES_KEY = "admin-branches";
export const ADMIN_CATEGORIES_KEY = "admin-categories";
export const ADMIN_ACTIVITY_KEY = "admin-activity";
export const adminAnalyticsCacheKey = (days: number) =>
  `admin-analytics-${days}`;
export const FORM_BOOTSTRAP_KEY = "form-bootstrap";
const FORM_BOOTSTRAP_STORAGE_KEY = "reimburse-form-bootstrap";

const TTL_MS = 5 * 60 * 1000;
/** Categories and branch rarely change; admins invalidate this cache when they do. */
const FORM_BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000;

type FormBootstrapPayload = {
  categories: { id: string; name: string }[];
  userBranch: { id: string; name: string } | null;
  submitBlockReason?: string | null;
};

function readFormBootstrapFromStorage<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FORM_BOOTSTRAP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T; expiresAt: number };
    if (parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(FORM_BOOTSTRAP_STORAGE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeFormBootstrapToStorage<T>(data: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      FORM_BOOTSTRAP_STORAGE_KEY,
      JSON.stringify({ data, expiresAt: Date.now() + FORM_BOOTSTRAP_TTL_MS }),
    );
  } catch {
    // Ignore quota / private mode errors — memory cache still works.
  }
}

function clearFormBootstrapStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(FORM_BOOTSTRAP_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function persistFormBootstrap<T>(data: T) {
  writeClientCache(FORM_BOOTSTRAP_KEY, data, FORM_BOOTSTRAP_TTL_MS);
  writeFormBootstrapToStorage(data);
}

async function fetchFormBootstrapFromNetwork<T>() {
  const data = await fetch("/api/app/bootstrap", { cache: "no-store" }).then((r) =>
    readJson<T>(r),
  );
  persistFormBootstrap(data);
  return data;
}

export function fetchAdminUsers<T = unknown>() {
  return fetchClientCache<T>(ADMIN_USERS_KEY, () =>
    fetch("/api/admin/users").then((r) => readJson<T>(r)),
    TTL_MS,
  );
}

export function fetchAdminClaims<T = unknown>() {
  return fetchClientCache<T>(ADMIN_CLAIMS_KEY, () =>
    fetch("/api/admin/reimbursements").then((r) => readJson<T>(r)),
    TTL_MS,
  );
}

export function fetchAdminBranches<T = unknown>() {
  return fetchClientCache<T>(ADMIN_BRANCHES_KEY, () =>
    fetch("/api/admin/branches").then((r) => readJson<T>(r)),
    TTL_MS,
  );
}

export function fetchAdminCategories<T = unknown>() {
  return fetchClientCache<T>(ADMIN_CATEGORIES_KEY, () =>
    fetch("/api/admin/categories").then((r) => readJson<T>(r)),
    TTL_MS,
  );
}

export function fetchAdminActivity<T = unknown>() {
  return fetchClientCache<T>(ADMIN_ACTIVITY_KEY, () =>
    fetch("/api/admin/activity").then((r) => readJson<T>(r)),
    TTL_MS,
  );
}

export function fetchAdminAnalytics<T = unknown>(days = 30) {
  const key = adminAnalyticsCacheKey(days);
  return fetchClientCache<T>(
    key,
    () =>
      fetch(`/api/admin/analytics?days=${days}`).then((r) => readJson<T>(r)),
    60_000,
  );
}

export function readAdminUsersCache<T>() {
  return readClientCache<T>(ADMIN_USERS_KEY);
}

export function readAdminClaimsCache<T>() {
  return readClientCache<T>(ADMIN_CLAIMS_KEY);
}

export function readAdminBranchesCache<T>() {
  return readClientCache<T>(ADMIN_BRANCHES_KEY);
}

export function readAdminCategoriesCache<T>() {
  return readClientCache<T>(ADMIN_CATEGORIES_KEY);
}

export function readAdminActivityCache<T>() {
  return readClientCache<T>(ADMIN_ACTIVITY_KEY);
}

export function invalidateAdminUsers() {
  invalidateClientCache(ADMIN_USERS_KEY);
}

export function invalidateAdminBranches() {
  invalidateClientCache(ADMIN_BRANCHES_KEY);
}

export function invalidateAdminCategories() {
  invalidateClientCache(ADMIN_CATEGORIES_KEY);
}

export function invalidateAdminClaims() {
  invalidateClientCache(ADMIN_CLAIMS_KEY);
}

export function fetchFormBootstrap<T = unknown>(options?: { fresh?: boolean }) {
  if (options?.fresh) {
    invalidateClientCache(FORM_BOOTSTRAP_KEY);
    clearFormBootstrapStorage();
  }
  return fetchClientCache<T>(
    FORM_BOOTSTRAP_KEY,
    () => fetchFormBootstrapFromNetwork<T>(),
    FORM_BOOTSTRAP_TTL_MS,
  ).then((data) => {
    writeFormBootstrapToStorage(data);
    return data;
  });
}

/** Always hits the network; keeps showing cached categories until fresh data arrives. */
export function refreshFormBootstrapInBackground<T = FormBootstrapPayload>() {
  return fetchFormBootstrapFromNetwork<T>();
}

export function readFormBootstrapCache<T>() {
  return (
    readClientCache<T>(FORM_BOOTSTRAP_KEY) ?? readFormBootstrapFromStorage<T>()
  );
}

export function invalidateFormBootstrap() {
  invalidateClientCache(FORM_BOOTSTRAP_KEY);
  clearFormBootstrapStorage();
}

/** Warm likely admin destinations — skip heavy analytics until Insights is opened. */
export function warmAdminNavCaches() {
  void fetchAdminUsers();
  void fetchAdminClaims();
  void fetchAdminBranches();
  void fetchAdminCategories();
  void fetchFormBootstrap();
}

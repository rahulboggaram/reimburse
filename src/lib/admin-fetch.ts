import { readJson } from "@/lib/api";
import { fetchClientCache, invalidateClientCache, readClientCache } from "@/lib/client-cache";

export const ADMIN_USERS_KEY = "admin-users";
export const ADMIN_CLAIMS_KEY = "admin-claims";
export const ADMIN_BRANCHES_KEY = "admin-branches";
export const ADMIN_CATEGORIES_KEY = "admin-categories";
export const ADMIN_ACTIVITY_KEY = "admin-activity";
export const FORM_BOOTSTRAP_KEY = "form-bootstrap";

const TTL_MS = 5 * 60 * 1000;

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

export function fetchFormBootstrap<T = unknown>() {
  return fetchClientCache<T>(FORM_BOOTSTRAP_KEY, () =>
    fetch("/api/app/bootstrap").then((r) => readJson<T>(r)),
    TTL_MS,
  );
}

export function readFormBootstrapCache<T>() {
  return readClientCache<T>(FORM_BOOTSTRAP_KEY);
}

export function invalidateFormBootstrap() {
  invalidateClientCache(FORM_BOOTSTRAP_KEY);
}

export function warmAdminNavCaches() {
  void fetchAdminUsers();
  void fetchAdminClaims();
  void fetchAdminBranches();
  void fetchAdminCategories();
  void fetchAdminActivity();
  void fetchFormBootstrap();
}

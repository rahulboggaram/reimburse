import {
  invalidateClientCache,
  readClientCache,
  writeClientCache,
} from "@/lib/client-cache";

type StoredPayload<T> = {
  data: T;
  expiresAt: number;
};

/** Persist list caches in localStorage so My Claims paints instantly after navigation. */
export function readPersistedClientCache<T>(key: string): T | null {
  const memory = readClientCache<T>(key);
  if (memory !== null) return memory;

  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload<T>;
    if (parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    writeClientCache(key, parsed.data, parsed.expiresAt - Date.now());
    return parsed.data;
  } catch {
    return null;
  }
}

export function writePersistedClientCache<T>(
  key: string,
  data: T,
  ttlMs: number,
) {
  writeClientCache(key, data, ttlMs);
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ data, expiresAt: Date.now() + ttlMs }),
    );
  } catch {
    // ignore quota errors — memory cache still works
  }
}

export function invalidatePersistedClientCache(prefix?: string) {
  invalidateClientCache(prefix);
  if (typeof window === "undefined") return;
  try {
    if (!prefix) return;
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

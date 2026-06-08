"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { readJson } from "@/lib/api";
import { fetchFormBootstrap } from "@/lib/admin-fetch";
import type { SessionUser } from "@/lib/session";

export type MeUser = {
  id: string;
  name: string | null;
  phone: string;
  role: string;
  profileComplete: boolean;
};

type MeContextValue = {
  user: MeUser | null;
  loading: boolean;
  refreshMe: () => Promise<void>;
};

export const MeContext = createContext<MeContextValue | null>(null);

function toMeUser(user: SessionUser): MeUser {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    profileComplete: user.profileComplete,
  };
}

export function MeProvider(props: {
  children: React.ReactNode;
  initialUser?: SessionUser | null;
}) {
  const [user, setUser] = useState<MeUser | null>(
    props.initialUser ? toMeUser(props.initialUser) : null,
  );
  const [loading, setLoading] = useState(!props.initialUser);

  const refreshMe = useCallback(async () => {
    try {
      async function fetchMeOnce(): Promise<{ ok: boolean; user: MeUser | null }> {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return { ok: false, user: null };
        const data = await readJson<{ user: MeUser | null }>(res);
        return { ok: true, user: data.user };
      }

      const first = await fetchMeOnce();
      if (!first.ok) {
        // Cookie re-issue (e.g. after saving profile) can take a tick to become visible
        // to subsequent requests. Retry once to avoid flickering into a logged-out state.
        await new Promise((r) => setTimeout(r, 250));
        const second = await fetchMeOnce();
        setUser(second.user);
      } else {
        setUser(first.user);
      }
    } catch {
      // If refresh fails completely, assume logged out after one stable fetch cycle.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.profileComplete) {
      void fetchFormBootstrap();
    }
  }, [user?.id, user?.profileComplete]);

  useEffect(() => {
    if (props.initialUser) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    refreshMe().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [refreshMe, props.initialUser]);

  const value = useMemo(
    () => ({ user, loading, refreshMe }),
    [user, loading, refreshMe],
  );

  return (
    <MeContext.Provider value={value}>{props.children}</MeContext.Provider>
  );
}

export function useMe(): MeContextValue {
  const context = useContext(MeContext);
  if (!context) {
    throw new Error("useMe must be used within MeProvider");
  }
  return context;
}

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
      const res = await fetch("/api/auth/me");
      const data = res.ok
        ? await readJson<{ user: MeUser | null }>(res)
        : { user: null };
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    refreshMe().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

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

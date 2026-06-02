"use client";

import {
  createContext,
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

  useEffect(() => {
    if (props.initialUser) return;

    let cancelled = false;

    fetch("/api/auth/me")
      .then((res) =>
        res.ok ? readJson<{ user: MeUser | null }>(res) : { user: null },
      )
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [props.initialUser]);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

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

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MeProvider } from "@/components/me-provider";
import { ReimburseBrand } from "@/components/wapas-brand";
import type { SessionUser } from "@/lib/session";

const PREFETCH_ROUTES = [
  "/employee",
  "/employee/claims",
  "/employee/profile",
  "/manager",
  "/admin/people",
  "/admin/claims",
];

export function AppShell(props: {
  children: React.ReactNode;
  initialUser?: SessionUser | null;
}) {
  const router = useRouter();

  useEffect(() => {
    for (const route of PREFETCH_ROUTES) {
      router.prefetch(route);
    }
  }, [router]);

  return (
    <MeProvider initialUser={props.initialUser}>
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-1 flex-col px-4 py-5 pb-8 sm:py-6">
        <header className="mb-10 sm:mb-12">
          <ReimburseBrand />
        </header>
        <div className="flex-1">{props.children}</div>
      </div>
    </MeProvider>
  );
}

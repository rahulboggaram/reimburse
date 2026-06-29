"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MeProvider } from "@/components/me-provider";
import { ReimburseBrand } from "@/components/reimburse-brand";
import { fetchFormBootstrap } from "@/lib/admin-fetch";
import { warmMyClaimsCache } from "@/lib/fetch-own-claims";
import { processClaimSubmitOutbox } from "@/lib/process-claim-submit-outbox";
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

  useEffect(() => {
    if (props.initialUser?.profileComplete) {
      void fetchFormBootstrap();
      warmMyClaimsCache(props.initialUser.id);
      void processClaimSubmitOutbox(props.initialUser.id);
    }
  }, [props.initialUser?.id, props.initialUser?.profileComplete]);

  return (
    <MeProvider initialUser={props.initialUser}>
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-1 flex-col px-4 py-5 pb-8 sm:py-6">
        <header className="mb-14 flex justify-center sm:mb-16">
          <ReimburseBrand />
        </header>
        <div className="flex-1">{props.children}</div>
      </div>
    </MeProvider>
  );
}

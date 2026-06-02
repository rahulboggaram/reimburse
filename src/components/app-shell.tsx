"use client";

import { MeProvider } from "@/components/me-provider";
import { ReimburseBrand } from "@/components/wapas-brand";
import { UserMenu } from "@/components/user-menu";

export function AppShell(props: { children: React.ReactNode }) {
  return (
    <MeProvider>
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-1 flex-col px-4 py-5 pb-8 sm:py-6">
      <header className="mb-8 flex items-start justify-between gap-3 sm:mb-10">
        <ReimburseBrand />
        <UserMenu />
      </header>
      <div className="flex-1">{props.children}</div>
    </div>
    </MeProvider>
  );
}

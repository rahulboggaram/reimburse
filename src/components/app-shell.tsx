"use client";

import { ReimburseBrand } from "@/components/wapas-brand";
import { UserMenu } from "@/components/user-menu";

export function AppShell(props: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-1 flex-col px-4 py-4 pb-6 sm:py-6">
      <header className="mb-10 flex items-start justify-between gap-2 sm:mb-12 sm:gap-3">
        <ReimburseBrand />
        <UserMenu />
      </header>
      <div className="flex-1">{props.children}</div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMe } from "@/components/me-provider";
import type { MeUser } from "@/components/me-provider";
import { invalidateClientCache } from "@/lib/client-cache";
import { warmNavCaches } from "@/lib/warm-nav-cache";
import { userDisplayLabel } from "@/lib/user-profile";
import {
  canAccessManagerPortal,
  canViewOwnReimbursements,
} from "@/lib/access-roles";
import type { UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";

function MenuLink(props: {
  href: string;
  children: React.ReactNode;
  onNavigate: () => void;
  active?: boolean;
}) {
  return (
    <Link
      href={props.href}
      prefetch
      role="menuitem"
      className={cn(
        "block px-4 py-2.5 text-sm font-medium hover:bg-zinc-50",
        props.active ? "bg-zinc-100 text-zinc-900" : "text-zinc-800",
      )}
      onClick={props.onNavigate}
    >
      {props.children}
    </Link>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-zinc-100" role="separator" />;
}

function MenuUserHeader(props: { name: string }) {
  return (
    <>
      <div className="px-4 py-2.5">
        <p className="truncate text-sm font-bold text-zinc-900">{props.name}</p>
      </div>
      <MenuDivider />
    </>
  );
}

function sessionToMeUser(user: SessionUser): MeUser {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    profileComplete: user.profileComplete,
  };
}

function MenuChevron(props: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn(
        "size-4 shrink-0 text-zinc-500 transition-transform",
        props.open && "rotate-180",
      )}
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function AccountMenuTrigger(props: {
  open: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={props.open}
      aria-haspopup="menu"
      aria-busy={props.loading || undefined}
      disabled={props.loading}
      onClick={props.onClick}
      className="flex items-center gap-1.5 rounded-full bg-white py-1.5 pr-2 pl-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:cursor-wait"
      aria-label="Open menu"
    >
      {props.loading ? (
        <span className="h-4 w-10 animate-pulse rounded bg-zinc-200" />
      ) : (
        <span>Menu</span>
      )}
      <MenuChevron open={props.open} />
    </button>
  );
}

export function UserMenu(props: { initialUser?: SessionUser | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, loading } = useMe();
  const [open, setOpen] = useState(false);

  const resolvedUser =
    user ?? (props.initialUser ? sessionToMeUser(props.initialUser) : null);
  const label = resolvedUser ? userDisplayLabel(resolvedUser) : "";
  const showLoading = loading && !resolvedUser;

  useEffect(() => {
    if (!open || !resolvedUser?.profileComplete) return;
    warmNavCaches(resolvedUser);
  }, [open, resolvedUser?.id, resolvedUser?.role, resolvedUser?.profileComplete]);

  useEffect(() => {
    if (!open) return;

    const routes = [
      "/employee",
      "/employee/claims",
      "/employee/profile",
      "/manager",
      "/admin/people",
      "/admin/claims",
      "/admin/activity",
      "/admin/reports",
      "/admin/analytics",
      "/admin/otp-setup",
      "/admin/branches",
      "/admin/categories",
    ];
    for (const route of routes) {
      router.prefetch(route);
    }
  }, [open, router]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  async function logout() {
    closeMenu();
    invalidateClientCache();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!resolvedUser) {
    return (
      <div ref={menuRef} className="relative shrink-0">
        <AccountMenuTrigger
          open={false}
          loading={showLoading}
          onClick={() => {}}
        />
      </div>
    );
  }

  if (!resolvedUser.profileComplete) {
    return (
      <div ref={menuRef} className="relative shrink-0">
        <AccountMenuTrigger
          open={open}
          onClick={() => setOpen((value) => !value)}
        />
        {open ? (
          <div
            role="menu"
            className="absolute top-[calc(100%+6px)] right-0 z-30 w-52 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
          >
            <MenuUserHeader name={label} />
            <MenuLink
              href="/employee/onboarding"
              onNavigate={closeMenu}
              active={pathname.startsWith("/employee/onboarding")}
            >
              Complete profile
            </MenuLink>
            <MenuDivider />
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
              onClick={logout}
            >
              Log Out
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const canAdmin = resolvedUser.role === "ADMIN";
  const canApprove =
    resolvedUser.role === "ADMIN" ||
    resolvedUser.role === "BRANCH_MANAGER" ||
    resolvedUser.role === "APPROVER";
  const newReimbursementLink = (
    <MenuLink
      href="/employee"
      onNavigate={closeMenu}
      active={pathname === "/employee"}
    >
      Create reimbursement
    </MenuLink>
  );

  const approvalsLink = canApprove ? (
    <MenuLink
      href="/manager"
      onNavigate={closeMenu}
      active={pathname.startsWith("/manager")}
    >
      Approvals
    </MenuLink>
  ) : null;

  const role = resolvedUser.role as UserRole;
  const showMyReimbursements =
    canViewOwnReimbursements(resolvedUser) || canAccessManagerPortal(role);

  const myReimbursementsLink = showMyReimbursements ? (
    <MenuLink
      href="/employee/claims"
      onNavigate={closeMenu}
      active={
        pathname.startsWith("/employee/claims") ||
        pathname.startsWith("/employee/refile")
      }
    >
      My Reimbursements
    </MenuLink>
  ) : null;

  const profileLink = (
    <MenuLink
      href="/employee/profile"
      onNavigate={closeMenu}
      active={pathname.startsWith("/employee/profile")}
    >
      Profile
    </MenuLink>
  );

  const logoutButton = (
    <button
      type="button"
      role="menuitem"
      className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
      onClick={logout}
    >
      Log Out
    </button>
  );

  return (
    <div ref={menuRef} className="relative shrink-0">
      <AccountMenuTrigger
        open={open}
        onClick={() => setOpen((value) => !value)}
      />

      {open ? (
        <div
          role="menu"
          className="absolute top-[calc(100%+6px)] right-0 z-30 max-h-[70vh] w-52 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
        >
          <MenuUserHeader name={label} />
          {canAdmin ? (
            <>
              {newReimbursementLink}
              {approvalsLink}
              {myReimbursementsLink}
              <MenuDivider />
              <MenuLink
                href="/admin/people"
                onNavigate={closeMenu}
                active={pathname.startsWith("/admin/people")}
              >
                People
              </MenuLink>
              <MenuLink
                href="/admin/branches"
                onNavigate={closeMenu}
                active={pathname.startsWith("/admin/branches")}
              >
                Branches
              </MenuLink>
              <MenuLink
                href="/admin/categories"
                onNavigate={closeMenu}
                active={pathname.startsWith("/admin/categories")}
              >
                Categories
              </MenuLink>
              <MenuDivider />
              <MenuLink
                href="/admin/claims"
                onNavigate={closeMenu}
                active={pathname.startsWith("/admin/claims")}
              >
                All Reimbursements
              </MenuLink>
              <MenuLink
                href="/admin/activity"
                onNavigate={closeMenu}
                active={pathname.startsWith("/admin/activity")}
              >
                Activity
              </MenuLink>
              <MenuLink
                href="/admin/reports"
                onNavigate={closeMenu}
                active={pathname.startsWith("/admin/reports")}
              >
                Reports
              </MenuLink>
              <MenuLink
                href="/admin/analytics"
                onNavigate={closeMenu}
                active={pathname.startsWith("/admin/analytics")}
              >
                Insights
              </MenuLink>
              <MenuLink
                href="/admin/otp-setup"
                onNavigate={closeMenu}
                active={pathname.startsWith("/admin/otp-setup")}
              >
                WhatsApp login
              </MenuLink>
              {profileLink}
              <MenuDivider />
              {logoutButton}
            </>
          ) : (
            <>
              {newReimbursementLink}
              {approvalsLink}
              {myReimbursementsLink}
              {profileLink}
              <MenuDivider />
              {logoutButton}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatPhoneDisplay } from "@/lib/phone";
import { toTitleCase } from "@/lib/user-profile";
import { useMe, type MeUser } from "@/components/me-provider";
import { cn } from "@/lib/utils";

function displayLabel(user: MeUser) {
  if (user.name?.trim()) return toTitleCase(user.name.trim());
  return formatPhoneDisplay(user.phone);
}

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
        props.active ? "bg-zinc-50 text-emerald-800" : "text-zinc-800",
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

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, loading } = useMe();
  const [open, setOpen] = useState(false);

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
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (loading || !user) {
    return (
      <div
        className="size-10 shrink-0 animate-pulse rounded-full bg-zinc-200"
        aria-hidden={loading}
        aria-label={loading ? "Loading menu" : undefined}
      />
    );
  }

  const label = displayLabel(user);
  const canAdmin = user.role === "ADMIN";
  const canApprove =
    user.role === "ADMIN" ||
    user.role === "BRANCH_MANAGER" ||
    user.role === "APPROVER";

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="flex max-w-[160px] items-center gap-1 rounded-lg px-1 py-1 transition-colors hover:bg-zinc-100 sm:max-w-[200px]"
      >
        <span className="truncate text-sm font-medium text-zinc-900">
          {label}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cn(
            "size-4 shrink-0 text-zinc-500 transition-transform",
            open && "rotate-180",
          )}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-[calc(100%+6px)] right-0 z-30 max-h-[70vh] w-52 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {user.role !== "EMPLOYEE" ? (
            <MenuLink
              href="/employee"
              onNavigate={closeMenu}
              active={pathname === "/employee"}
            >
              New Claim
            </MenuLink>
          ) : null}
          <MenuLink
            href="/employee/claims"
            onNavigate={closeMenu}
            active={
              pathname.startsWith("/employee/claims") ||
              pathname.startsWith("/employee/refile")
            }
          >
            My Claims
          </MenuLink>
          <MenuLink
            href="/employee/profile"
            onNavigate={closeMenu}
            active={pathname.startsWith("/employee/profile")}
          >
            Profile
          </MenuLink>

          {canApprove ? (
            <MenuLink
              href="/manager"
              onNavigate={closeMenu}
              active={pathname.startsWith("/manager")}
            >
              Approvals
            </MenuLink>
          ) : null}

          {canAdmin ? (
            <>
              <MenuDivider />
              <MenuLink
                href="/admin/people"
                onNavigate={closeMenu}
                active={pathname.startsWith("/admin/people")}
              >
                People
              </MenuLink>
              <MenuLink
                href="/admin/claims"
                onNavigate={closeMenu}
                active={pathname.startsWith("/admin/claims")}
              >
                All Claims
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
            </>
          ) : null}

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

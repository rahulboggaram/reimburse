import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import type { UserRole } from "@prisma/client";
import {
  canAccessAdminPortal,
  canAccessEmployeePortal,
  canAccessManagerPortal,
} from "@/lib/access-roles";
import { getAppHomePathForRole } from "@/lib/home-path";

const COOKIE_NAME = "reimburse_session";

const publicPaths = ["/login", "/api/auth/send-otp", "/api/auth/verify-otp"];

function secret() {
  return new TextEncoder().encode(
    process.env.SESSION_SECRET ?? "reimburse-dev-change-in-production",
  );
}

const VALID_ROLES: UserRole[] = [
  "EMPLOYEE",
  "BRANCH_MANAGER",
  "APPROVER",
  "ADMIN",
];

type TokenClaims = {
  role: UserRole | null;
  profileComplete: boolean;
};

async function getTokenClaims(request: NextRequest): Promise<TokenClaims> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return { role: null, profileComplete: false };
  }
  try {
    const { payload } = await jwtVerify(token, secret());
    const role =
      typeof payload.role === "string" &&
      VALID_ROLES.includes(payload.role as UserRole)
        ? (payload.role as UserRole)
        : null;
    return {
      role,
      profileComplete: payload.profileComplete === true,
    };
  } catch {
    return { role: null, profileComplete: false };
  }
}

function homeForClaims(claims: TokenClaims): string {
  if (!claims.role) return "/login";
  if (!claims.profileComplete) return "/employee/onboarding";
  return getAppHomePathForRole(claims.role);
}

function isProfileSetupPath(pathname: string): boolean {
  if (
    pathname === "/employee/onboarding" ||
    pathname === "/employee/profile"
  ) {
    return true;
  }
  if (pathname.startsWith("/api/profile")) return true;
  if (pathname === "/api/auth/me" || pathname.startsWith("/api/auth/logout")) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const claims = await getTokenClaims(request);

  if (
    publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/logout")) {
    return NextResponse.next();
  }

  if (pathname === "/" || pathname === "/login") {
    if (!claims.role) {
      return pathname === "/"
        ? NextResponse.redirect(new URL("/login", request.url))
        : NextResponse.next();
    }
    return NextResponse.redirect(new URL(homeForClaims(claims), request.url));
  }

  if (!claims.role) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Please sign in." }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  if (!claims.profileComplete && !isProfileSetupPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return Response.json(
        {
          error: "Add your name and bank details to continue.",
          redirectTo: "/employee/onboarding",
        },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/employee/onboarding", request.url));
  }

  if (claims.profileComplete && pathname === "/employee/onboarding") {
    return NextResponse.redirect(new URL(homeForClaims(claims), request.url));
  }

  if (pathname.startsWith("/employee")) {
    if (!canAccessEmployeePortal(claims.role)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (pathname.startsWith("/manager")) {
    if (!canAccessManagerPortal(claims.role)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!canAccessAdminPortal(claims.role)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};

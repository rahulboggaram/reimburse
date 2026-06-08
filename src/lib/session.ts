import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  canAccessAdminPortal as roleCanAccessAdminPortal,
  canAccessEmployeePortal as roleCanAccessEmployeePortal,
  canAccessManagerPortal as roleCanAccessManagerPortal,
} from "@/lib/access-roles";
import { getAppHomePathForRole } from "@/lib/home-path";
import { isProfileComplete } from "@/lib/user-profile";

export type SessionUser = {
  id: string;
  phone: string;
  name: string | null;
  role: UserRole;
  branchId: string | null;
  profileComplete: boolean;
};

const COOKIE_NAME = "reimburse_session";

function secret() {
  const value =
    process.env.SESSION_SECRET ?? "reimburse-dev-change-in-production";
  return new TextEncoder().encode(value);
}

export function userToSession(user: User): SessionUser {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    branchId: user.branchId,
    profileComplete: isProfileComplete(user),
  };
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

const VALID_ROLES: UserRole[] = [
  "EMPLOYEE",
  "ACCOUNTANT",
  "BRANCH_MANAGER",
  "APPROVER",
  "ADMIN",
];

function parseRole(value: unknown): UserRole | null {
  if (typeof value !== "string") return null;
  return VALID_ROLES.includes(value as UserRole) ? (value as UserRole) : null;
}

export async function readSessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const role = parseRole(payload.role);
    if (typeof payload.id !== "string" || typeof payload.phone !== "string" || !role) {
      return null;
    }
    return {
      id: payload.id,
      phone: payload.phone,
      name: typeof payload.name === "string" ? payload.name : null,
      role,
      branchId:
        typeof payload.branchId === "string" ? payload.branchId : null,
      profileComplete: payload.profileComplete === true,
    };
  } catch {
    return null;
  }
}

/** Read session from the signed cookie (fast path for APIs). */
export async function getSessionFromCookie(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

/** Refresh role/profile from DB and re-issue cookie when something changed. */
export async function refreshSessionFromDb(
  fromToken: SessionUser,
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: fromToken.id },
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
      ifscCode: true,
      bankAccountNumber: true,
      branchId: true,
      active: true,
    },
  });
  if (!user?.active) return null;

  const session = userToSession(user as User);
  if (
    session.role !== fromToken.role ||
    session.profileComplete !== fromToken.profileComplete ||
    session.name !== fromToken.name ||
    session.branchId !== fromToken.branchId
  ) {
    try {
      await setSessionCookie(session);
    } catch (err) {
      console.error("session cookie refresh failed", err);
    }
  }
  return session;
}

/** Fast session for most requests; set SESSION_ALWAYS_REFRESH_DB=true to always hit DB. */
export async function getSession(): Promise<SessionUser | null> {
  const fromToken = await getSessionFromCookie();
  if (!fromToken) return null;

  if (process.env.SESSION_ALWAYS_REFRESH_DB === "true") {
    return refreshSessionFromDb(fromToken);
  }

  return fromToken;
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function sessionCanAccessAdminPortal(session: SessionUser): boolean {
  return roleCanAccessAdminPortal(session.role);
}

export function sessionCanAccessManagerPortal(session: SessionUser): boolean {
  return roleCanAccessManagerPortal(session.role);
}

export function sessionCanAccessEmployeePortal(session: SessionUser): boolean {
  return roleCanAccessEmployeePortal(session.role);
}

export function redirectPathAfterLogin(user: User): string {
  if (!isProfileComplete(user)) return "/employee/onboarding";
  return getAppHomePathForRole(user.role);
}

export function canSubmitReimbursement(session: SessionUser): boolean {
  return session.profileComplete;
}

// Re-export for auth-api compatibility
export const canAccessAdminPortal = sessionCanAccessAdminPortal;
export const canAccessManagerPortal = sessionCanAccessManagerPortal;
export const canAccessEmployeePortal = sessionCanAccessEmployeePortal;

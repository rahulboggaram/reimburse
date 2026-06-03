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
  profileComplete: boolean;
};

const COOKIE_NAME = "wapas_session";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET is not set");
  }
  return new TextEncoder().encode(value);
}

export function userToSession(user: User): SessionUser {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
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
      profileComplete: payload.profileComplete === true,
    };
  } catch {
    return null;
  }
}

/** Load session from DB so role changes (e.g. to Branch Manager) apply without re-login. */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const fromToken = await readSessionToken(token);
  if (!fromToken) return null;

  const user = await prisma.user.findUnique({
    where: { id: fromToken.id },
  });
  if (!user || !user.active) return null;

  const session = userToSession(user);

  if (
    session.role !== fromToken.role ||
    session.profileComplete !== fromToken.profileComplete
  ) {
    await setSessionCookie(session);
  }

  return session;
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

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { User, UserRole } from "@prisma/client";
import {
  canAccessAdminPortal,
  canAccessEmployeePortal,
  canAccessManagerPortal,
} from "@/lib/access-roles";
import { isEmployeeProfileComplete } from "@/lib/user-profile";

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
    profileComplete:
      user.role !== "EMPLOYEE" || isEmployeeProfileComplete(user),
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

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return readSessionToken(token);
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
  return canAccessAdminPortal(session.role);
}

export function sessionCanAccessManagerPortal(session: SessionUser): boolean {
  return canAccessManagerPortal(session.role);
}

export function sessionCanAccessEmployeePortal(session: SessionUser): boolean {
  return canAccessEmployeePortal(session.role);
}

export function redirectPathAfterLogin(user: User): string {
  if (!isEmployeeProfileComplete(user)) return "/employee/onboarding";
  return "/employee";
}

export function canSubmitReimbursement(session: SessionUser): boolean {
  if (session.role === "EMPLOYEE") return session.profileComplete;
  return session.profileComplete || session.role !== "EMPLOYEE";
}

// Re-export for auth-api compatibility
export const canAccessAdminPortal = sessionCanAccessAdminPortal;
export const canAccessManagerPortal = sessionCanAccessManagerPortal;
export const canAccessEmployeePortal = sessionCanAccessEmployeePortal;

import type { UserRole } from "@prisma/client";
import {
  canAccessAdminPortal,
  canAccessEmployeePortal,
  canAccessManagerPortal,
  canSubmitReimbursement,
  getSession,
  type SessionUser,
} from "@/lib/session";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function requireSession(): Promise<SessionUser | Response> {
  const session = await getSession();
  if (!session) {
    return jsonError("Please sign in.", 401);
  }
  return session;
}

export async function requireRole(
  roles: UserRole[],
): Promise<SessionUser | Response> {
  const session = await requireSession();
  if (session instanceof Response) return session;
  if (!roles.includes(session.role)) {
    return jsonError("You do not have access.", 403);
  }
  return session;
}

export async function requireEmployeeWithProfile(): Promise<
  SessionUser | Response
> {
  const session = await requireRole(["EMPLOYEE"]);
  if (session instanceof Response) return session;
  if (!session.profileComplete) {
    return jsonError("Complete your profile first.", 403);
  }
  return session;
}

export async function requireCanSubmitReimbursement(): Promise<
  SessionUser | Response
> {
  const session = await requireSession();
  if (session instanceof Response) return session;
  if (!canSubmitReimbursement(session)) {
    return jsonError("Complete your profile first.", 403);
  }
  return session;
}

export async function requireEmployeePortalAccess(): Promise<
  SessionUser | Response
> {
  const session = await requireSession();
  if (session instanceof Response) return session;
  if (!canAccessEmployeePortal(session)) {
    return jsonError("You do not have access.", 403);
  }
  return session;
}

export async function requireAdminAccess(): Promise<SessionUser | Response> {
  const session = await requireSession();
  if (session instanceof Response) return session;
  if (!canAccessAdminPortal(session)) {
    return jsonError("You do not have access.", 403);
  }
  return session;
}

export async function requireManagerAccess(): Promise<SessionUser | Response> {
  const session = await requireSession();
  if (session instanceof Response) return session;
  if (!canAccessManagerPortal(session)) {
    return jsonError("You do not have access.", 403);
  }
  return session;
}

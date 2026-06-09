import { canPaymentApproverAccessClaim } from "@/lib/payment-approver";
import type { SessionUser } from "@/lib/session";
import {
  canAccessAdminPortal,
  canAccessManagerPortal,
} from "@/lib/session";

type ClaimForReceiptAccess = {
  employeeId: string;
  approverId: string;
  employee?: { role: string } | null;
};

export function canViewClaimReceipts(
  session: SessionUser,
  claim: ClaimForReceiptAccess,
): boolean {
  const isOwner = claim.employeeId === session.id;
  if (canAccessAdminPortal(session)) return true;
  if (!canAccessManagerPortal(session)) return isOwner;
  if (session.role === "APPROVER") {
    return canPaymentApproverAccessClaim(session, claim);
  }
  if (canAccessManagerPortal(session)) {
    return claim.approverId === session.id;
  }
  return isOwner;
}

import type { SessionUser } from "@/lib/session";
import {
  canAccessAdminPortal,
  canAccessManagerPortal,
} from "@/lib/session";

type ClaimForReceiptAccess = {
  employeeId: string;
  approverId: string;
  paymentApproverId: string;
};

export function canViewClaimReceipts(
  session: SessionUser,
  claim: ClaimForReceiptAccess,
): boolean {
  const isOwner = claim.employeeId === session.id;
  if (canAccessAdminPortal(session)) return true;
  if (!canAccessManagerPortal(session)) return isOwner;
  if (canAccessManagerPortal(session)) {
    return (
      claim.approverId === session.id ||
      claim.paymentApproverId === session.id
    );
  }
  return isOwner;
}

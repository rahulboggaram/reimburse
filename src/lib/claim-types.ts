export type ClaimReceipt = {
  id: string;
  url: string;
  fileName: string | null;
  mimeType: string;
};

export type SerializedClaim = {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  category: string;
  description: string;
  expenseDate: string;
  branchId: string;
  branch: { id: string; name: string; active: boolean };
  status: string;
  rejectionReason: string | null;
  decidedAt: string | null;
  razorpayPayoutId: string | null;
  payoutStatus: string | null;
  payoutUtr: string | null;
  payoutError: string | null;
  payoutInitiatedAt: string | null;
  paidAt: string | null;
  approverId: string;
  approver: { id: string; name: string | null; phone: string };
  refiledFromId: string | null;
  receipts: ClaimReceipt[];
  createdAt: string;
  updatedAt: string;
};

export type AdminClaim = SerializedClaim & {
  employee: { id: string; name: string | null; phone: string };
};

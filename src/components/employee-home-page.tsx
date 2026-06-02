"use client";

import { RejectedClaimsSection } from "@/components/rejected-claims-section";
import { ReimbursementForm } from "@/components/reimbursement-form";

export function EmployeeHomePage() {
  return (
    <>
      <RejectedClaimsSection />
      <ReimbursementForm
        title="New reimbursement"
        submitLabel="Submit for approval"
      />
    </>
  );
}

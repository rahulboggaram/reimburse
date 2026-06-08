"use client";

import { useEffect } from "react";
import { useMe } from "@/components/me-provider";
import { RejectedClaimsSection } from "@/components/rejected-claims-section";
import { ReimbursementForm } from "@/components/reimbursement-form";
import { fetchFormBootstrap } from "@/lib/admin-fetch";
import { fetchMyClaims } from "@/lib/fetch-own-claims";

export function EmployeeHomePage() {
  const { user } = useMe();

  useEffect(() => {
    if (!user?.profileComplete) return;
    void fetchFormBootstrap();
    if (user.id) void fetchMyClaims(user.id);
  }, [user?.id, user?.profileComplete]);

  return (
    <>
      <RejectedClaimsSection />
      <ReimbursementForm
        title="New Claim"
        titleClassName="font-bold"
        submitLabel="Submit for approval"
      />
    </>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  ReimbursementForm,
  type ReimbursementFormValues,
} from "@/components/reimbursement-form";
import { Card } from "@/components/ui/card";
import { readJson } from "@/lib/api";

type Claim = {
  id: string;
  status: string;
  amount: number;
  category: string;
  description: string;
  expenseDate: string;
  branchId: string;
  approverId: string;
  rejectionReason: string | null;
};

export default function RefileClaimPage() {
  const params = useParams<{ id: string }>();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/claims/${params.id}`)
      .then((res) => readJson<Claim>(res))
      .then(setClaim)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-dvh bg-zinc-100">
        <AppShell>
          <p className="text-sm text-zinc-500">Loading…</p>
        </AppShell>
      </main>
    );
  }

  if (!claim || claim.status !== "REJECTED") {
    return (
      <main className="min-h-dvh bg-zinc-100">
        <AppShell>
          <Card>
            <p className="text-sm text-zinc-600">
              This claim cannot be refiled.
            </p>
            <Link
              href="/employee/claims"
              className="mt-3 inline-block text-sm font-medium underline"
            >
              Back to my claims
            </Link>
          </Card>
        </AppShell>
      </main>
    );
  }

  const initial: ReimbursementFormValues = {
    amount: String(claim.amount),
    category: claim.category,
    description: claim.description,
    branchId: claim.branchId,
    approverId: claim.approverId,
  };

  return (
    <main className="min-h-dvh bg-zinc-100">
      <AppShell>
        {claim.rejectionReason ? (
          <Card className="mb-4 border-red-200 bg-red-50">
            <p className="text-sm text-red-800">
              <span className="font-medium">Rejected because:</span>{" "}
              {claim.rejectionReason}
            </p>
          </Card>
        ) : null}
        <ReimbursementForm
          title="Edit & refile"
          submitLabel="Resubmit for approval"
          claimId={claim.id}
          initial={initial}
        />
      </AppShell>
    </main>
  );
}

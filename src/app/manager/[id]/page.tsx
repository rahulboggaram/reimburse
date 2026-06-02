"use client";

import { TextLink } from "@/components/text-link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import type { SerializedClaim } from "@/lib/claim-types";
import { readJson } from "@/lib/api";

export default function ManagerClaimDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [claim, setClaim] = useState<SerializedClaim | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/claims/${params.id}`)
      .then((res) => readJson<SerializedClaim>(res))
      .then(setClaim)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  if (!claim) {
    return (
      <>
        <PageHeading title="Approvals" className="mb-5" />
        <Card>
          <p className="text-sm text-zinc-600">Claim not found.</p>
          <TextLink href="/manager" className="mt-3">
            Back
          </TextLink>
        </Card>
      </>
    );
  }

  return (
    <ClaimDetailModal
      claim={claim}
      open
      variant="approver"
      onClose={() => router.push("/manager")}
      onUpdated={() => router.push("/manager")}
    />
  );
}

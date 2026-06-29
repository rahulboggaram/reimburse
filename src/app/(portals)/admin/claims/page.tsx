"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ApprovalsTableHeader,
  ApprovalsTableRow,
} from "@/components/approvals-table";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import { ClaimsTableLoadingSkeleton } from "@/components/claims-table-skeleton";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AdminClaim } from "@/lib/claim-types";
import { formatPhoneDisplay } from "@/lib/phone";
import { PageHeading } from "@/components/page-heading";
import {
  fetchAdminClaims,
  fetchAdminUsers,
  invalidateAdminClaims,
} from "@/lib/admin-fetch";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  collectPayoutRefreshClaimIds,
  usePayoutWatchPolling,
} from "@/lib/use-payout-watch-polling";

type EmployeeOption = {
  id: string;
  name: string | null;
  phone: string;
};

export default function AdminClaimsPage() {
  const { data: employeesData } = useCachedQuery<EmployeeOption[]>(
    "admin-users",
    () => fetchAdminUsers<EmployeeOption[]>(),
  );
  const {
    data: claimsData,
    loading,
    setData: setClaims,
  } = useCachedQuery<AdminClaim[]>("admin-claims", () =>
    fetchAdminClaims<AdminClaim[]>(),
  );
  const employees = employeesData ?? [];
  const claims = claimsData ?? [];
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [selected, setSelected] = useState<AdminClaim | null>(null);

  const refreshClaims = useCallback(async () => {
    invalidateAdminClaims();
    const list = await fetchAdminClaims<AdminClaim[]>();
    setClaims(list);
  }, [setClaims]);

  const lastPayoutRefreshAt = useRef(0);
  const refreshClaimsForPayout = useCallback(() => {
    const now = Date.now();
    if (now - lastPayoutRefreshAt.current < 20_000) return;
    lastPayoutRefreshAt.current = now;
    void refreshClaims();
  }, [refreshClaims]);

  const payoutRefreshIds = useMemo(
    () => collectPayoutRefreshClaimIds(claims),
    [claims],
  );

  usePayoutWatchPolling({
    claimIds: payoutRefreshIds,
    onTick: refreshClaimsForPayout,
  });

  const filtered = useMemo(() => {
    const list = filterEmployeeId
      ? claims.filter((c) => c.employee.id === filterEmployeeId)
      : claims;
    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [claims, filterEmployeeId]);

  return (
    <>
      <PageHeading title="All claims" className="mb-4" />
      <Card className="mb-4 space-y-1.5">
        <Label htmlFor="filter-employee">Filter by employee</Label>
        <Select
          id="filter-employee"
          fieldSize="sm"
          value={filterEmployeeId}
          onChange={(e) => setFilterEmployeeId(e.target.value)}
        >
          <option value="">All employees</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name ?? formatPhoneDisplay(employee.phone)}
            </option>
          ))}
        </Select>
      </Card>

      {loading && claims.length === 0 ? (
        <ClaimsTableLoadingSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600">No reimbursements found.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ApprovalsTableHeader showStatus />
          <div>
            {filtered.map((claim) => (
              <ApprovalsTableRow
                key={claim.id}
                claim={claim}
                showStatus
                onOpen={() => setSelected(claim)}
              />
            ))}
          </div>
        </Card>
      )}

      <ClaimDetailModal
        claim={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        variant="admin"
        onUpdated={refreshClaims}
      />
    </>
  );
}

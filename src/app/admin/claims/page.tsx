"use client";

import { useEffect, useMemo, useState } from "react";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import { ClaimListRow } from "@/components/claim-list-row";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AdminClaim } from "@/lib/claim-types";
import { formatDisplayDate } from "@/lib/dates";
import { formatPhoneDisplay } from "@/lib/phone";
import { PageHeading } from "@/components/page-heading";
import { RazorpayXStatusBanner } from "@/components/razorpayx-status-banner";
import { readJson } from "@/lib/api";
import { fetchClientCache, invalidateClientCache } from "@/lib/client-cache";

type EmployeeOption = {
  id: string;
  name: string | null;
  phone: string;
};

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<AdminClaim[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminClaim | null>(null);

  useEffect(() => {
    Promise.all([
      fetchClientCache("admin-users", () =>
        fetch("/api/admin/users").then((r) => readJson<EmployeeOption[]>(r)),
      ),
      fetchClientCache("admin-claims", () =>
        fetch("/api/admin/reimbursements").then((r) =>
          readJson<AdminClaim[]>(r),
        ),
      ),
    ])
      .then(([employeeList, claimList]) => {
        setEmployees(employeeList);
        setClaims(claimList);
      })
      .finally(() => setLoading(false));
  }, []);

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
      <PageHeading title="All reimbursements" className="mb-4" />
      <RazorpayXStatusBanner />
      <div className="mb-4 space-y-1.5">
        <Label htmlFor="filter-employee">Filter by employee</Label>
        <Select
          id="filter-employee"
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
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading reimbursements…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600">No reimbursements found.</p>
        </Card>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {filtered.map((claim) => (
            <li key={claim.id}>
              <ClaimListRow
                title={claim.employeeName}
                subtitle={`${claim.category} · ${formatDisplayDate(claim.expenseDate)}`}
                amount={claim.amount}
                approvalStatus={claim.status}
                paymentStatus={claim.payoutStatus}
                onOpen={() => setSelected(claim)}
              />
            </li>
          ))}
        </ul>
      )}

      <ClaimDetailModal
        claim={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        variant="admin"
        onUpdated={async () => {
          invalidateClientCache("admin-claims");
          const list = await fetchClientCache("admin-claims", () =>
            fetch("/api/admin/reimbursements").then((r) =>
              readJson<AdminClaim[]>(r),
            ),
          );
          setClaims(list);
          setSelected((current) =>
            current ? list.find((c) => c.id === current.id) ?? null : null,
          );
        }}
      />
    </>
  );
}

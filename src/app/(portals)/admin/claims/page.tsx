"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ApprovalsTableHeader,
  ApprovalsTableRow,
} from "@/components/approvals-table";
import { ClaimDetailModal } from "@/components/claim-detail-modal";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AdminClaim } from "@/lib/claim-types";
import { formatPhoneDisplay } from "@/lib/phone";
import { PageHeading } from "@/components/page-heading";
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
        <Card className="overflow-hidden p-0">
          <ApprovalsTableHeader showCategory showStatus />
          <div>
            {filtered.map((claim) => (
              <ApprovalsTableRow
                key={claim.id}
                claim={claim}
                showCategory
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

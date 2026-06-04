"use client";

import { useMemo, useState } from "react";
import { ActiveInactiveTabs } from "@/components/active-inactive-tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  EmployeeDetailModal,
  EmployeeListRow,
  type EmployeeRecord,
} from "@/components/employee-list";
import type { UserRole } from "@prisma/client";
import { formatPhoneDisplay, normalizePhone } from "@/lib/phone";
import { PageHeading } from "@/components/page-heading";
import {
  fetchAdminBranches,
  fetchAdminUsers,
  invalidateAdminUsers,
} from "@/lib/admin-fetch";
import { readJson } from "@/lib/api";
import { useCachedQuery } from "@/lib/use-cached-query";

type RoleFilter =
  | "all"
  | "employee"
  | "branch-manager"
  | "approver"
  | "admin"
  | "signed-up"
  | "pending";

function matchesSearch(employee: EmployeeRecord, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const digits = q.replace(/\D/g, "");
  const phoneDigits = employee.phone.replace(/\D/g, "");

  if (employee.name?.toLowerCase().includes(q)) return true;
  if (formatPhoneDisplay(employee.phone).toLowerCase().includes(q)) return true;
  if (digits && phoneDigits.includes(digits)) return true;

  return false;
}

function matchesRoleFilter(employee: EmployeeRecord, filter: RoleFilter) {
  switch (filter) {
    case "employee":
      return employee.role === "EMPLOYEE";
    case "branch-manager":
      return employee.role === "BRANCH_MANAGER";
    case "approver":
      return employee.role === "APPROVER";
    case "admin":
      return employee.role === "ADMIN";
    case "signed-up":
      return employee.signedUp;
    case "pending":
      return !employee.signedUp;
    default:
      return true;
  }
}

type BranchOption = { id: string; name: string; active: boolean };

export default function AdminPeoplePage() {
  const {
    data: employeesData,
    loading,
    setData: setEmployees,
  } = useCachedQuery<EmployeeRecord[]>("admin-users", () =>
    fetchAdminUsers<EmployeeRecord[]>(),
  );
  const { data: branchesData } = useCachedQuery<BranchOption[]>(
    "admin-branches",
    () => fetchAdminBranches<BranchOption[]>(),
  );
  const employees = employeesData ?? [];
  const branches = branchesData ?? [];
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selected, setSelected] = useState<EmployeeRecord | null>(null);

  async function loadEmployees(fresh = false) {
    setError(null);
    try {
      if (fresh) invalidateAdminUsers();
      const data = await fetchAdminUsers<EmployeeRecord[]>();
      setEmployees(data);
      setSelected((current) =>
        current ? (data.find((e) => e.id === current.id) ?? null) : null,
      );
    } catch (err) {
      setEmployees([]);
      setSelected(null);
      setError(
        err instanceof Error
          ? err.message
          : "Could not load people. Please try again.",
      );
    }
  }

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.active),
    [employees],
  );
  const inactiveEmployees = useMemo(
    () => employees.filter((e) => !e.active),
    [employees],
  );

  const filtered = useMemo(() => {
    const pool = tab === "active" ? activeEmployees : inactiveEmployees;
    return pool.filter(
      (employee) =>
        matchesSearch(employee, search) && matchesRoleFilter(employee, roleFilter),
    );
  }, [activeEmployees, inactiveEmployees, tab, search, roleFilter]);

  const searchNormalized = normalizePhone(search);
  const matchByPhone = searchNormalized
    ? employees.find((e) => e.phone === searchNormalized)
    : undefined;
  const existsByPhone = Boolean(matchByPhone);

  async function addEmployee(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      await readJson(response);
      setPhone("");
      setTab("active");
      await loadEmployees(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add employee.");
    } finally {
      setSaving(false);
    }
  }

  async function updateEmployee(update: {
    id: string;
    role: UserRole;
    branchId: string | null;
  }) {
    await fetch(`/api/admin/users/${update.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: update.role, branchId: update.branchId }),
    });
    await loadEmployees(true);
  }

  async function removeEmployee(id: string) {
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    await loadEmployees(true);
    setTab("inactive");
  }

  return (
    <>
      <PageHeading title="People" className="mb-5" />
      <Card className="mb-6">
        <form onSubmit={addEmployee} className="space-y-4">
          <div>
            <h2 className="font-semibold">Allow A New Mobile Number</h2>
            <p className="text-sm text-zinc-600">
              They complete name & bank details on first login.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Mobile number</Label>
            <Input
              id="phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98765 43210"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Adding…" : "Add employee"}
          </Button>
        </form>
      </Card>

      <div className="mb-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="search-employee">Search</Label>
          <Input
            id="search-employee"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or mobile number"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-people">Filter by role</Label>
          <Select
            id="filter-people"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          >
            <option value="all">All roles</option>
            <option value="employee">Employees only</option>
            <option value="branch-manager">Branch managers only</option>
            <option value="approver">Payment approvers only</option>
            <option value="admin">Admins only</option>
            <option value="signed-up">Signed up</option>
            <option value="pending">Pending signup</option>
          </Select>
        </div>
        {search.trim() ? (
          <p className="text-sm text-zinc-600">
            {filtered.length > 0 ? (
              <>
                Found <span className="font-medium">{filtered.length}</span>{" "}
                employee{filtered.length === 1 ? "" : "s"}
                {existsByPhone && matchByPhone?.active
                  ? " — this number is on the list"
                  : ""}
                {existsByPhone && matchByPhone && !matchByPhone.active
                  ? " — removed; add again with the form above to restore"
                  : ""}
              </>
            ) : existsByPhone && matchByPhone && !matchByPhone.active ? (
              <span className="text-amber-800">
                This number was removed — use the form above to add them back
              </span>
            ) : (
              <span className="text-amber-800">
                No employee found — add them with the form above if needed
              </span>
            )}
          </p>
        ) : null}
      </div>

      <h2 className="mb-3 text-lg font-semibold">All Employees</h2>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : employees.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600">No employees yet.</p>
        </Card>
      ) : (
        <Card className="space-y-3">
          <ActiveInactiveTabs value={tab} onChange={setTab} />

          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-600">
              {tab === "active"
                ? "No active employees match your search."
                : "No inactive employees match your search."}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white">
              {filtered.map((employee) => (
                <li key={employee.id}>
                  <EmployeeListRow
                    employee={employee}
                    onOpen={() => setSelected(employee)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <EmployeeDetailModal
        employee={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        branches={branches}
        onUpdate={updateEmployee}
        onRemove={removeEmployee}
      />
    </>
  );
}

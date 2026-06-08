"use client";

import { useMemo, useState } from "react";
import { ActiveInactiveTabs } from "@/components/active-inactive-tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FloatingInput, FloatingSelect } from "@/components/ui/floating-field";
import { PeopleSearchPill } from "@/components/people-search-pill";
import { RoleFilterPill } from "@/components/role-filter-pill";
import {
  EmployeeDetailModal,
  EmployeeListRow,
  type EmployeeRecord,
} from "@/components/employee-list";
import type { UserRole } from "@prisma/client";
import { ASSIGNABLE_ROLES, formatRole } from "@/lib/access-roles";
import { formatPhoneDisplay, normalizePhone } from "@/lib/phone";
import { userRoleRequiresBranch } from "@/lib/user-branch";
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

const ROLE_FILTER_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All roles" },
  { value: "employee", label: "Employees" },
  { value: "branch-manager", label: "Branch managers" },
  { value: "approver", label: "Approvers" },
  { value: "admin", label: "Admins" },
  { value: "signed-up", label: "Signed up" },
  { value: "pending", label: "Pending" },
];

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

function employeeDisplayName(employee: EmployeeRecord) {
  const name = employee.name?.trim();
  if (name) return name;
  return formatPhoneDisplay(employee.phone);
}

function compareEmployeesByName(a: EmployeeRecord, b: EmployeeRecord) {
  return employeeDisplayName(a).localeCompare(employeeDisplayName(b), undefined, {
    sensitivity: "base",
  });
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
  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.active),
    [branches],
  );
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("EMPLOYEE");
  const [branchId, setBranchId] = useState("");
  const needsBranch = userRoleRequiresBranch(role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
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
    return pool
      .filter(
        (employee) =>
          matchesSearch(employee, search) &&
          matchesRoleFilter(employee, roleFilter),
      )
      .sort(compareEmployeesByName);
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
        body: JSON.stringify({ phone, role, branchId }),
      });
      await readJson(response);
      setPhone("");
      setRole("EMPLOYEE");
      setBranchId("");
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
            <h2 className="font-semibold">Add new employee</h2>
          </div>
          <FloatingInput
            id="phone"
            label="Mobile number"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <FloatingSelect
            id="role"
            label="Role"
            required
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {ASSIGNABLE_ROLES.map((option) => (
              <option key={option} value={option}>
                {formatRole(option)}
              </option>
            ))}
          </FloatingSelect>
          {needsBranch ? (
            <FloatingSelect
              id="branch"
              label="Branch"
              required
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              disabled={activeBranches.length === 0}
            >
              <option value="">Select branch</option>
              {activeBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </FloatingSelect>
          ) : null}
          {needsBranch && activeBranches.length === 0 ? (
            <p className="text-sm text-zinc-600">
              Add an active branch before inviting employees.
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            size="sm"
            disabled={
              saving ||
              (needsBranch && (!branchId || activeBranches.length === 0))
            }
          >
            {saving ? "Adding…" : "Add employee"}
          </Button>
        </form>
      </Card>

      <section className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 text-lg font-semibold text-zinc-900">
            All Employees
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <PeopleSearchPill
              open={searchOpen}
              onToggle={() => setSearchOpen((current) => !current)}
              active={Boolean(search.trim())}
            />
            <RoleFilterPill
              value={roleFilter}
              onChange={setRoleFilter}
              options={ROLE_FILTER_OPTIONS}
              ariaLabel="Filter by role"
              pillLabelWhenAll="Filter"
              allValue="all"
            />
          </div>
        </div>
      </section>

      {searchOpen ? (
        <Card className="mb-4 space-y-3">
          <FloatingInput
            id="search-employee"
            label="Name or mobile number"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
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
        </Card>
      ) : null}

      <Card className="space-y-4">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : employees.length === 0 ? (
          <p className="text-sm text-zinc-600">No employees yet.</p>
        ) : (
          <>
            <ActiveInactiveTabs value={tab} onChange={setTab} />

            {filtered.length === 0 ? (
              <p className="text-sm text-zinc-600">
                {tab === "active"
                  ? "No active employees match your search."
                  : "No inactive employees match your search."}
              </p>
            ) : (
              <ul className="overflow-hidden rounded-xl bg-white">
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
          </>
        )}
      </Card>

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

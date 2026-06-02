"use client";

import { useEffect, useMemo, useState } from "react";
import { ActiveInactiveTabs } from "@/components/active-inactive-tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readJson } from "@/lib/api";
import { toTitleCase } from "@/lib/user-profile";

type Branch = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
};

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tab, setTab] = useState<"active" | "inactive">("active");

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/admin/branches")
      .then((r) => readJson<Branch[]>(r))
      .then(setBranches)
      .catch(() => setError("Could not load branches."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const activeBranches = useMemo(
    () => branches.filter((b) => b.active),
    [branches],
  );
  const inactiveBranches = useMemo(
    () => branches.filter((b) => !b.active),
    [branches],
  );

  async function createBranch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      await readJson(res);
      setName("");
      load();
    } catch {
      setError("Could not create branch. It may already exist.");
    } finally {
      setCreating(false);
    }
  }

  async function setBranchActive(branchId: string, nextActive: boolean) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/branches/${branchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      await readJson(res);
      load();
    } catch {
      setError("Could not update branch.");
    }
  }

  async function deleteBranch(branchId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/branches/${branchId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        await readJson(res);
      }
      load();
    } catch {
      setError("Could not delete branch. It may be used in a claim.");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
        {toTitleCase("branches")}
      </h1>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      <Card className="space-y-3">
        <form onSubmit={createBranch} className="space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="branch-name">New branch name</Label>
            <Input
              id="branch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bangalore"
            />
          </div>
          <Button type="submit" disabled={creating || !name.trim()}>
            {creating ? "Creating…" : "Add branch"}
          </Button>
        </form>
      </Card>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading branches…</p>
      ) : (
        <div className="space-y-3">
          <Card className="space-y-3">
            <ActiveInactiveTabs value={tab} onChange={setTab} />

            {tab === "active" ? (
              activeBranches.length === 0 ? (
                <p className="text-sm text-zinc-600">No active branches.</p>
              ) : (
                <ul className="space-y-2">
                  {activeBranches.map((branch) => (
                    <li
                      key={branch.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <p className="text-sm font-medium text-zinc-900">
                        {branch.name}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setBranchActive(branch.id, false)}
                      >
                        Disable
                      </Button>
                    </li>
                  ))}
                </ul>
              )
            ) : inactiveBranches.length === 0 ? (
              <p className="text-sm text-zinc-600">No inactive branches.</p>
            ) : (
              <ul className="space-y-2">
                {inactiveBranches.map((branch) => (
                  <li
                    key={branch.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <p className="text-sm font-medium text-zinc-900">
                      {branch.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setBranchActive(branch.id, true)}
                      >
                        Enable
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => deleteBranch(branch.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}


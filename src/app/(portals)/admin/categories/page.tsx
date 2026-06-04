"use client";

import { useMemo, useState } from "react";
import { ActiveInactiveTabs } from "@/components/active-inactive-tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FloatingInput } from "@/components/ui/floating-field";
import { PageHeading } from "@/components/page-heading";
import { readJson } from "@/lib/api";
import {
  fetchAdminCategories,
  invalidateAdminCategories,
  invalidateFormBootstrap,
} from "@/lib/admin-fetch";
import { useCachedQuery } from "@/lib/use-cached-query";

type Category = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
};

export default function AdminCategoriesPage() {
  const {
    data: categoriesData,
    loading,
    setData: setCategories,
  } = useCachedQuery<Category[]>("admin-categories", () =>
    fetchAdminCategories<Category[]>(),
  );
  const categories = categoriesData ?? [];
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tab, setTab] = useState<"active" | "inactive">("active");

  async function reload() {
    setError(null);
    invalidateAdminCategories();
    invalidateFormBootstrap();
    try {
      const list = await fetchAdminCategories<Category[]>();
      setCategories(list);
    } catch {
      setError("Could not load categories.");
    }
  }

  const activeCategories = useMemo(
    () => categories.filter((c) => c.active),
    [categories],
  );
  const inactiveCategories = useMemo(
    () => categories.filter((c) => !c.active),
    [categories],
  );

  async function createCategory(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      await readJson(res);
      setName("");
      await reload();
    } catch {
      setError("Could not create category. It may already exist.");
    } finally {
      setCreating(false);
    }
  }

  async function setCategoryActive(categoryId: string, nextActive: boolean) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      await readJson(res);
      await reload();
    } catch {
      setError("Could not update category.");
    }
  }

  function confirmDisableCategory(categoryName: string) {
    return window.confirm(`Disable “${categoryName}”?`);
  }

  return (
    <div className="space-y-4">
      <PageHeading
        title="Categories"
        info="Disabling a category hides it from new claims. Past reimbursements keep the category name they were filed with."
      />

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      <Card className="space-y-3">
        <form onSubmit={createCategory} className="space-y-2">
          <div className="space-y-1.5">
            <FloatingInput
              id="category-name"
              label="Category name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={creating || !name.trim()}>
            {creating ? "Creating…" : "Add category"}
          </Button>
        </form>
      </Card>

      {loading && categories.length === 0 ? (
        <p className="text-sm text-zinc-500">Loading categories…</p>
      ) : (
        <div className="space-y-3">
          <Card className="space-y-3">
            <ActiveInactiveTabs value={tab} onChange={setTab} />

            {tab === "active" ? (
              activeCategories.length === 0 ? (
                <p className="text-sm text-zinc-600">No active categories.</p>
              ) : (
                <ul className="space-y-2">
                  {activeCategories.map((category) => (
                    <li
                      key={category.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <p className="text-sm font-medium text-zinc-900">
                        {category.name}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!confirmDisableCategory(category.name)) return;
                          void setCategoryActive(category.id, false);
                        }}
                      >
                        Disable
                      </Button>
                    </li>
                  ))}
                </ul>
              )
            ) : inactiveCategories.length === 0 ? (
              <p className="text-sm text-zinc-600">No inactive categories.</p>
            ) : (
              <ul className="space-y-2">
                {inactiveCategories.map((category) => (
                  <li
                    key={category.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <p className="text-sm font-medium text-zinc-900">
                      {category.name}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCategoryActive(category.id, true)}
                    >
                      Enable
                    </Button>
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


"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { AutoResizeTextarea } from "@/components/ui/textarea";
import {
  ReceiptUploadField,
  type ReceiptFileItem,
} from "@/components/receipt-upload-field";
import { PageHeading } from "@/components/page-heading";
import { useMe } from "@/components/me-provider";
import { readJson } from "@/lib/api";
import {
  fetchClientCache,
  invalidateClientCache,
} from "@/lib/client-cache";
import { toTitleCase } from "@/lib/user-profile";

type Branch = { id: string; name: string };
type ExpenseCategory = { id: string; name: string };

export type ReimbursementFormValues = {
  amount?: string;
  branchId?: string;
  category?: string;
  description?: string;
};

type FieldErrors = {
  amount?: string;
  branchId?: string;
  category?: string;
  description?: string;
  receipts?: string;
};

function FieldError(props: { message?: string }) {
  if (!props.message) return null;
  return (
    <p className="text-sm text-red-700" role="alert">
      {props.message}
    </p>
  );
}

export function ReimbursementForm(props: {
  title: string;
  submitLabel: string;
  initial?: ReimbursementFormValues;
  claimId?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState(props.initial?.amount ?? "");
  const [branchId, setBranchId] = useState(props.initial?.branchId ?? "");
  const [category, setCategory] = useState(props.initial?.category ?? "");
  const [description, setDescription] = useState(props.initial?.description ?? "");
  const [receipts, setReceipts] = useState<ReceiptFileItem[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const { user: meUser } = useMe();
  const [adminConfirmOpen, setAdminConfirmOpen] = useState(false);

  useEffect(() => {
    fetchClientCache("form-bootstrap", async () => {
      const res = await fetch("/api/app/bootstrap");
      return readJson<{ branches: Branch[]; categories: ExpenseCategory[] }>(
        res,
      );
    })
      .then((data) => {
        setBranches(data.branches);
        setCategories(data.categories);
      })
      .catch(() => setError("Could not load form options."))
      .finally(() => {
        setLoadingBranches(false);
        setLoadingCategories(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};

    if (!amount.trim()) {
      errors.amount = "Amount is required.";
    } else {
      const parsedAmount = Number.parseFloat(amount);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        errors.amount = "Enter a valid amount greater than zero.";
      }
    }

    if (!branchId.trim()) {
      errors.branchId = "Select a branch.";
    }

    if (!category.trim()) {
      errors.category = "Select a category.";
    }

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      errors.description = "Description is required.";
    } else if (trimmedDescription.length < 3) {
      errors.description = "Description must be at least 3 characters.";
    }

    if (receipts.length === 0) {
      errors.receipts = "Add at least one receipt photo.";
    }

    return errors;
  }

  async function submitClaim() {
    const parsedAmount = Number.parseFloat(amount);

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("amount", String(parsedAmount));
      formData.set("branchId", branchId.trim());
      formData.set("category", category);
      formData.set("description", description.trim());
      for (const item of receipts) {
        formData.append("receipts", item.file);
      }

      const url = props.claimId
        ? `/api/claims/${props.claimId}/refile`
        : "/api/claims";
      const method = props.claimId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        body: formData,
      });
      await readJson(response);
      invalidateClientCache("claims-mine");

      if (props.onSuccess) {
        props.onSuccess();
      } else {
        router.push("/employee/claims");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save claim. Check your details and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Please fill in all required fields.");
      return;
    }

    if (meUser?.role === "ADMIN") {
      setAdminConfirmOpen(true);
      return;
    }

    await submitClaim();
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <PageHeading title={props.title} />

      <Card className="space-y-5 ring-1 ring-emerald-100/50">
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="amount">
            Amount (₹)
          </Label>
          <Input
            id="amount"
            inputMode="decimal"
            required
            aria-invalid={Boolean(fieldErrors.amount)}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setFieldErrors((prev) => ({ ...prev, amount: undefined }));
            }}
            placeholder="0"
            className="h-14 text-2xl font-semibold font-tabular-nums"
          />
          <FieldError message={fieldErrors.amount} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">
            Category
          </Label>
          {loadingCategories ? (
            <p className="text-sm text-zinc-500">Loading categories…</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-amber-800">
              No categories available yet. Ask your admin.
            </p>
          ) : (
            <Select
              id="category"
              required
              aria-invalid={Boolean(fieldErrors.category)}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setFieldErrors((prev) => ({ ...prev, category: undefined }));
              }}
            >
              <option value="" disabled>
                Select category
              </option>
              {categories.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </Select>
          )}
          <FieldError message={fieldErrors.category} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="branch">Branch</Label>
          {loadingBranches ? (
            <p className="text-sm text-zinc-500">Loading branches…</p>
          ) : branches.length === 0 ? (
            <p className="text-sm text-amber-800">
              No branches available yet. Ask your admin.
            </p>
          ) : (
            <Select
              id="branch"
              required
              aria-invalid={Boolean(fieldErrors.branchId)}
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setFieldErrors((prev) => ({ ...prev, branchId: undefined }));
              }}
            >
              <option value="" disabled>
                Select branch
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          )}
          <FieldError message={fieldErrors.branchId} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">
            Description
          </Label>
          <AutoResizeTextarea
            id="description"
            required
            aria-invalid={Boolean(fieldErrors.description)}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setFieldErrors((prev) => ({ ...prev, description: undefined }));
            }}
            placeholder="What was this expense for?"
          />
          <FieldError message={fieldErrors.description} />
        </div>

        <ReceiptUploadField
          files={receipts}
          error={fieldErrors.receipts}
          onChange={(next) => {
            setReceipts(next);
            setFieldErrors((prev) => ({ ...prev, receipts: undefined }));
          }}
        />

      </Card>

      <Button
        type="submit"
        variant="brand"
        size="lg"
        className="w-full"
        disabled={
          submitting ||
          loadingBranches ||
          loadingCategories ||
          branches.length === 0 ||
          categories.length === 0
        }
      >
        {submitting ? "Saving…" : props.submitLabel}
      </Button>
    </form>

    <Modal
      open={adminConfirmOpen}
      onClose={() => setAdminConfirmOpen(false)}
      title="Confirm submission"
    >
      <div className="space-y-4">
        <p className="text-sm text-zinc-700">
          Admin reimbursements do not go through an approval process. After you
          submit, payment is sent to your bank account right away.
        </p>
        <p className="text-sm font-medium text-zinc-900">
          Please check the amount, category, branch, and receipts carefully
          before continuing.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={submitting}
            onClick={async () => {
              setAdminConfirmOpen(false);
              await submitClaim();
            }}
          >
            {submitting ? "Submitting…" : "Yes, submit and pay now"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={submitting}
            onClick={() => setAdminConfirmOpen(false)}
          >
            Go back and review
          </Button>
        </div>
      </div>
    </Modal>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { LoadingText } from "@/components/ui/loading-dots";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import {
  FloatingInput,
  FloatingSelect,
  FloatingTextarea,
} from "@/components/ui/floating-field";
import {
  ReceiptUploadField,
  type ReceiptFileItem,
} from "@/components/receipt-upload-field";
import { PageHeading } from "@/components/page-heading";
import { useMe } from "@/components/me-provider";
import { readJson } from "@/lib/api";
import { MIN_REIMBURSEMENT_AMOUNT } from "@/lib/validators";
import {
  fetchFormBootstrap,
  readFormBootstrapCache,
  refreshFormBootstrapInBackground,
} from "@/lib/admin-fetch";
import { fetchMyClaims } from "@/lib/fetch-own-claims";
import {
  migrateLocalReceiptPreviews,
  stashLocalReceiptPreviews,
} from "@/lib/local-receipt-previews";
import {
  isReceiptFileTooLarge,
  receiptStillTooLargeError,
} from "@/lib/receipt-limits";
import {
  failPendingClaimSubmit,
  prependOptimisticClaimToCache,
  registerPendingClaimSubmit,
  resolvePendingClaimSubmit,
} from "@/lib/pending-claim-submit";

function buildClaimFormData(input: {
  amount: number;
  category: string;
  description: string;
  receipts: ReceiptFileItem[];
}) {
  const formData = new FormData();
  formData.set("amount", String(input.amount));
  formData.set("category", input.category);
  formData.set("description", input.description);
  for (const item of input.receipts) {
    formData.append("receipts", item.file);
  }
  return formData;
}

type ExpenseCategory = { id: string; name: string };

type FormBootstrap = {
  categories: ExpenseCategory[];
  userBranch: { id: string; name: string } | null;
  submitBlockReason?: string | null;
};

export type ReimbursementFormValues = {
  amount?: string;
  category?: string;
  description?: string;
};

type FieldErrors = {
  amount?: string;
  category?: string;
  description?: string;
  receipts?: string;
};

export function ReimbursementForm(props: {
  title: string;
  titleClassName?: string;
  submitLabel: string;
  initial?: ReimbursementFormValues;
  claimId?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [, startNavigation] = useTransition();
  const cachedBootstrap = readFormBootstrapCache<FormBootstrap>();
  const [userBranch, setUserBranch] = useState(
    () => cachedBootstrap?.userBranch ?? null,
  );
  const [submitBlockReason, setSubmitBlockReason] = useState<string | null>(
    null,
  );
  const [categories, setCategories] = useState<ExpenseCategory[]>(
    () => cachedBootstrap?.categories ?? [],
  );
  const [loadingOptions, setLoadingOptions] = useState(
    () => (cachedBootstrap?.categories ?? []).length === 0,
  );
  const [refreshingCategories, setRefreshingCategories] = useState(false);

  const [amount, setAmount] = useState(props.initial?.amount ?? "");
  const [category, setCategory] = useState(props.initial?.category ?? "");
  const [description, setDescription] = useState(props.initial?.description ?? "");
  const [receipts, setReceipts] = useState<ReceiptFileItem[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const { user: meUser } = useMe();
  const [adminConfirmOpen, setAdminConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function applyBootstrap(data: FormBootstrap) {
    setCategories(data.categories);
    setUserBranch(data.userBranch);
    setSubmitBlockReason(data.submitBlockReason ?? null);
  }

  useEffect(() => {
    const cached = readFormBootstrapCache<FormBootstrap>();
    if (cached) {
      applyBootstrap(cached);
      setLoadingOptions(false);
      void refreshFormBootstrapInBackground<FormBootstrap>()
        .then(applyBootstrap)
        .catch(() => {});
      return;
    }

    void fetchFormBootstrap<FormBootstrap>()
      .then(applyBootstrap)
      .catch(() => setError("Could not load form options."))
      .finally(() => setLoadingOptions(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  function handleCategoryFocus() {
    if (refreshingCategories) return;
    setRefreshingCategories(true);
    void refreshFormBootstrapInBackground<FormBootstrap>()
      .then((data) => setCategories(data.categories))
      .catch(() => {})
      .finally(() => setRefreshingCategories(false));
  }

  useEffect(() => {
    if (!props.claimId) {
      router.prefetch("/employee/claims");
    }
  }, [router, props.claimId]);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};

    if (!amount.trim()) {
      errors.amount = "Amount is required.";
    } else {
      const parsedAmount = Number.parseFloat(amount);
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        errors.amount = "Enter a valid amount greater than zero.";
      } else if (parsedAmount < MIN_REIMBURSEMENT_AMOUNT) {
        errors.amount = "Amount must be at least ₹1.";
      }
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
    } else if (receipts.some((item) => item.processing)) {
      errors.receipts = "Wait a moment — photos are still being optimized.";
    } else if (receipts.some((item) => isReceiptFileTooLarge(item.file.size))) {
      errors.receipts = receiptStillTooLargeError();
    } else {
      const totalBytes = receipts.reduce((sum, item) => sum + item.file.size, 0);
      if (totalBytes > 3_500_000) {
        errors.receipts =
          "Total photo size is too large. Use fewer or smaller photos.";
      }
    }

    return errors;
  }

  function navigateAfterSubmit() {
    if (props.onSuccess) {
      props.onSuccess();
      return;
    }
    startNavigation(() => {
      router.replace("/employee/claims");
    });
  }

  function submitClaimInstantly() {
    const parsedAmount = Number.parseFloat(amount);
    const formData = buildClaimFormData({
      amount: parsedAmount,
      category,
      description: description.trim(),
      receipts,
    });

    const url = props.claimId
      ? `/api/claims/${props.claimId}/refile`
      : "/api/claims";
    const method = props.claimId ? "PATCH" : "POST";

    let tempId: string | undefined;
    if (!props.claimId && meUser && userBranch) {
      tempId = `pending-${crypto.randomUUID()}`;
      const pending = {
        tempId,
        userId: meUser.id,
        amount: parsedAmount,
        category,
        description: description.trim(),
        branchId: userBranch.id,
        branchName: userBranch.name,
        employeeName: meUser.name ?? "Employee",
        employeePhone: meUser.phone,
        employeeRole: meUser.role,
        receiptCount: receipts.length,
        claimStatus: (meUser.role === "ADMIN" ? "APPROVED" : "PENDING") as
          | "APPROVED"
          | "PENDING",
        state: "uploading" as const,
        submittedAt: Date.now(),
      };
      registerPendingClaimSubmit(pending);
      prependOptimisticClaimToCache(meUser.id, pending);
    }

    const previewClaimId = tempId ?? props.claimId;
    if (previewClaimId && receipts.length > 0) {
      void stashLocalReceiptPreviews(previewClaimId, receipts);
    }

    setIsSubmitting(true);
    navigateAfterSubmit();

    void (async () => {
      try {
        const response = await fetch(url, {
          method,
          body: formData,
          keepalive: true,
        });
        const created = await readJson<{ id: string }>(response);

        if (tempId && created.id) {
          migrateLocalReceiptPreviews(tempId, created.id);
        } else if (created.id && receipts.length > 0) {
          void stashLocalReceiptPreviews(created.id, receipts);
        }

        if (tempId && meUser?.id) {
          resolvePendingClaimSubmit(meUser.id, tempId);
        }
        if (meUser?.id) {
          void fetchMyClaims(meUser.id, { fresh: true }).catch(() => {});
        }
      } catch (err) {
        if (tempId && meUser?.id) {
          failPendingClaimSubmit(
            meUser.id,
            tempId,
            err instanceof Error
              ? err.message
              : "Could not save claim. Check your details and try again.",
          );
        }
      } finally {
        setIsSubmitting(false);
      }
    })();
  }

  async function submitClaim() {
    await submitClaimInstantly();
  }

  const receiptsStillProcessing = receipts.some((item) => item.processing);

  const missingBranch = !loadingOptions && !userBranch;
  const blockedFromSubmit = Boolean(submitBlockReason);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (missingBranch) {
      setError(
        "No branch is assigned to your account. Ask your admin to set one in People.",
      );
      return;
    }

    if (submitBlockReason) {
      setError(submitBlockReason);
      return;
    }

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (meUser?.role === "ADMIN") {
      setAdminConfirmOpen(true);
      return;
    }

    await submitClaim();
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <PageHeading title={props.title} titleClassName={props.titleClassName} />

      <Card className="space-y-5">
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}

        {missingBranch ? (
          <p className="text-sm text-amber-800">
            No branch is assigned to your account yet. Ask your admin to set one
            in People before you submit.
          </p>
        ) : null}

        {submitBlockReason ? (
          <p className="text-sm text-amber-800" role="status">
            {submitBlockReason}
          </p>
        ) : null}

        <FloatingInput
          id="amount"
          label="Amount (₹)"
          inputMode="decimal"
          required
          error={Boolean(fieldErrors.amount)}
          fieldError={fieldErrors.amount}
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setFieldErrors((prev) => ({ ...prev, amount: undefined }));
          }}
          className="font-tabular-nums"
        />

        {categories.length === 0 && loadingOptions ? (
          <p className="text-sm text-zinc-500">Loading categories…</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-amber-800">
            No categories available yet. Ask your admin.
          </p>
        ) : (
          <FloatingSelect
            id="category"
            label="Category"
            required
            error={Boolean(fieldErrors.category)}
            fieldError={fieldErrors.category}
            value={category}
            onFocus={handleCategoryFocus}
            onChange={(e) => {
              setCategory(e.target.value);
              setFieldErrors((prev) => ({ ...prev, category: undefined }));
            }}
          >
            <option value="" disabled hidden />
            {categories.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </FloatingSelect>
        )}

        <FloatingTextarea
          id="description"
          label="What was this expense for?"
          required
          autoResize
          error={Boolean(fieldErrors.description)}
          fieldError={fieldErrors.description}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setFieldErrors((prev) => ({ ...prev, description: undefined }));
          }}
        />

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
        size="lg"
        className="w-full"
        disabled={
          missingBranch ||
          blockedFromSubmit ||
          categories.length === 0 ||
          receiptsStillProcessing ||
          isSubmitting
        }
      >
        {isSubmitting ? <LoadingText>Submitting</LoadingText> : props.submitLabel}
      </Button>
    </form>

    <Modal
      open={adminConfirmOpen}
      onClose={() => setAdminConfirmOpen(false)}
      title="Confirm submission"
    >
      <div className="space-y-4">
        <p className="text-sm text-zinc-700">
          Admin reimbursements do not go through an approval process. Your claim
          saves right away and payment to your bank account starts in the
          background.
        </p>
        <p className="text-sm font-medium text-zinc-900">
          Please check the amount (minimum ₹1), category, receipts, and other
          details carefully before continuing.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
            onClick={() => {
              setAdminConfirmOpen(false);
              void submitClaimInstantly();
            }}
          >
            {isSubmitting ? (
              <LoadingText>Submitting</LoadingText>
            ) : (
              "Yes, submit and pay now"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
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

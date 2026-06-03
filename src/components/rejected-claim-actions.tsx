"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { readJson } from "@/lib/api";
import { invalidateClientCache } from "@/lib/client-cache";
import { claimsMineCacheKey, claimsRejectedCacheKey } from "@/lib/claims-cache";
import type { SerializedClaim } from "@/lib/claim-types";
import { cn } from "@/lib/utils";

export function RejectedClaimActions(props: {
  claim: SerializedClaim;
  userId: string;
  onDeleted?: () => void | Promise<void>;
  layout?: "inline" | "stacked";
  onRefileClick?: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const stacked = props.layout === "stacked";

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/claims/${props.claim.id}`, {
        method: "DELETE",
      });
      await readJson<{ ok: boolean }>(response);

      invalidateClientCache(claimsRejectedCacheKey(props.userId));
      invalidateClientCache(claimsMineCacheKey(props.userId));
      invalidateClientCache("claims-rejected:");
      invalidateClientCache("claims-mine:");

      setDeleteOpen(false);
      await props.onDeleted?.();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete this reimbursement.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          stacked
            ? "flex flex-col gap-2"
            : "flex flex-wrap items-center gap-2",
        )}
      >
        <Link
          href={`/employee/refile/${props.claim.id}`}
          onClick={props.onRefileClick}
          className={cn(
            "inline-flex items-center justify-center rounded-xl text-sm font-semibold",
            stacked
              ? "w-full bg-zinc-900 px-4 py-3 text-white hover:bg-zinc-800"
              : "px-3 py-2 text-blue-600 hover:text-blue-800",
          )}
        >
          Edit and resubmit
        </Link>
        <button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setDeleteOpen(true);
          }}
          className={cn(
            "inline-flex items-center justify-center rounded-xl text-sm font-semibold",
            stacked
              ? "w-full border border-red-200 bg-white px-4 py-3 text-red-700 hover:bg-red-50"
              : "border border-red-200 bg-white px-3 py-2 text-red-700 hover:bg-red-50",
          )}
        >
          Delete permanently
        </button>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        title="Delete reimbursement?"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-700">
            This will permanently remove{" "}
            <span className="font-medium">{props.claim.category}</span> (₹
            {props.claim.amount.toLocaleString("en-IN")}) and its receipts. You
            cannot undo this.
          </p>
          {deleteError ? (
            <p className="text-sm text-red-700" role="alert">
              {deleteError}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 pt-1">
            <Button
              type="button"
              size="lg"
              className="w-full bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? "Deleting…" : "Yes, delete permanently"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

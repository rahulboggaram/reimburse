"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FloatingSelect } from "@/components/ui/floating-field";
import { Modal } from "@/components/ui/modal";
import { formatRole } from "@/lib/access-roles";
import type { EmployeeRecord } from "@/components/employee-list";
import { formatPhoneDisplay } from "@/lib/phone";

export function AssignPaymentApproverModal(props: {
  open: boolean;
  branchName: string;
  people: EmployeeRecord[];
  branchId: string;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (userId: string) => void;
}) {
  const candidates = useMemo(
    () =>
      props.people.filter(
        (person) =>
          person.active &&
          !(
            person.role === "APPROVER" && person.branchId === props.branchId
          ),
      ),
    [props.people, props.branchId],
  );

  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (!props.open) {
      setSelectedId("");
      return;
    }
    setSelectedId(candidates[0]?.id ?? "");
  }, [props.open, candidates]);

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Assign payment approver"
      subtitle={`${props.branchName} needs someone to handle reimbursements before employees can submit claims.`}
    >
      <div className="space-y-4">
        {candidates.length === 0 ? (
          <p className="text-sm text-amber-800">
            No one is available to assign. Add someone with the Payment
            Approver role on this branch first.
          </p>
        ) : (
          <>
            <p className="text-sm text-zinc-600">
              Choose who should be the payment approver for{" "}
              <span className="font-medium text-zinc-900">
                {props.branchName}
              </span>
              . Their role will be updated to Payment Approver on this branch.
            </p>
            <FloatingSelect
              id="assign-payment-approver"
              label="Payment approver"
              required
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="" disabled>
                Select person
              </option>
              {candidates.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name?.trim() ||
                    formatPhoneDisplay(person.phone)}{" "}
                  · {formatRole(person.role)}
                  {person.branchName ? ` · ${person.branchName}` : ""}
                </option>
              ))}
            </FloatingSelect>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={props.onClose}
            disabled={props.saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={props.saving || !selectedId || candidates.length === 0}
            onClick={() => props.onConfirm(selectedId)}
          >
            {props.saving ? "Saving…" : "Assign & add person"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

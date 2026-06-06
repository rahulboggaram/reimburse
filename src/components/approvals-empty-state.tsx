type QueueTab = "waiting" | "approved";

function usesPaymentApproverTabs(role: string | undefined) {
  return role === "APPROVER" || role === "ADMIN";
}

function emptyStateContent(tab: QueueTab, role: string | undefined) {
  if (usesPaymentApproverTabs(role)) {
    if (tab === "waiting") {
      return {
        title: "All caught up",
        description:
          "No reimbursements are waiting for payment approval right now.",
      };
    }
    return {
      title: "Nothing sent yet",
      description:
        "Reimbursements you approve for payment will appear here after they go to RazorpayX.",
    };
  }

  if (tab === "waiting") {
    return {
      title: "Nothing to review",
      description: "No claims are waiting for your approval.",
    };
  }

  return {
    title: "No approved claims yet",
    description: "Claims you approve will show up in this list.",
  };
}

function EmptyQueueIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      className="size-8 text-zinc-500"
    >
      <path
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m9 14 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ApprovalsEmptyState(props: {
  tab: QueueTab;
  role?: string;
}) {
  const { title, description } = emptyStateContent(props.tab, props.role);

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center sm:py-24">
      <div
        className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-card-bg ring-1 ring-zinc-200/80"
        aria-hidden
      >
        <EmptyQueueIcon />
      </div>
      <p className="text-base font-semibold text-zinc-900">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
        {description}
      </p>
    </div>
  );
}

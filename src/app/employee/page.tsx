import { AppShell } from "@/components/app-shell";
import { ReimbursementForm } from "@/components/reimbursement-form";

export default function EmployeeHomePage() {
  return (
    <main className="min-h-dvh bg-zinc-100">
      <AppShell>
        <ReimbursementForm
          title="New reimbursement"
          submitLabel="Submit for approval"
        />
      </AppShell>
    </main>
  );
}

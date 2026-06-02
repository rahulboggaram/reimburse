import { AppShell } from "@/components/app-shell";
import { EmployeeProfileForm } from "@/components/employee-profile-form";

export default function EmployeeOnboardingPage() {
  return (
    <main className="min-h-dvh bg-zinc-100">
      <AppShell>
        <EmployeeProfileForm
          title="Complete your profile"
          description="Add your name and bank details so reimbursements can be paid to you."
          submitLabel="Continue"
        />
      </AppShell>
    </main>
  );
}

import { AppShell } from "@/components/app-shell";
import { EmployeeProfileForm } from "@/components/employee-profile-form";

export default function EmployeeProfilePage() {
  return (
    <main className="min-h-dvh bg-zinc-100">
      <AppShell>
        <EmployeeProfileForm
          title="Your profile"
          submitLabel="Save changes"
        />
      </AppShell>
    </main>
  );
}

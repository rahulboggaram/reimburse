import { EmployeeProfileForm } from "@/components/employee-profile-form";

export default function EmployeeOnboardingPage() {
  return (
    <EmployeeProfileForm
      variant="onboarding"
      title="Complete your profile"
      description="Before you can use Wapas, add your full name and bank account details. Reimbursements are paid to this account."
      submitLabel="Continue"
    />
  );
}

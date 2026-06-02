import { EmployeeProfileForm } from "@/components/employee-profile-form";

export default function EmployeeOnboardingPage() {
  return (
    <EmployeeProfileForm
      title="Complete your profile"
      description="Add your name and bank details so reimbursements can be paid to you."
      submitLabel="Continue"
    />
  );
}

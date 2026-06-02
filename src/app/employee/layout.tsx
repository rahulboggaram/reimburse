import { AppShell } from "@/components/app-shell";

export default function EmployeeLayout(props: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-zinc-100">
      <AppShell>{props.children}</AppShell>
    </main>
  );
}

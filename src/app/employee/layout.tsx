import { AppShell } from "@/components/app-shell";

export default function EmployeeLayout(props: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-emerald-50/50 via-zinc-50 to-zinc-100">
      <AppShell>{props.children}</AppShell>
    </main>
  );
}

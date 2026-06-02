import { AppShellWithSession } from "@/components/app-shell-with-session";

export default function ManagerLayout(props: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-emerald-50/50 via-zinc-50 to-zinc-100">
      <AppShellWithSession>{props.children}</AppShellWithSession>
    </main>
  );
}

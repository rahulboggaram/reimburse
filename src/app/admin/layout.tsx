import { AppShellWithSession } from "@/components/app-shell-with-session";

export default function AdminLayout(props: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-zinc-100">
      <AppShellWithSession>{props.children}</AppShellWithSession>
    </main>
  );
}

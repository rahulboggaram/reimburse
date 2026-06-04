import { AppShellWithSession } from "@/components/app-shell-with-session";

/** Single shell for employee, manager, and admin — keeps session + client cache warm across menu switches. */
export default function PortalsLayout(props: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-zinc-100">
      <AppShellWithSession>{props.children}</AppShellWithSession>
    </main>
  );
}

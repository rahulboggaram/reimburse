import { getSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";

export async function AppShellWithSession(props: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return <AppShell initialUser={session}>{props.children}</AppShell>;
}

import { AppShell } from "@/components/AppShell";
import { StickyTopbar } from "@/components/StickyTopbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell topbar={<StickyTopbar />}>{children}</AppShell>;
}

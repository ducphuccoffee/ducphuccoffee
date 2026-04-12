import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { StickyTopbar } from "@/components/StickyTopbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let displayName = "Admin";
  let initials = "AD";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const name = profile?.full_name || user.email?.split("@")[0] || "Admin";
    displayName = name;
    initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  }

  return (
    <AppShell
      topbar={<StickyTopbar displayName={displayName} initials={initials} />}
      displayName={displayName}
      initials={initials}
    >
      {children}
    </AppShell>
  );
}

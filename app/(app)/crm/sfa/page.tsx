import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SfaClient } from "@/components/crm/SfaClient";
import { TopBar } from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function SfaPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="p-8 text-red-500">Chưa đăng nhập</div>;

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = ["admin", "manager", "roastery_manager"].includes(profile?.role ?? "");

  // Customers with lat/lng for map
  let custQ = supabase
    .from("customers")
    .select("id, name, phone, latitude, longitude, crm_status, assigned_user_id");
  if (!isAdmin) custQ = custQ.eq("assigned_user_id", user.id);
  const { data: customers } = await custQ;

  return (
    <div>
      <TopBar title="SFA" subtitle="Sales Force Activity" section="CRM" />
      <SfaClient
        customers={(customers ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone ?? null,
          latitude: c.latitude ? Number(c.latitude) : null,
          longitude: c.longitude ? Number(c.longitude) : null,
        }))}
        currentUserId={user.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { SfaClient } from "@/components/crm/SfaClient";

export const dynamic = "force-dynamic";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function SfaPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="p-8 text-red-500">Chưa đăng nhập</div>;

  const { data: member } = await supabase
    .from("org_members").select("role")
    .eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();

  const isAdmin = ["admin", "manager"].includes(member?.role ?? "");

  // Customers with lat/lng for map (server filtered)
  let custQ = svc()
    .from("customers")
    .select("id, name, phone, latitude, longitude, crm_status, assigned_user_id");
  if (!isAdmin) custQ = custQ.eq("assigned_user_id", user.id);
  const { data: customers } = await custQ;

  // Visits (server filtered)
  let visitsQ = svc()
    .from("sales_visits")
    .select("id, customer_id, user_id, check_in_time, check_in_lat, check_in_lng, note, status, customers(name)")
    .order("check_in_time", { ascending: false })
    .limit(100);
  if (!isAdmin) visitsQ = visitsQ.eq("user_id", user.id);
  const { data: visits } = await visitsQ;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-2xl font-semibold text-gray-800">SFA – Sales Force Activity</h1>
        <p className="text-sm text-gray-500 mt-1">Ghi nhận visit khách hàng + bản đồ</p>
      </div>
      <SfaClient
        initialVisits={(visits ?? []).map((v: any) => ({
          ...v,
          customer_name: (v.customers as any)?.name ?? "—",
        }))}
        customers={(customers ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone ?? null,
          latitude:  c.latitude  ? Number(c.latitude)  : null,
          longitude: c.longitude ? Number(c.longitude) : null,
        }))}
        currentUserId={user.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}

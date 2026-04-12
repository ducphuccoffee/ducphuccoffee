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

  const { data: profile } = await supabase
    .from("profiles").select("role")
    .eq("id", user.id).maybeSingle();

  const isAdmin = ["admin", "manager", "roastery_manager"].includes(profile?.role ?? "");

  // Customers with lat/lng for map (server filtered)
  // Base query without CRM-only columns to handle pre-migration state
  const { data: customersBase } = await svc()
    .from("customers")
    .select("id, name, phone");

  // Try CRM columns separately (fallback if migration not yet applied)
  let crmColsMap: Record<string, any> = {};
  if (customersBase && customersBase.length > 0) {
    const { data: crmData } = await svc()
      .from("customers")
      .select("id, latitude, longitude, crm_status, assigned_user_id")
      .in("id", customersBase.map((c: any) => c.id));
    if (crmData) for (const c of crmData) crmColsMap[c.id] = c;
  }

  const customers = (customersBase ?? [])
    .map((c: any) => ({ ...c, ...(crmColsMap[c.id] ?? {}) }))
    .filter((c: any) => isAdmin || !c.assigned_user_id || c.assigned_user_id === user.id);

  // Visits (graceful fallback if sales_visits table not yet created)
  const { data: visitsRaw } = await svc()
    .from("sales_visits")
    .select("id, customer_id, user_id, check_in_time, check_in_lat, check_in_lng, note, status, customers(name)")
    .order("check_in_time", { ascending: false })
    .limit(100);
  const visits = isAdmin ? (visitsRaw ?? []) : (visitsRaw ?? []).filter((v: any) => v.user_id === user.id);

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

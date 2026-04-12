import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { CrmCareClient } from "@/components/crm/CrmCareClient";

export const dynamic = "force-dynamic";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function CrmCarePage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="p-8 text-red-500">Chưa đăng nhập</div>;

  const { data: member } = await supabase
    .from("org_members").select("role")
    .eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();

  const isAdmin = ["admin", "manager"].includes(member?.role ?? "");

  // Fetch customers (with permission filter at server)
  let custQ = svc()
    .from("customers")
    .select("id, name, phone, address, assigned_user_id, next_follow_up_at, latitude, longitude, crm_status, created_at")
    .order("name");
  if (!isAdmin) custQ = custQ.eq("assigned_user_id", user.id);
  const { data: customers } = await custQ;

  // Fetch order aggregates per customer
  const { data: orderAgg } = await svc()
    .from("orders")
    .select("customer_id, total_amount, status, created_at")
    .not("customer_id", "is", null);

  // Build per-customer stats
  const statsMap: Record<string, { count: number; revenue: number; lastOrder: string | null }> = {};
  for (const o of orderAgg ?? []) {
    if (!o.customer_id) continue;
    if (!statsMap[o.customer_id]) statsMap[o.customer_id] = { count: 0, revenue: 0, lastOrder: null };
    statsMap[o.customer_id].count++;
    statsMap[o.customer_id].revenue += Number(o.total_amount) || 0;
    if (!statsMap[o.customer_id].lastOrder || o.created_at > statsMap[o.customer_id].lastOrder!) {
      statsMap[o.customer_id].lastOrder = o.created_at;
    }
  }

  // Fetch all profiles for assignee lookup
  const { data: profiles } = await svc()
    .from("profiles")
    .select("id, full_name");

  const enriched = (customers ?? []).map((c: any) => ({
    ...c,
    order_count: statsMap[c.id]?.count  ?? 0,
    revenue:     statsMap[c.id]?.revenue ?? 0,
    last_order:  statsMap[c.id]?.lastOrder ?? null,
    assigned_name: (profiles ?? []).find((p: any) => p.id === c.assigned_user_id)?.full_name ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-2xl font-semibold text-gray-800">Customer Care</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isAdmin ? "Tất cả khách hàng" : "Khách hàng của bạn"}
        </p>
      </div>
      <CrmCareClient
        initialCustomers={enriched}
        profiles={(profiles ?? []).map((p: any) => ({ id: p.id, full_name: p.full_name ?? "" }))}
        currentUserId={user.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <div className="p-8 text-red-500">Chưa đăng nhập</div>;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = ["admin", "manager", "roastery_manager"].includes(profile?.role ?? "");

  // Fetch customers (permission-filtered at server)
  let custQ = svc()
    .from("customers")
    .select(
      "id, name, phone, address, assigned_user_id, next_follow_up_at, latitude, longitude, crm_status, crm_segment, created_at"
    )
    .order("name");
  if (!isAdmin) custQ = custQ.eq("assigned_user_id", user.id);
  const { data: rawCustomers } = await custQ;
  const visibleCustomers = rawCustomers ?? [];

  // Fetch order aggregates per customer (only for visible customers)
  const customerIds = (visibleCustomers ?? []).map((c: any) => c.id);
  let orderAgg: any[] = [];
  if (customerIds.length > 0) {
    const { data } = await svc()
      .from("orders")
      .select("customer_id, total_amount, created_at")
      .in("customer_id", customerIds);
    orderAgg = data ?? [];
  }

  // Build per-customer stats
  const statsMap: Record<string, { count: number; revenue: number; lastOrder: string | null }> = {};
  for (const o of orderAgg) {
    if (!o.customer_id) continue;
    if (!statsMap[o.customer_id]) statsMap[o.customer_id] = { count: 0, revenue: 0, lastOrder: null };
    statsMap[o.customer_id].count++;
    statsMap[o.customer_id].revenue += Number(o.total_amount) || 0;
    if (
      !statsMap[o.customer_id].lastOrder ||
      o.created_at > statsMap[o.customer_id].lastOrder!
    ) {
      statsMap[o.customer_id].lastOrder = o.created_at;
    }
  }

  // Fetch all profiles for assignee lookup
  const { data: profiles } = await svc().from("profiles").select("id, full_name");

  const enriched = (visibleCustomers ?? []).map((c: any) => ({
    ...c,
    order_count:   statsMap[c.id]?.count     ?? 0,
    revenue:       statsMap[c.id]?.revenue   ?? 0,
    last_order:    statsMap[c.id]?.lastOrder ?? null,
    assigned_name: (profiles ?? []).find((p: any) => p.id === c.assigned_user_id)?.full_name ?? null,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4">
      <div className="pt-5 pb-2">
        <h1 className="text-xl font-bold text-gray-800">Customer Care</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {isAdmin ? "Tất cả khách hàng" : "Khách hàng của bạn"}
        </p>
      </div>
      <CrmCareClient
        initialCustomers={enriched}
        profiles={(profiles ?? []).map((p: any) => ({
          id: p.id,
          full_name: p.full_name ?? "",
        }))}
        currentUserId={user.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}

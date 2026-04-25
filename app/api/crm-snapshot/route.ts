import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id, role")
    .eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Only admin/manager see the CRM snapshot
  if (!["admin", "manager", "roastery_manager"].includes(member.role))
    return NextResponse.json({ ok: true, data: null });

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: leads } = await svc
    .from("leads")
    .select("id, owner_user_id, status, updated_at")
    .eq("org_id", member.org_id)
    .not("status", "in", "(converted,lost)");

  const allLeads = leads ?? [];
  const now = Date.now();
  const STALE_MS = 7 * 86_400_000; // 7 days = overdue follow-up

  const unassigned = allLeads.filter(l => !l.owner_user_id).length;
  const total_leads = allLeads.length;

  // Count overdue (not updated in 7+ days) per owner
  const ownerMap: Record<string, { count: number; active: number; overdue: number }> = {};
  for (const l of allLeads) {
    const key = l.owner_user_id ?? "__none__";
    if (key === "__none__") continue;
    if (!ownerMap[key]) ownerMap[key] = { count: 0, active: 0, overdue: 0 };
    ownerMap[key].count++;
    ownerMap[key].active++;
    const updated = new Date((l.updated_at as any) ?? now).getTime();
    if (now - updated > STALE_MS) ownerMap[key].overdue++;
  }

  const ownerIds = Object.keys(ownerMap);
  let profiles: any[] = [];
  if (ownerIds.length > 0) {
    const { data } = await svc.from("profiles")
      .select("id, full_name, username").in("id", ownerIds);
    profiles = data ?? [];
  }

  const profMap: Record<string, { full_name: string | null; username: string | null }> = {};
  for (const p of profiles) profMap[p.id] = { full_name: p.full_name, username: p.username };

  const by_sales = Object.entries(ownerMap)
    .map(([uid, s]) => ({
      user_id: uid,
      full_name: profMap[uid]?.full_name ?? null,
      username: profMap[uid]?.username ?? null,
      lead_count: s.count,
      active_count: s.active,
      overdue_followup: s.overdue,
    }))
    .sort((a, b) => b.lead_count - a.lead_count);

  const overdue_followup = by_sales.reduce((s, r) => s + r.overdue_followup, 0);

  return NextResponse.json({
    ok: true,
    data: { total_leads, unassigned, overdue_followup, by_sales },
  });
}

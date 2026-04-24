import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";

async function resolve(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 }) } as const;
  const { data: member } = await supabase
    .from("org_members").select("org_id, role")
    .eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return { error: NextResponse.json({ error: "Không có tổ chức" }, { status: 403 }) } as const;
  return { supabase, user, orgId: member.org_id as string, role: member.role as string } as const;
}

// GET: list targets for the org, joined with profile name/role.
// Non-admins see only their own target.
export async function GET(request: Request) {
  const auth = await resolve(request);
  if ("error" in auth) return auth.error;
  const { supabase, user, orgId, role } = auth;
  const isAdmin = ["admin", "manager"].includes(role);

  // Members in the org
  let memberQ = supabase
    .from("org_members")
    .select("user_id, role, is_active")
    .eq("org_id", orgId)
    .eq("is_active", true);
  if (!isAdmin) memberQ = memberQ.eq("user_id", user.id);
  const { data: members, error: mErr } = await memberQ;
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });

  const userIds = (members ?? []).map((m: any) => m.user_id);
  if (userIds.length === 0) return NextResponse.json({ ok: true, data: [] });

  const [{ data: targets }, { data: profiles }] = await Promise.all([
    supabase.from("user_targets").select("user_id, monthly_revenue").eq("org_id", orgId).in("user_id", userIds),
    supabase.from("profiles").select("id, full_name").in("id", userIds),
  ]);

  const tMap: Record<string, number> = {};
  for (const t of targets ?? []) tMap[t.user_id] = Number(t.monthly_revenue ?? 0);
  const pMap: Record<string, string | null> = {};
  for (const p of profiles ?? []) pMap[p.id] = p.full_name;

  const rows = (members ?? []).map((m: any) => ({
    user_id: m.user_id,
    full_name: pMap[m.user_id] ?? null,
    role: m.role,
    monthly_revenue: tMap[m.user_id] ?? 0,
  }));

  return NextResponse.json({ ok: true, data: rows });
}

// PATCH body: { user_id, monthly_revenue } — admin/manager only.
export async function PATCH(request: Request) {
  const auth = await resolve(request);
  if ("error" in auth) return auth.error;
  const { supabase, user, orgId, role } = auth;
  if (!["admin", "manager"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({} as any));
  const targetUserId = body.user_id as string | undefined;
  const amount = Number(body.monthly_revenue);
  if (!targetUserId) return NextResponse.json({ error: "Thiếu user_id" }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 0)
    return NextResponse.json({ error: "monthly_revenue phải là số ≥ 0" }, { status: 400 });

  // Verify target is in same org
  const { data: tm } = await supabase
    .from("org_members").select("user_id")
    .eq("user_id", targetUserId).eq("org_id", orgId).maybeSingle();
  if (!tm) return NextResponse.json({ error: "User không thuộc tổ chức" }, { status: 404 });

  const { error } = await supabase
    .from("user_targets")
    .upsert(
      { org_id: orgId, user_id: targetUserId, monthly_revenue: amount, updated_by: user.id, updated_at: new Date().toISOString() },
      { onConflict: "org_id,user_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Returns recent audit entries for the caller's org.
// Only admin/manager can read (RLS enforces this server-side too).
export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["admin", "manager", "roastery_manager"].includes(member.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 100) || 100, 1), 500);
  const action = searchParams.get("action") ?? undefined;
  const entityType = searchParams.get("entity_type") ?? undefined;
  const actorId = searchParams.get("actor_id") ?? undefined;

  let q = supabase
    .from("audit_log")
    .select("id, action, entity_type, entity_id, meta, created_at, actor_user_id")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (action) q = q.eq("action", action);
  if (entityType) q = q.eq("entity_type", entityType);
  if (actorId) q = q.eq("actor_user_id", actorId);

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Resolve actor names with service-role (RLS may hide profiles otherwise).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let actorMap: Record<string, { full_name: string | null; username: string | null }> = {};
  if (url && key && rows && rows.length) {
    const svc = createClient(url, key, { auth: { persistSession: false } });
    const ids = Array.from(new Set(rows.map((r: any) => r.actor_user_id)));
    const { data: profs } = await svc.from("profiles")
      .select("id, full_name, username").in("id", ids);
    for (const p of profs ?? [])
      actorMap[(p as any).id] = { full_name: (p as any).full_name, username: (p as any).username };
  }

  const data = (rows ?? []).map((r: any) => ({
    ...r,
    actor: actorMap[r.actor_user_id] ?? null,
  }));

  return NextResponse.json({ ok: true, data });
}

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

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: allMembers } = await svc
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", member.org_id)
    .eq("is_active", true);

  const userIds = (allMembers ?? []).map((m: any) => m.user_id);
  let profiles: any[] = [];
  if (userIds.length > 0) {
    const { data } = await svc.from("profiles")
      .select("id, full_name, username").in("id", userIds);
    profiles = data ?? [];
  }

  const profMap: Record<string, any> = {};
  for (const p of profiles) profMap[p.id] = p;

  const members = (allMembers ?? []).map((m: any) => ({
    id: m.user_id,
    role: m.role,
    full_name: profMap[m.user_id]?.full_name ?? null,
    username: profMap[m.user_id]?.username ?? null,
  }));

  return NextResponse.json({
    ok: true,
    data: { members, currentUserId: user.id, currentRole: member.role },
  });
}

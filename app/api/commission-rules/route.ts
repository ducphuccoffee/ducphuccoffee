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

export async function GET(request: Request) {
  const auth = await resolve(request);
  if ("error" in auth) return auth.error;
  const { supabase, orgId } = auth;

  const { data, error } = await supabase
    .from("commission_rules")
    .select("*")
    .eq("org_id", orgId)
    .order("commission_type", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

// PATCH body: { id, fixed_amount?, collaborator_rate_per_kg?, is_active? }
export async function PATCH(request: Request) {
  const auth = await resolve(request);
  if ("error" in auth) return auth.error;
  const { supabase, orgId, role } = auth;
  if (!["admin", "manager"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({} as any));
  const id = body.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const patch: Record<string, any> = {};
  if (body.fixed_amount !== undefined) {
    const v = Number(body.fixed_amount);
    if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: "fixed_amount không hợp lệ" }, { status: 400 });
    patch.fixed_amount = v;
  }
  if (body.collaborator_rate_per_kg !== undefined) {
    const v = Number(body.collaborator_rate_per_kg);
    if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: "collaborator_rate_per_kg không hợp lệ" }, { status: 400 });
    patch.collaborator_rate_per_kg = v;
  }
  if (body.is_active !== undefined) patch.is_active = !!body.is_active;

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Không có gì để cập nhật" }, { status: 400 });

  const { error } = await supabase
    .from("commission_rules")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// POST body: { commission_type, fixed_amount?, collaborator_rate_per_kg? }
export async function POST(request: Request) {
  const auth = await resolve(request);
  if ("error" in auth) return auth.error;
  const { supabase, user, orgId, role } = auth;
  if (!["admin", "manager"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({} as any));
  const commissionType = (body.commission_type ?? "").trim();
  if (!commissionType) return NextResponse.json({ error: "Thiếu commission_type" }, { status: 400 });

  const { error } = await supabase.from("commission_rules").insert({
    org_id: orgId,
    commission_type: commissionType,
    fixed_amount: Number(body.fixed_amount) || 0,
    collaborator_rate_per_kg: Number(body.collaborator_rate_per_kg) || 0,
    is_active: true,
    created_by: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

const CRM_TYPES = ["crm_followup", "visit", "quotation_followup", "debt_followup"];

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const owner = searchParams.get("owner_user_id");
  const leadId = searchParams.get("lead_id");
  const customerId = searchParams.get("customer_id");
  const oppId = searchParams.get("opportunity_id");

  let q = supabase
    .from("tasks")
    .select("id, org_id, type, status, role, ref_type, ref_id, lead_id, customer_id, opportunity_id, owner_user_id, description, due_at, created_by, created_at")
    .eq("org_id", member.org_id)
    .in("type", CRM_TYPES)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) q = q.eq("status", status);
  else q = q.in("status", ["todo", "in_progress"]);
  if (owner) q = q.eq("owner_user_id", owner);
  if (leadId) q = q.eq("lead_id", leadId);
  if (customerId) q = q.eq("customer_id", customerId);
  if (oppId) q = q.eq("opportunity_id", oppId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const type = body.type || "crm_followup";
  if (!CRM_TYPES.includes(type))
    return NextResponse.json({ error: `type phải là: ${CRM_TYPES.join(", ")}` }, { status: 400 });

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      org_id:         member.org_id,
      type,
      status:         "todo",
      role:           "sales",
      ref_type:       body.ref_type || null,
      ref_id:         body.ref_id || null,
      lead_id:        body.lead_id || null,
      customer_id:    body.customer_id || null,
      opportunity_id: body.opportunity_id || null,
      owner_user_id:  body.owner_user_id || user.id,
      description:    body.description?.trim() || null,
      due_at:         body.due_at || null,
      created_by:     user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const ALLOWED = ["status", "description", "due_at", "owner_user_id"];
  const patch: Record<string, any> = {};
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key];
  }

  const { data, error } = await supabase
    .from("tasks").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

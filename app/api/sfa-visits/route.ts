import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

const VALID_RESULTS = ["no_answer", "met_owner", "sampled", "quoted", "followup_needed", "won", "lost"];

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customer_id");
  const leadId = searchParams.get("lead_id");
  const owner = searchParams.get("owner_user_id");

  let q = supabase
    .from("sfa_visits")
    .select("*, customers(id, name), leads(id, name)")
    .eq("org_id", member.org_id)
    .order("checkin_at", { ascending: false })
    .limit(200);

  if (customerId) q = q.eq("customer_id", customerId);
  if (leadId) q = q.eq("lead_id", leadId);
  if (owner) q = q.eq("owner_user_id", owner);

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
  if (!body.customer_id && !body.lead_id)
    return NextResponse.json({ error: "Cần customer_id hoặc lead_id" }, { status: 400 });
  if (body.result && !VALID_RESULTS.includes(body.result))
    return NextResponse.json({ error: `result phải là: ${VALID_RESULTS.join(", ")}` }, { status: 400 });

  const { data: visit, error } = await supabase
    .from("sfa_visits")
    .insert({
      org_id:        member.org_id,
      lead_id:       body.lead_id || null,
      customer_id:   body.customer_id || null,
      owner_user_id: user.id,
      checkin_at:    body.checkin_at || new Date().toISOString(),
      checkout_at:   body.checkout_at || null,
      checkin_lat:   body.checkin_lat || null,
      checkin_lng:   body.checkin_lng || null,
      result:        body.result || null,
      note:          body.note?.trim() || null,
      created_by:    user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // If this check-in fulfills a planned visit task, mark that task done.
  if (body.task_id) {
    await supabase.from("tasks")
      .update({ status: "done" })
      .eq("id", body.task_id)
      .eq("org_id", member.org_id);
  }

  // Auto-create follow-up task if result = followup_needed
  if (body.result === "followup_needed") {
    await supabase.from("tasks").insert({
      org_id:        member.org_id,
      type:          "crm_followup",
      status:        "todo",
      role:          "sales",
      ref_type:      "visit",
      ref_id:        visit.id,
      lead_id:       body.lead_id || null,
      customer_id:   body.customer_id || null,
      owner_user_id: user.id,
      description:   `Follow-up sau ghé thăm: ${body.note?.trim()?.slice(0, 50) || "cần liên hệ lại"}`,
      created_by:    user.id,
    });
  }

  // Log as crm_activity
  await supabase.from("crm_activities").insert({
    org_id:        member.org_id,
    lead_id:       body.lead_id || null,
    customer_id:   body.customer_id || null,
    type:          "visit",
    content:       `Check-in${body.result ? ` — ${body.result}` : ""}${body.note ? `: ${body.note.trim().slice(0, 100)}` : ""}`,
    owner_user_id: user.id,
    created_by:    user.id,
  });

  return NextResponse.json({ ok: true, data: visit });
}

export async function PATCH(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const ALLOWED = ["checkout_at", "result", "note"];
  const patch: Record<string, any> = {};
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key];
  }

  if (patch.result && !VALID_RESULTS.includes(patch.result))
    return NextResponse.json({ error: `result phải là: ${VALID_RESULTS.join(", ")}` }, { status: 400 });

  const { data, error } = await supabase
    .from("sfa_visits").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

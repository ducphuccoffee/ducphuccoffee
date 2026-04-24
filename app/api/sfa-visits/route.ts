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
  const planned = searchParams.get("planned") === "true";
  const followup = searchParams.get("followup_needed") === "true";

  let q = supabase
    .from("sfa_visits")
    .select("*, customers(id, name), leads(id, name)")
    .eq("org_id", member.org_id)
    .order("checkin_at", { ascending: false })
    .limit(200);

  if (customerId) q = q.eq("customer_id", customerId);
  if (leadId) q = q.eq("lead_id", leadId);
  if (owner) q = q.eq("owner_user_id", owner);
  if (planned) {
    // Planned visits: result IS NULL AND checkout_at IS NULL (not yet executed).
    q = q.is("result", null).is("checkout_at", null);
  }
  if (followup) {
    q = q.eq("result", "followup_needed");
  }

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

  // ── Mode A: plan a visit (no check-in yet). Stores row with result/checkout_at = NULL.
  // checkin_at holds the SCHEDULED time for planned visits.
  if (body.mode === "plan") {
    const scheduled = body.scheduled_at || body.checkin_at;
    if (!scheduled)
      return NextResponse.json({ error: "Cần scheduled_at" }, { status: 400 });

    const { data: planned, error: planErr } = await supabase
      .from("sfa_visits")
      .insert({
        org_id:        member.org_id,
        lead_id:       body.lead_id || null,
        customer_id:   body.customer_id || null,
        owner_user_id: body.owner_user_id || user.id,
        checkin_at:    scheduled,
        checkout_at:   null,
        checkin_lat:   null,
        checkin_lng:   null,
        result:        null,
        note:          body.note?.trim() || null,
        created_by:    user.id,
      })
      .select()
      .single();

    if (planErr) return NextResponse.json({ error: planErr.message }, { status: 400 });
    return NextResponse.json({ ok: true, data: planned, mode: "plan" });
  }

  // ── Mode B: check-in. If visit_id provided, UPDATE that planned row; else INSERT new.
  if (body.result && !VALID_RESULTS.includes(body.result))
    return NextResponse.json({ error: `result phải là: ${VALID_RESULTS.join(", ")}` }, { status: 400 });

  let visit: any;
  let err: any;

  if (body.visit_id) {
    // Fulfilling a previously-planned visit.
    const { data, error } = await supabase
      .from("sfa_visits")
      .update({
        checkin_at:  body.checkin_at || new Date().toISOString(),
        checkout_at: body.checkout_at || null,
        checkin_lat: body.checkin_lat ?? null,
        checkin_lng: body.checkin_lng ?? null,
        result:      body.result || null,
        note:        body.note?.trim() || null,
      })
      .eq("id", body.visit_id)
      .eq("org_id", member.org_id)
      .select()
      .single();
    visit = data; err = error;
  } else {
    const { data, error } = await supabase
      .from("sfa_visits")
      .insert({
        org_id:        member.org_id,
        lead_id:       body.lead_id || null,
        customer_id:   body.customer_id || null,
        owner_user_id: user.id,
        checkin_at:    body.checkin_at || new Date().toISOString(),
        checkout_at:   body.checkout_at || null,
        checkin_lat:   body.checkin_lat ?? null,
        checkin_lng:   body.checkin_lng ?? null,
        result:        body.result || null,
        note:          body.note?.trim() || null,
        created_by:    user.id,
      })
      .select()
      .single();
    visit = data; err = error;
  }

  if (err) return NextResponse.json({ error: err.message }, { status: 400 });

  // NOTE: we intentionally do NOT insert into tasks. The tasks table is reserved
  // for the order workflow (confirm_order / prepare_order / deliver_order) and
  // its CHECK constraint rejects CRM/SFA types.
  //
  // Follow-up tracking is recorded directly on sfa_visits (result='followup_needed')
  // and surfaced in /api/sales-today under visits.followup_needed.

  // Log as crm_activity (audit trail — crm_activities.type accepts 'visit').
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

  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const ALLOWED = ["checkin_at", "checkout_at", "result", "note", "checkin_lat", "checkin_lng"];
  const patch: Record<string, any> = {};
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key];
  }

  if (patch.result && !VALID_RESULTS.includes(patch.result))
    return NextResponse.json({ error: `result phải là: ${VALID_RESULTS.join(", ")}` }, { status: 400 });

  const { data, error } = await supabase
    .from("sfa_visits").update(patch).eq("id", id).eq("org_id", member.org_id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

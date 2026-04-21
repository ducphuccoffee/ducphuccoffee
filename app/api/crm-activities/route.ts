import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("lead_id");
  const customerId = searchParams.get("customer_id");
  const oppId = searchParams.get("opportunity_id");

  let q = supabase
    .from("crm_activities")
    .select("*")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (leadId) q = q.eq("lead_id", leadId);
  if (customerId) q = q.eq("customer_id", customerId);
  if (oppId) q = q.eq("opportunity_id", oppId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

const VALID_TYPES = ["call", "message", "meeting", "visit", "quotation", "note"];

export async function POST(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const type = body.type;
  if (!type || !VALID_TYPES.includes(type))
    return NextResponse.json({ error: `type phải là: ${VALID_TYPES.join(", ")}` }, { status: 400 });
  if (!body.lead_id && !body.customer_id)
    return NextResponse.json({ error: "Cần lead_id hoặc customer_id" }, { status: 400 });

  const { data, error } = await supabase
    .from("crm_activities")
    .insert({
      org_id:         member.org_id,
      lead_id:        body.lead_id || null,
      customer_id:    body.customer_id || null,
      opportunity_id: body.opportunity_id || null,
      type,
      content:        body.content?.trim() || null,
      owner_user_id:  user.id,
      created_by:     user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Auto-update lead status if still 'new' and activity is call/meeting
  if (body.lead_id && ["call", "meeting"].includes(type)) {
    await supabase
      .from("leads")
      .update({ status: "contacted", updated_at: new Date().toISOString() })
      .eq("id", body.lead_id)
      .eq("status", "new");
  }

  return NextResponse.json({ ok: true, data });
}

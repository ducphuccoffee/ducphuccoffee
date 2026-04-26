import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

const VALID_STAGES = ["new", "consulting", "demo", "quoted", "negotiating", "won", "lost"];

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage");
  const owner = searchParams.get("owner_user_id");

  let q = supabase
    .from("opportunities")
    .select("*, leads(name, phone), customers(name, phone)")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (stage) q = q.eq("stage", stage);
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
  if (!body.title?.trim()) return NextResponse.json({ error: "title bắt buộc" }, { status: 400 });
  if (!body.lead_id && !body.customer_id)
    return NextResponse.json({ error: "Cần lead_id hoặc customer_id" }, { status: 400 });

  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      org_id:              member.org_id,
      lead_id:             body.lead_id || null,
      customer_id:         body.customer_id || null,
      title:               body.title.trim(),
      expected_value:      Number(body.expected_value || 0),
      probability:         Number(body.probability || 50),
      stage:               "new",
      owner_user_id:       body.owner_user_id || user.id,
      expected_close_date: body.expected_close_date || null,
      created_by:          user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Update lead status to quoted if from lead
  if (body.lead_id) {
    await supabase
      .from("leads")
      .update({ status: "quoted", updated_at: new Date().toISOString() })
      .eq("id", body.lead_id)
      .in("status", ["new", "contacted", "meeting_scheduled"]);
  }

  return NextResponse.json({ ok: true, data });
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
  const ALLOWED = ["title", "expected_value", "probability", "stage", "owner_user_id", "expected_close_date", "customer_id"];
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key];
  }

  if (patch.stage && !VALID_STAGES.includes(patch.stage))
    return NextResponse.json({ error: `stage phải là: ${VALID_STAGES.join(", ")}` }, { status: 400 });

  const { data, error } = await supabase
    .from("opportunities").update(patch)
    .eq("id", id)
    .eq("org_id", member.org_id)
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Không tìm thấy cơ hội" }, { status: 404 });
  return NextResponse.json({ ok: true, data });
}

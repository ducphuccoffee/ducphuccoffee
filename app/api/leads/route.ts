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
  const status = searchParams.get("status");
  const owner = searchParams.get("owner_user_id");

  let q = supabase
    .from("leads")
    .select("*")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) q = q.eq("status", status);
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
  if (!body.name?.trim()) return NextResponse.json({ error: "Tên lead bắt buộc" }, { status: 400 });

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      org_id:        member.org_id,
      name:          body.name.trim(),
      phone:         body.phone?.trim() || null,
      address:       body.address?.trim() || null,
      area:          body.area?.trim() || null,
      source:        body.source?.trim() || null,
      demand:        body.demand?.trim() || null,
      temperature:   body.temperature || "cold",
      status:        "new",
      owner_user_id: body.owner_user_id || user.id,
      created_by:    user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // NOTE: we do NOT insert into tasks — the tasks CHECK constraint only allows
  // order-workflow types (confirm_order / prepare_order / deliver_order).
  // New-lead follow-ups are surfaced by /api/sales-today via the stale-lead
  // query (lead with no activity in the active pipeline).

  return NextResponse.json({ ok: true, data: lead });
}

export async function PATCH(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const ALLOWED = ["name", "phone", "address", "area", "source", "demand", "temperature", "status", "owner_user_id"];
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key];
  }

  const { data, error } = await supabase
    .from("leads").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // If converted, auto-create customer
  if (body.status === "converted" && !data.converted_customer_id) {
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .insert({
        org_id:        data.org_id,
        name:          data.name,
        phone:         data.phone,
        address:       data.address,
        stage:         "new",
        crm_segment:   "lead",
        crm_status:    "active",
        owner_user_id: data.owner_user_id,
        created_by:    user.id,
      })
      .select("id")
      .single();

    if (customer && !custErr) {
      await supabase.from("leads").update({ converted_customer_id: customer.id }).eq("id", id);
      return NextResponse.json({ ok: true, data: { ...data, converted_customer_id: customer.id }, customer_id: customer.id });
    }
  }

  return NextResponse.json({ ok: true, data });
}

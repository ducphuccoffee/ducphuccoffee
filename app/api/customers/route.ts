import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export async function GET(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone, address")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);

  // 1) Resolve authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  console.log("[customers POST] auth.user.id =", user?.id ?? "null");

  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  // 2) Look up org_id from org_members using the authenticated user
  const { data: member, error: memberErr } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  console.log("[customers POST] org_id =", member?.org_id ?? "null", "| memberErr =", memberErr?.message ?? "none");

  if (memberErr || !member?.org_id) {
    return NextResponse.json(
      { error: "User is not assigned to any organization" },
      { status: 403 }
    );
  }

  // 3) Parse and validate body
  const body = await request.json();
  const { name, phone, address } = body;
  if (!name?.trim())
    return NextResponse.json({ error: "Thiếu tên khách hàng" }, { status: 400 });

  const payload = {
    org_id:         member.org_id,
    owner_user_id:  user.id,
    name:           name.trim(),
    phone:          phone?.trim()   || null,
    address:        address?.trim() || null,
  };

  console.log("[customers POST] insert payload =", JSON.stringify(payload));

  // 4) Insert
  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select("id, name, phone, address")
    .single();

  if (error) {
    console.error("[customers POST] insert error =", error.message, "|", error.details, "|", error.hint);
    return NextResponse.json(
      { error: error.message, details: error.details, hint: error.hint },
      { status: 400 }
    );
  }

  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  const body = await request.json();
  const { name, phone, address } = body;
  if (!name?.trim())
    return NextResponse.json({ error: "Thiếu tên khách hàng" }, { status: 400 });
  const { data, error } = await supabase
    .from("customers")
    .update({ name: name.trim(), phone: phone?.trim() || null, address: address?.trim() || null })
    .eq("id", id)
    .select("id, name, phone, address")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

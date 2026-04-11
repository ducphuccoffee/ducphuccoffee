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
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  // 2) Resolve org_id from org_members
  const { data: member, error: memberErr } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (memberErr || !member?.org_id) {
    return NextResponse.json(
      { error: "User is not assigned to any organization" },
      { status: 403 }
    );
  }

  // 3) Validate body
  const body = await request.json();
  const { name, phone, address } = body;
  if (!name?.trim())
    return NextResponse.json({ error: "Thiếu tên khách hàng" }, { status: 400 });

  // 4) Insert — payload matches live schema columns exactly:
  //    org_id (NOT NULL), owner_user_id (NOT NULL), created_by (NOT NULL),
  //    name (NOT NULL), phone (nullable), address (nullable)
  const { data, error } = await supabase
    .from("customers")
    .insert({
      org_id:        member.org_id,
      owner_user_id: user.id,
      created_by:    user.id,
      name:          name.trim(),
      phone:         phone?.trim()   || null,
      address:       address?.trim() || null,
    })
    .select("id, name, phone, address")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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

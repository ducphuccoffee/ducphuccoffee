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

  // Resolve auth session — required to satisfy any owner_id-based RLS policy
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  // DEBUG: log auth state (remove after confirming fix works)
  console.log("[customers POST] auth.user.id =", user?.id ?? "null");
  console.log("[customers POST] auth.error   =", authErr?.message ?? "none");

  if (!user) {
    return NextResponse.json(
      { error: "Không xác thực được người dùng. Vui lòng đăng nhập lại." },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { name, phone, address } = body;
  if (!name?.trim())
    return NextResponse.json({ error: "Thiếu tên khách hàng" }, { status: 400 });

  const payload = {
    name:       name.trim(),
    phone:      phone?.trim()   || null,
    address:    address?.trim() || null,
    owner_id:   user.id,   // satisfies: owner_id = auth.uid()
    created_by: user.id,   // satisfies: created_by = auth.uid() if that column exists
  };

  // DEBUG: log full insert payload (remove after confirming fix works)
  console.log("[customers POST] insert payload =", JSON.stringify(payload));

  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select("id, name, phone, address")
    .single();

  if (error) {
    // Return detailed error to aid diagnosis
    console.error("[customers POST] insert error =", error.message, error.details, error.hint);
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

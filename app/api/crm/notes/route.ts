import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

async function getOrgId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return data?.org_id ?? null;
}

async function customerInOrg(customerId: string, orgId: string): Promise<boolean> {
  const { data } = await svc()
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("org_id", orgId)
    .maybeSingle();
  return !!data;
}

export async function GET(request: Request) {
  const res = NextResponse.json({});
  const supabase = createRouteSupabase(request, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customer_id");
  if (!customerId) return NextResponse.json({ error: "customer_id required" }, { status: 400 });

  if (!(await customerInOrg(customerId, orgId)))
    return NextResponse.json({ error: "Không có quyền truy cập khách hàng này" }, { status: 403 });

  const { data, error } = await svc()
    .from("customer_notes")
    .select("id, content, created_by, created_at, profiles(full_name)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const res = NextResponse.json({});
  const supabase = createRouteSupabase(request, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const body = await request.json();
  const { customer_id, content } = body;
  if (!customer_id || !content?.trim())
    return NextResponse.json({ error: "customer_id and content required" }, { status: 400 });

  if (!(await customerInOrg(customer_id, orgId)))
    return NextResponse.json({ error: "Không có quyền truy cập khách hàng này" }, { status: 403 });

  const { data, error } = await svc()
    .from("customer_notes")
    .insert({ customer_id, content: content.trim(), created_by: user.id })
    .select("id, content, created_by, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const res = NextResponse.json({});
  const supabase = createRouteSupabase(request, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase, user.id);
  if (!orgId) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Verify the note's customer belongs to the user's org
  const { data: note } = await svc()
    .from("customer_notes")
    .select("id, customer_id, customers(org_id)")
    .eq("id", id)
    .maybeSingle();
  if (!note) return NextResponse.json({ error: "Không tìm thấy ghi chú" }, { status: 404 });
  const noteOrgId = (note as any).customers?.org_id;
  if (noteOrgId !== orgId)
    return NextResponse.json({ error: "Không có quyền xoá ghi chú này" }, { status: 403 });

  const { error } = await svc().from("customer_notes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

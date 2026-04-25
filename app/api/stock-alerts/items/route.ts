import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function requireOrg() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const { data: m } = await supabase
    .from("org_members").select("org_id, role")
    .eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!m?.org_id) return { err: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
  return { supabase, user, orgId: m.org_id as string, role: m.role as string } as const;
}

export async function GET() {
  const a = await requireOrg();
  if ("err" in a) return a.err;
  const { supabase, orgId } = a;

  const { data, error } = await supabase
    .from("items")
    .select("id, name, sku, uom, type, min_stock")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: Request) {
  const a = await requireOrg();
  if ("err" in a) return a.err;
  const { supabase, user, orgId, role } = a;
  if (!["admin", "manager", "roastery_manager", "warehouse"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = await req.json().catch(() => ({} as any));
  if (!("min_stock" in body))
    return NextResponse.json({ error: "Thiếu min_stock" }, { status: 400 });

  const v = body.min_stock;
  let value: number | null;
  if (v === null || v === "" || v === undefined) value = null;
  else {
    const n = Number(v);
    if (isNaN(n) || n < 0) return NextResponse.json({ error: "min_stock không hợp lệ" }, { status: 400 });
    value = n;
  }

  const { data: prior } = await supabase
    .from("items").select("min_stock, name").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!prior) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const { error } = await supabase
    .from("items").update({ min_stock: value }).eq("id", id).eq("org_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAudit({
    orgId, actorId: user.id,
    action: "item.update_min_stock",
    entityType: "item",
    entityId: id,
    meta: { name: prior.name, min_stock: { from: prior.min_stock, to: value } },
  });

  return NextResponse.json({ ok: true });
}

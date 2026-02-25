import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ORG_ID = "00000000-0000-0000-0000-000000000001" as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function genLotCode(prefix = "GB") {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  const rand = Math.random().toString(16).slice(2, 6);
  return `${prefix}-${y}${m}${day}-${hh}${mm}${ss}-${rand}`;
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient();

  const { data: me } = await supabase.auth.getUser();
  if (!me?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    purchased_at?: string;
    lot_code?: string | null;
    supplier_id?: string | null;
    item_id?: string;
    qty_kg?: number;
    unit_price?: number;
  };

  const purchasedAt = body.purchased_at ? new Date(body.purchased_at) : new Date();
  const lotCode = (body.lot_code ?? "").trim() || genLotCode();
  const supplierId = body.supplier_id ?? null;
  const itemId = body.item_id;
  const qtyKg = Number(body.qty_kg || 0);
  const unitPrice = Number(body.unit_price || 0);

  if (!itemId) return NextResponse.json({ error: "Thiếu loại nhân" }, { status: 400 });
  if (!Number.isFinite(qtyKg) || qtyKg <= 0) return NextResponse.json({ error: "Số kg không hợp lệ" }, { status: 400 });
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return NextResponse.json({ error: "Đơn giá không hợp lệ" }, { status: 400 });

  // 1) create purchase header
  const { data: purchase, error: pErr } = await supabase
    .from("purchases")
    .insert({
      org_id: ORG_ID,
      purchased_at: purchasedAt.toISOString(),
      lot_code: lotCode,
      supplier_id: supplierId,
      // keep supplier_name nullable for legacy
      note: null,
      created_by: me.user.id,
    })
    .select("id")
    .single();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  // 2) create line
  const lineTotal = qtyKg * unitPrice;
  const { error: liErr } = await supabase.from("purchase_items").insert({
    purchase_id: purchase.id,
    item_id: itemId,
    qty_kg: qtyKg,
    unit_price: unitPrice,
    line_total: lineTotal,
  });

  if (liErr) {
    // Try to clean up header (best-effort)
    await supabase.from("purchases").delete().eq("id", purchase.id);
    return NextResponse.json({ error: liErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, purchase_id: purchase.id });
}

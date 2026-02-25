// app/api/inventory-in/route.ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ORG_ID = "00000000-0000-0000-0000-000000000001" as const;

function toNumber(v: any) {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : NaN;
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient();

  // 1) yêu cầu đăng nhập
  const { data: me } = await supabase.auth.getUser();
  if (!me?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2) đọc body
  const body = (await req.json()) as {
    purchased_at?: string; // ISO string
    lot_code?: string;
    supplier_id?: string | null;
    supplier_name?: string | null;
    note?: string | null;
    item_id?: string;
    qty_kg?: number | string;
    unit_price?: number | string;
  };

  const purchasedAt = body.purchased_at ? new Date(body.purchased_at).toISOString() : new Date().toISOString();
  const itemId = (body.item_id ?? "").trim();
  const qtyKg = toNumber(body.qty_kg);
  const unitPrice = toNumber(body.unit_price);

  if (!itemId) return NextResponse.json({ error: "Thiếu item_id (loại nhân)" }, { status: 400 });
  if (!Number.isFinite(qtyKg) || qtyKg <= 0) return NextResponse.json({ error: "qty_kg không hợp lệ" }, { status: 400 });
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return NextResponse.json({ error: "unit_price không hợp lệ" }, { status: 400 });

  // 3) tạo phiếu nhập (purchases)
  const { data: purchase, error: pErr } = await supabase
    .from("purchases")
    .insert({
      org_id: ORG_ID,
      purchased_at: purchasedAt,
      lot_code: (body.lot_code ?? "").trim() || null, // nếu bạn chưa có cột lot_code -> thêm cột như mình nói trước
      supplier_id: body.supplier_id ?? null,
      supplier_name: (body.supplier_name ?? "").trim() || null,
      note: (body.note ?? "").trim() || null,
      created_by: me.user.id,
    })
    .select("id")
    .single();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  // 4) tạo dòng nhập (purchase_lines) ✅ đúng bảng của bạn
  const { error: lineErr } = await supabase.from("purchase_lines").insert({
    purchase_id: purchase.id,
    item_id: itemId,
    qty_kg: qtyKg,
    unit_price: unitPrice,
    line_total: qtyKg * unitPrice, // nullable, nhưng set luôn cho chắc
  });

  if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, purchase_id: purchase.id });
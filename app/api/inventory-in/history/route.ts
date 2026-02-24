import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ORG_ID = "00000000-0000-0000-0000-000000000001" as const;

function genLotCode(prefix = "GB") {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${stamp}-${rand}`;
}

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: me } = await supabase.auth.getUser();
    if (!me?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as {
      purchased_at?: string;
      lot_code?: string;
      supplier_id?: string | null;
      supplier_name?: string | null;
      item_id?: string;
      qty_kg?: number;
      unit_price?: number;
    };

    const purchased_at = body.purchased_at ? new Date(body.purchased_at).toISOString() : new Date().toISOString();
    const lot_code = (body.lot_code ?? "").trim() || genLotCode("GB");
    const supplier_id = body.supplier_id ?? null;
    const item_id = body.item_id;
    const qty_kg = Number(body.qty_kg);
    const unit_price = Number(body.unit_price);

    if (!item_id) return NextResponse.json({ error: "Missing item_id" }, { status: 400 });
    if (!(qty_kg > 0)) return NextResponse.json({ error: "qty_kg must be > 0" }, { status: 400 });
    if (!(unit_price > 0)) return NextResponse.json({ error: "unit_price must be > 0" }, { status: 400 });

    // snapshot supplier name (ưu tiên lấy từ suppliers nếu có supplier_id)
    let supplier_name: string | null = (body.supplier_name ?? null)?.trim() || null;

    if (supplier_id) {
      const { data: s, error: sErr } = await supabase
        .from("suppliers")
        .select("name")
        .eq("id", supplier_id)
        .single();

      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });
      supplier_name = s?.name ?? supplier_name;
    }

    // 1) tạo purchase
    const { data: purchase, error: pErr } = await supabase
      .from("purchases")
      .insert({
        org_id: ORG_ID,
        purchased_at,
        supplier_id,
        supplier_name,
        note: lot_code, // dùng note làm số lô
        created_by: me.user.id,
      })
      .select("id")
      .single();

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

    // 2) tạo purchase_line
    const line_total = qty_kg * unit_price;

    const { data: line, error: lErr } = await supabase
      .from("purchase_lines")
      .insert({
        purchase_id: purchase.id,
        item_id,
        qty_kg,
        unit_price,
        line_total,
      })
      .select("id")
      .single();

    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      purchase_id: purchase.id,
      line_id: line.id,
      lot_code,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
// app/api/batches/route.ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();

  const [batchesRes, stockRes] = await Promise.all([
    supabase
      .from("roast_batches")
      .select("*")
      .order("roast_date", { ascending: false })
      .limit(200),
    supabase
      .from("v_green_stock")
      .select("*")
      .gte("remaining_kg", 0)
      .order("inbound_at", { ascending: true }), // FIFO
  ]);

  return NextResponse.json({
    batches: batchesRes.data ?? [],
    stock: stockRes.data ?? [],
    error: batchesRes.error?.message ?? stockRes.error?.message ?? null,
  });
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient();

  const { data: me } = await supabase.auth.getUser();

  const body = await req.json() as {
    green_inbound_id: string;
    input_kg: number;
    output_kg: number;
    note?: string;
  };

  if (!body.green_inbound_id)
    return NextResponse.json({ error: "Thiếu lô nhân" }, { status: 400 });
  if (!body.input_kg || body.input_kg <= 0)
    return NextResponse.json({ error: "Số kg đầu vào không hợp lệ" }, { status: 400 });
  if (!body.output_kg || body.output_kg <= 0)
    return NextResponse.json({ error: "Số kg thành phẩm không hợp lệ" }, { status: 400 });
  if (body.output_kg > body.input_kg)
    return NextResponse.json({ error: "Thành phẩm không thể lớn hơn đầu vào" }, { status: 400 });

  // Lấy thông tin lô nhân + tồn
  const { data: lot, error: lotErr } = await supabase
    .from("v_green_stock")
    .select("*")
    .eq("green_inbound_id", body.green_inbound_id)
    .single();

  if (lotErr || !lot)
    return NextResponse.json({ error: "Không tìm thấy lô nhân" }, { status: 400 });

  if (body.input_kg > Number(lot.remaining_kg))
    return NextResponse.json({
      error: `Lô "${lot.lot_code}" chỉ còn ${lot.remaining_kg}kg, không đủ để rang ${body.input_kg}kg`,
    }, { status: 400 });

  // Auto batch_code: BATCH-YYYYMMDD-NNN
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `BATCH-${today}`;
  const { count } = await supabase
    .from("roast_batches")
    .select("*", { count: "exact", head: true })
    .like("batch_code", `${prefix}-%`);
  const seq = String((count ?? 0) + 1).padStart(3, "0");
  const batch_code = `${prefix}-${seq}`;

  const { data, error } = await supabase
    .from("roast_batches")
    .insert({
      batch_code,
      roast_date: new Date().toISOString().slice(0, 10),
      status: "completed", // tạo là completed luôn
      green_inbound_id: body.green_inbound_id,
      green_type_id: lot.green_type_id,
      green_type_name: lot.green_type_name,
      lot_code: lot.lot_code,
      input_kg: body.input_kg,
      output_kg: body.output_kg,
      unit_cost_green: Number(lot.unit_cost),
      note: body.note ?? null,
      created_by: me?.user?.id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

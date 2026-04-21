import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS for inserts that need it
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));

  const [batchesRes, stockRes] = await Promise.all([
    supabase
      .from("roast_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("v_green_stock")
      .select("*")
      .gte("remaining_kg", 0)
      .order("inbound_at", { ascending: true }),
  ]);

  return NextResponse.json({
    batches: batchesRes.data ?? [],
    stock: stockRes.data ?? [],
    error: batchesRes.error?.message ?? stockRes.error?.message ?? null,
  });
}

export async function POST(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);
  const svc = createServiceClient();

  // 1) Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  // 2) Resolve org_id từ user thật (không hardcode)
  const { data: member, error: memberErr } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (memberErr || !member?.org_id)
    return NextResponse.json({ error: "User không thuộc tổ chức nào" }, { status: 403 });

  // 3) Validate body
  const body = await request.json() as {
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

  // 4) Lấy thông tin lô nhân + kiểm tra tồn kho
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

  // 5) Auto batch_code: BATCH-YYYYMMDD-NNN
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `BATCH-${todayStr}`;
  const { count } = await supabase
    .from("roast_batches")
    .select("*", { count: "exact", head: true })
    .like("batch_code", `${prefix}-%`);
  const seq = String((count ?? 0) + 1).padStart(3, "0");
  const batch_code = `${prefix}-${seq}`;

  // 6) Calculate cost fields correctly
  const input_kg  = body.input_kg;
  const output_kg = body.output_kg;
  const unit_cost = Number(lot.unit_cost);
  const loss_kg      = input_kg - output_kg;
  const loss_percent = input_kg > 0 ? Math.round(((loss_kg / input_kg) * 100) * 100) / 100 : 0;
  const cost_per_kg  = output_kg > 0 ? Math.round((input_kg * unit_cost) / output_kg) : 0;
  const cost_total   = cost_per_kg * output_kg;

  // 7) Insert batch
  const { data, error } = await svc
    .from("roast_batches")
    .insert({
      org_id:           member.org_id,
      batch_code,
      roast_date:       new Date().toISOString().slice(0, 10),
      status:           "completed",
      green_inbound_id: body.green_inbound_id,
      green_type_id:    lot.green_type_id,
      green_type_name:  lot.green_type_name,
      lot_code:         lot.lot_code,
      input_kg,
      output_kg,
      loss_kg,
      loss_percent,
      unit_cost_green:  unit_cost,
      cost_per_kg,
      cost_total,
      note:             body.note ?? null,
      created_by:       user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // 7) Insert roasted_stock_lot for finished goods tracking
  const { error: rstErr } = await svc
    .from("roasted_stock_lots")
    .insert({
      org_id:        member.org_id,
      green_type_id: lot.green_type_id,
      batch_id:      data.id,
      qty_kg:        output_kg,
      remaining_kg:  output_kg,
      cost_per_kg:   cost_per_kg,
    });
  if (rstErr) {
    console.error("[batches] roasted_stock_lots insert failed:", rstErr.message);
  }

  // Log stock movement
  const { error: _mvErr } = await svc.from("stock_movements").insert({
    org_id:        member.org_id,
    green_type_id: lot.green_type_id,
    movement_type: "production_in",
    qty_kg:        output_kg,
  });
  if (_mvErr) console.error("[batches] stock_movement log failed:", _mvErr.message);

  return NextResponse.json({ ok: true, data });
}

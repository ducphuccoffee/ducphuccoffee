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

  // 6) Insert via service-role (authenticated user is set, RLS satisfied by having the right data)
  // Use service client to ensure insert succeeds regardless of token refresh edge cases.
  // org_id and created_by are always set from server-side validated data.
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
      input_kg:         body.input_kg,
      output_kg:        body.output_kg,
      unit_cost_green:  Number(lot.unit_cost),
      note:             body.note ?? null,
      created_by:       user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

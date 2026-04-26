import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";
import { createClient } from "@supabase/supabase-js";
import { ORDER_STATUSES } from "@/lib/order-constants";
import { writeAudit } from "@/lib/audit";

// Service-role client — bypasses RLS for order_items insert
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

// Generate order code from UUID (used in response since DB doesn't store it yet)
function makeOrderCode(id: string) {
  return "#" + id.slice(0, 8).toUpperCase();
}

// Actual orders columns in current DB:
//   id, org_id, customer_id, status, total_qty_kg, total_amount,
//   delivered_by, created_by, created_at, owner_user_id
// order_items columns:
//   id, order_id, product_id, product_name, unit, qty, unit_price, subtotal

const SELECT_ORDERS = `
  id, org_id, customer_id, status, total_qty_kg, total_amount, created_by, created_at,
  customers(id, name, phone),
  order_items(id, product_id, product_name, unit, qty, unit_price, subtotal)
`.trim();

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customer_id");
  const status     = searchParams.get("status");
  const limit  = Math.min(Math.max(parseInt(searchParams.get("limit")  ?? "100", 10) || 100, 1), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0",   10) || 0, 0);

  let q = supabase
    .from("orders")
    .select(SELECT_ORDERS)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (customerId) q = q.eq("customer_id", customerId);
  if (status)     q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const normalized = (data || []).map((o: any) => ({
    ...o,
    order_code:     makeOrderCode(o.id),
    note:           null,
    payment_status: "unpaid",
    payment_method: "cash",
  }));

  return NextResponse.json({ data: normalized, limit, offset });
}

export async function POST(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);
  const svc = createServiceClient();

  // 1) Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  // 2) Org — look up user's active org
  const { data: member, error: memberErr } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (memberErr || !member?.org_id)
    return NextResponse.json({ error: "User không thuộc tổ chức nào" }, { status: 403 });

  // 3) Body
  const body = await request.json();
  const { customer_id, customer_name, items } = body;

  // Resolve customer_id
  let resolvedCustomerId: string | null = customer_id ?? null;
  if (!resolvedCustomerId && customer_name?.trim()) {
    const { data: found } = await supabase
      .from("customers")
      .select("id")
      .eq("org_id", member.org_id)
      .ilike("name", customer_name.trim())
      .limit(1)
      .maybeSingle();
    resolvedCustomerId = found?.id ?? null;
  }
  if (!resolvedCustomerId)
    return NextResponse.json({ error: "Vui lòng chọn khách hàng hợp lệ" }, { status: 400 });

  if (!items?.length)
    return NextResponse.json({ error: "Đơn hàng cần ít nhất 1 sản phẩm" }, { status: 400 });

  const validItems = items.filter((i: any) => i.product_id && Number(i.qty) > 0);
  if (!validItems.length)
    return NextResponse.json({ error: "Cần ít nhất 1 sản phẩm hợp lệ" }, { status: 400 });

  const totalAmount = Math.round(
    validItems.reduce((s: number, i: any) => s + Number(i.qty) * Number(i.unit_price || 0), 0)
  );
  const totalQtyKg = validItems.reduce((s: number, i: any) => s + Number(i.qty), 0);

  // 4) Insert order — only use columns that exist in the DB
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      org_id:         member.org_id,
      customer_id:    resolvedCustomerId,
      status:         "new",
      total_qty_kg:   totalQtyKg,
      total_amount:   totalAmount,
      owner_user_id:  body.owner_user_id || user.id,
      opportunity_id: body.opportunity_id || null,
      created_by:     user.id,
    })
    .select("id, org_id, customer_id, status, total_qty_kg, total_amount, created_at")
    .single();

  if (orderErr)
    return NextResponse.json({ error: orderErr.message }, { status: 400 });

  // 5) Insert order_items via service-role (bypasses RLS)
  const itemRows = validItems.map((i: any) => ({
    order_id:     order.id,
    product_id:   i.product_id,
    product_name: String(i.product_name || ""),
    unit:         String(i.unit || "kg"),
    qty:          Number(i.qty),
    unit_price:   Number(i.unit_price || 0),
  }));

  const { error: itemsErr } = await svc.from("order_items").insert(itemRows);
  if (itemsErr) {
    // Rollback order
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemsErr.message }, { status: 400 });
  }

  // Create confirm_order task for this order
  const taskRole = "warehouse";
  const { error: taskErr } = await svc.from("tasks").insert({
    org_id:     member.org_id,
    type:       "confirm_order",
    status:     "todo",
    ref_id:     order.id,
    ref_type:   "order",
    role:       taskRole,
    order_id:   order.id,
    created_by: user.id,
  });
  if (taskErr) console.error("[orders] confirm_order task insert failed:", taskErr.message);

  await writeAudit({
    orgId: member.org_id,
    actorId: user.id,
    action: "order.create",
    entityType: "order",
    entityId: order.id,
    meta: {
      total_amount: totalAmount,
      total_qty_kg: totalQtyKg,
      customer_id: resolvedCustomerId,
      item_count: validItems.length,
    },
  });

  return NextResponse.json({
    ok: true,
    task_error: taskErr?.message ?? null,
    data: {
      ...order,
      order_code:     makeOrderCode(order.id),
      note:           null,
      payment_status: "unpaid",
      payment_method: "cash",
    },
  });
}

export async function PATCH(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = await request.json();
  const patch: Record<string, any> = {};

  if (body.status !== undefined) {
    if (!ORDER_STATUSES.includes(body.status))
      return NextResponse.json({ error: "Trạng thái đơn không hợp lệ" }, { status: 400 });
    patch.status = body.status;
  }

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Không có field hợp lệ để cập nhật" }, { status: 400 });

  // Snapshot prior state for audit
  const { data: prior } = await supabase
    .from("orders").select("status, org_id").eq("id", id).maybeSingle();

  const { data, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (data && prior?.org_id) {
    const { data: { user: actor } } = await supabase.auth.getUser();
    if (actor) {
      await writeAudit({
        orgId: prior.org_id,
        actorId: actor.id,
        action: "order.update_status",
        entityType: "order",
        entityId: id,
        meta: { from: prior.status, to: patch.status },
      });
    }
  }

  // Auto-create commission when order completed/delivered
  if (patch.status && ["completed", "delivered"].includes(patch.status) && data) {
    const { data: existingComm } = await supabase
      .from("commissions").select("id").eq("order_id", id).limit(1).maybeSingle();

    if (!existingComm) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: member } = await supabase
        .from("org_members").select("org_id").eq("user_id", authUser!.id).eq("is_active", true).limit(1).maybeSingle();

      if (member?.org_id) {
        const commType = "coffee";
        const { data: rule } = await supabase
          .from("commission_rules")
          .select("fixed_amount, collaborator_rate_per_kg")
          .eq("org_id", member.org_id)
          .eq("commission_type", commType)
          .eq("is_active", true)
          .limit(1).maybeSingle();

        const qtyKg = Number(data.total_qty_kg ?? 0);
        const fixedAmt = Number(rule?.fixed_amount ?? 0);
        const rateKg = Number(rule?.collaborator_rate_per_kg ?? 0);
        const commAmt = fixedAmt > 0 ? fixedAmt : rateKg * qtyKg;

        if (commAmt > 0) {
          await supabase.from("commissions").insert({
            org_id: member.org_id,
            order_id: id,
            beneficiary_user_id: data.owner_user_id,
            amount: commAmt,
            qty_kg: qtyKg,
            rate_per_kg: rateKg,
            commission_type: commType,
            status: "pending",
            created_by: authUser!.id,
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true, data });
}

export async function DELETE(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const { data: prior } = await supabase
    .from("orders")
    .select("org_id, total_amount, status, customer_id")
    .eq("id", id).maybeSingle();

  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (prior?.org_id) {
    const { data: { user: actor } } = await supabase.auth.getUser();
    if (actor) {
      await writeAudit({
        orgId: prior.org_id,
        actorId: actor.id,
        action: "order.delete",
        entityType: "order",
        entityId: id,
        meta: {
          total_amount: prior.total_amount,
          status: prior.status,
          customer_id: prior.customer_id,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

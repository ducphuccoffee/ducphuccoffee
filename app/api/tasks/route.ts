import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";
import { createClient } from "@supabase/supabase-js";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

const TASK_DEFAULT_ROLE: Record<string, string> = {
  confirm_order: "warehouse",
  prepare_order: "warehouse",
  deliver_order: "shipper",
  close_order:   "manager",
};

const TASK_ALLOWED_ROLES: Record<string, string[]> = {
  confirm_order: ["admin", "manager", "warehouse"],
  prepare_order: ["admin", "manager", "warehouse"],
  deliver_order: ["admin", "manager", "warehouse", "shipper"],
  close_order:   ["admin", "manager"],
};

const COMPLETE_ORDER_STATUS: Record<string, string> = {
  confirm_order: "accepted",
  prepare_order: "ready_to_ship",
  deliver_order: "delivered",
  close_order:   "completed",
};

const NEXT_TASK_TYPE: Record<string, string | null> = {
  confirm_order: "prepare_order",
  prepare_order: "deliver_order",
  deliver_order: "close_order",
  close_order:   null,
};

export async function GET(request: Request) {
  const res = NextResponse.json({});
  const supabase = createRouteSupabase(request, res);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!member?.org_id)
    return NextResponse.json({ error: "User không thuộc tổ chức nào" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const filterStatus     = searchParams.get("status");
  const filterType       = searchParams.get("type");
  const filterAssignedTo = searchParams.get("assigned_to");

  let q = svc()
    .from("tasks")
    .select(`
      id, org_id, type, status, role, ref_id, ref_type, order_id, assigned_to, created_by, created_at
    `)
    .eq("org_id", member.org_id)
    .in("status", ["todo", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(200);

  if (filterStatus)     q = q.eq("status", filterStatus);
  if (filterType)       q = q.eq("type", filterType);
  if (filterAssignedTo) q = q.eq("assigned_to", filterAssignedTo);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const tasksArr = data || [];
  const orderIds = [...new Set(tasksArr
    .filter((t: any) => t.ref_type === "order" && (t.ref_id || t.order_id))
    .map((t: any) => t.order_id || t.ref_id)
  )];

  let ordersMap: Record<string, any> = {};
  if (orderIds.length > 0) {
    const { data: orders } = await svc()
      .from("orders")
      .select("id, status, total_amount, customer_id, customers(id, name)")
      .in("id", orderIds);
    if (orders) {
      for (const o of orders) {
        ordersMap[o.id] = {
          id: o.id,
          order_code: "#" + o.id.slice(0, 8).toUpperCase(),
          status: o.status,
          total_amount: o.total_amount,
          customers: o.customers,
        };
      }
    }
  }

  const enriched = tasksArr.map((t: any) => ({
    ...t,
    orders: (t.ref_type === "order" && (t.order_id || t.ref_id))
      ? (ordersMap[t.order_id || t.ref_id] ?? null)
      : null,
  }));

  return NextResponse.json({ data: enriched });
}

export async function PATCH(request: Request) {
  const res = NextResponse.json({});
  const supabase = createRouteSupabase(request, res);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = await request.json();
  const action: string = body.action;
  if (!["take", "complete", "reject"].includes(action))
    return NextResponse.json({ error: "action không hợp lệ" }, { status: 400 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!member?.org_id)
    return NextResponse.json({ error: "User không thuộc tổ chức nào" }, { status: 403 });

  const { data: task, error: taskErr } = await svc()
    .from("tasks")
    .select("id, org_id, type, status, role, ref_id, ref_type, order_id, assigned_to")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();
  if (taskErr || !task)
    return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });

  const allowedRoles   = TASK_ALLOWED_ROLES[task.type] ?? ["admin", "manager"];
  const isAdminManager = ["admin", "manager"].includes(member.role);

  if (!allowedRoles.includes(member.role))
    return NextResponse.json({ error: "Không có quyền thực hiện task này" }, { status: 403 });

  // ── TAKE ────────────────────────────────────────────────────────────────────
  if (action === "take") {
    if (task.status !== "todo")
      return NextResponse.json({ error: "Task không ở trạng thái todo" }, { status: 400 });

    if (task.assigned_to && task.assigned_to !== user.id)
      return NextResponse.json({ error: "Task đã được nhận bởi người khác" }, { status: 403 });

    const { data: updated, error: upErr } = await svc()
      .from("tasks")
      .update({ assigned_to: user.id, status: "in_progress" })
      .eq("id", id)
      .select()
      .single();
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
    return NextResponse.json({ ok: true, data: updated });
  }

  // ── COMPLETE ─────────────────────────────────────────────────────────────────
  if (action === "complete") {
    if (task.status !== "in_progress")
      return NextResponse.json({ error: "Task chưa được nhận" }, { status: 400 });

    if (task.assigned_to) {
      if (task.assigned_to !== user.id && !isAdminManager)
        return NextResponse.json({ error: "Không có quyền hoàn thành task này" }, { status: 403 });
    } else {
      if (!allowedRoles.includes(member.role))
        return NextResponse.json({ error: "Không có quyền hoàn thành task này" }, { status: 403 });
    }

    await svc().from("tasks").update({ status: "done" }).eq("id", id);

    const newOrderStatus = COMPLETE_ORDER_STATUS[task.type];
    if (newOrderStatus && task.ref_id && task.ref_type === "order")
      await svc().from("orders").update({ status: newOrderStatus }).eq("id", task.ref_id);

    // Stock deduction when order confirmed (confirm_order → accepted)
    if (task.type === "confirm_order" && task.ref_id) {
      const { error: deductErr } = await svc().rpc("apply_stock_deduction", { p_order_id: task.ref_id });
      if (deductErr) {
        console.error("[tasks] stock deduction failed:", deductErr.message);
        // Rollback: revert task and order status
        await svc().from("tasks").update({ status: "in_progress" }).eq("id", id);
        await svc().from("orders").update({ status: "new" }).eq("id", task.ref_id);
        return NextResponse.json({
          error: `Không đủ tồn kho rang nền: ${deductErr.message}`,
        }, { status: 400 });
      }
    }

    const nextType = NEXT_TASK_TYPE[task.type];
    if (nextType && task.ref_id) {
      const { error: nextErr } = await svc().from("tasks").insert({
        org_id:     member.org_id,
        type:       nextType,
        status:     "todo",
        role:       TASK_DEFAULT_ROLE[nextType] ?? "warehouse",
        ref_id:     task.ref_id,
        ref_type:   "order",
        order_id:   task.ref_id,
        created_by: user.id,
      });
      if (nextErr) console.error("[tasks] next task insert failed:", nextErr.message);
    }

    return NextResponse.json({ ok: true, next_task: nextType ?? null });
  }

  // ── REJECT ───────────────────────────────────────────────────────────────────
  if (action === "reject") {
    await svc().from("tasks").update({ status: "cancelled" }).eq("id", id);

    if (task.ref_id && task.ref_type === "order")
      await svc().from("orders").update({ status: "failed" }).eq("id", task.ref_id);

    return NextResponse.json({ ok: true });
  }
}

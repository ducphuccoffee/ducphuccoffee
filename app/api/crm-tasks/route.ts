import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

/**
 * CRM tasks endpoint.
 *
 * IMPORTANT: public.tasks has a CHECK constraint that only allows
 * order-workflow types (confirm_order / prepare_order / deliver_order).
 * CRM/SFA work is NOT stored here:
 *   - planned visits        → sfa_visits (result IS NULL, checkout_at IS NULL)
 *   - completed visits      → sfa_visits (result IS NOT NULL)
 *   - visit follow-ups      → sfa_visits.result = 'followup_needed'
 *   - lead / opportunity    → derived in /api/sales-today from leads/opportunities
 *     reminders               directly (no persisted reminder rows)
 *   - activity log          → crm_activities
 *
 * POST on this route is therefore disabled. GET is kept (returns empty) so
 * callers that still query it don't 500. PATCH is kept so legacy CRM tasks
 * that may already exist from before the constraint audit can still be
 * closed out.
 */

const CRM_TYPES = ["crm_followup", "visit", "quotation_followup", "debt_followup"];

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const owner = searchParams.get("owner_user_id");
  const leadId = searchParams.get("lead_id");
  const customerId = searchParams.get("customer_id");
  const oppId = searchParams.get("opportunity_id");

  let q = supabase
    .from("tasks")
    .select("id, org_id, type, status, role, ref_type, ref_id, lead_id, customer_id, opportunity_id, owner_user_id, description, due_at, created_by, created_at")
    .eq("org_id", member.org_id)
    .in("type", CRM_TYPES)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) q = q.eq("status", status);
  else q = q.in("status", ["todo", "in_progress"]);
  if (owner) q = q.eq("owner_user_id", owner);
  if (leadId) q = q.eq("lead_id", leadId);
  if (customerId) q = q.eq("customer_id", customerId);
  if (oppId) q = q.eq("opportunity_id", oppId);

  const { data, error } = await q;
  // In practice this always returns [] because tasks_type_check rejects
  // CRM types. We still run the query so RLS errors surface correctly.
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "CRM tasks are no longer stored in the tasks table. Use /api/sfa-visits (mode=plan) for planned visits. Follow-ups live on sfa_visits.result.",
      code: "crm_tasks_disabled",
    },
    { status: 410 },
  );
}

export async function PATCH(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const ALLOWED = ["status", "description", "due_at", "owner_user_id"];
  const patch: Record<string, any> = {};
  for (const key of ALLOWED) {
    if (key in body) patch[key] = body[key];
  }

  const { data, error } = await supabase
    .from("tasks").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

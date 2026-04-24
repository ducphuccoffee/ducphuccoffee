import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

/**
 * CRM reminders — DEPRECATED as a task-inserter.
 *
 * The public.tasks CHECK constraint only accepts order-workflow types
 * (confirm_order / prepare_order / deliver_order), so inserting
 * 'crm_followup' / 'quotation_followup' here always fails.
 *
 * CRM reminders are now surfaced in real time by /api/sales-today which
 * derives stale leads and stuck opportunities directly from the leads /
 * opportunities / sfa_visits tables — no persisted reminder rows needed.
 *
 * This endpoint is kept so existing cron schedules don't 404, and it
 * returns the same counts it would have created, without writing to tasks.
 */

const LEAD_STALE_DAYS = 3;
const OPP_STALE_DAYS = 5;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createRouteSupabase(request, NextResponse.json({}));

  const now = new Date();
  const staleCutoff = new Date(now.getTime() - LEAD_STALE_DAYS * 86_400_000).toISOString();
  const oppCutoff = new Date(now.getTime() - OPP_STALE_DAYS * 86_400_000).toISOString();

  // Count only — no inserts. Sales reps see these on the Today page.
  const { data: staleLeads } = await supabase
    .from("leads")
    .select("id", { count: "exact" })
    .in("status", ["new", "contacted"])
    .lt("updated_at", staleCutoff)
    .limit(1000);

  const { data: stuckOpps } = await supabase
    .from("opportunities")
    .select("id", { count: "exact" })
    .eq("stage", "quoted")
    .lt("updated_at", oppCutoff)
    .limit(1000);

  return NextResponse.json({
    ok: true,
    deprecated: true,
    note: "Reminders are derived on-the-fly by /api/sales-today. This endpoint no longer writes to tasks.",
    stale_leads_count: (staleLeads ?? []).length,
    stuck_opps_count: (stuckOpps ?? []).length,
  });
}

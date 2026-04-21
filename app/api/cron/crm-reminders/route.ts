import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

const LEAD_STALE_DAYS = 3;
const OPP_STALE_DAYS = 5;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = request.url.split("/api/cron/")[0];
  const cookies = request.headers.get("cookie") ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookies) headers["cookie"] = cookies;

  // Use internal APIs to fetch data (respects session)
  // For cron, we need a service approach — call leads/opportunities APIs
  const supabase = createRouteSupabase(request, NextResponse.json({}));

  const log: string[] = [];
  let created = 0;

  const now = new Date();
  const staleCutoff = new Date(now.getTime() - LEAD_STALE_DAYS * 86_400_000).toISOString();
  const oppCutoff = new Date(now.getTime() - OPP_STALE_DAYS * 86_400_000).toISOString();

  // 1) Stale leads: status in (new, contacted) and no activity in 3 days
  const { data: staleLeads } = await supabase
    .from("leads")
    .select("id, org_id, name, owner_user_id, updated_at")
    .in("status", ["new", "contacted"])
    .lt("updated_at", staleCutoff)
    .limit(50);

  for (const lead of staleLeads ?? []) {
    // Check no existing active task
    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("type", "crm_followup")
      .in("status", ["todo", "in_progress"])
      .limit(1)
      .maybeSingle();

    if (existing) {
      log.push(`SKIP lead ${lead.name} — task exists`);
      continue;
    }

    const { error } = await supabase.from("tasks").insert({
      org_id:        lead.org_id,
      type:          "crm_followup",
      status:        "todo",
      role:          "sales",
      ref_type:      "lead",
      ref_id:        lead.id,
      lead_id:       lead.id,
      owner_user_id: lead.owner_user_id,
      description:   `Lead "${lead.name}" không có hoạt động ${LEAD_STALE_DAYS} ngày`,
      created_by:    lead.owner_user_id,
    });

    if (error) {
      log.push(`ERROR lead ${lead.name}: ${error.message}`);
    } else {
      created++;
      log.push(`CREATED followup for stale lead: ${lead.name}`);
    }
  }

  // 2) Stuck opportunities: stage = quoted, no update in 5 days
  const { data: stuckOpps } = await supabase
    .from("opportunities")
    .select("id, org_id, title, owner_user_id, customer_id, lead_id, updated_at")
    .eq("stage", "quoted")
    .lt("updated_at", oppCutoff)
    .limit(50);

  for (const opp of stuckOpps ?? []) {
    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("opportunity_id", opp.id)
      .eq("type", "quotation_followup")
      .in("status", ["todo", "in_progress"])
      .limit(1)
      .maybeSingle();

    if (existing) {
      log.push(`SKIP opp "${opp.title}" — task exists`);
      continue;
    }

    const { error } = await supabase.from("tasks").insert({
      org_id:         opp.org_id,
      type:           "quotation_followup",
      status:         "todo",
      role:           "sales",
      ref_type:       "opportunity",
      ref_id:         opp.id,
      opportunity_id: opp.id,
      customer_id:    opp.customer_id || null,
      lead_id:        opp.lead_id || null,
      owner_user_id:  opp.owner_user_id,
      description:    `Cơ hội "${opp.title}" chưa cập nhật ${OPP_STALE_DAYS} ngày`,
      created_by:     opp.owner_user_id,
    });

    if (error) {
      log.push(`ERROR opp "${opp.title}": ${error.message}`);
    } else {
      created++;
      log.push(`CREATED followup for stuck opp: ${opp.title}`);
    }
  }

  return NextResponse.json({
    ok: true,
    stale_leads_checked: (staleLeads ?? []).length,
    stuck_opps_checked: (stuckOpps ?? []).length,
    tasks_created: created,
    log,
  });
}

import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const orgId = member.org_id;

  // 1) All active leads
  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, phone, status, temperature, owner_user_id, created_at, updated_at")
    .eq("org_id", orgId)
    .not("status", "in", "(converted,lost)")
    .order("created_at", { ascending: false });

  if (!leads || leads.length === 0)
    return NextResponse.json({ ok: true, data: [] });

  const leadIds = leads.map(l => l.id);

  // 2) Activity counts per lead
  const { data: activities } = await supabase
    .from("crm_activities")
    .select("lead_id, created_at")
    .in("lead_id", leadIds);

  const activityMap: Record<string, { count: number; last: string | null }> = {};
  for (const a of activities ?? []) {
    if (!a.lead_id) continue;
    if (!activityMap[a.lead_id]) activityMap[a.lead_id] = { count: 0, last: null };
    activityMap[a.lead_id].count++;
    if (!activityMap[a.lead_id].last || a.created_at > activityMap[a.lead_id].last!)
      activityMap[a.lead_id].last = a.created_at;
  }

  // 3) Opportunities per lead
  const { data: opps } = await supabase
    .from("opportunities")
    .select("lead_id, stage, expected_value")
    .in("lead_id", leadIds);

  const oppMap: Record<string, { count: number; hasActive: boolean; value: number }> = {};
  for (const o of opps ?? []) {
    if (!o.lead_id) continue;
    if (!oppMap[o.lead_id]) oppMap[o.lead_id] = { count: 0, hasActive: false, value: 0 };
    oppMap[o.lead_id].count++;
    if (!["won", "lost"].includes(o.stage)) oppMap[o.lead_id].hasActive = true;
    oppMap[o.lead_id].value += Number(o.expected_value ?? 0);
  }

  // 4) Visits per lead
  const { data: visits } = await supabase
    .from("sfa_visits")
    .select("lead_id")
    .in("lead_id", leadIds);

  const visitSet = new Set((visits ?? []).map(v => v.lead_id).filter(Boolean));

  // 5) Score + suggest
  const now = Date.now();
  const DAY = 86_400_000;

  const scored = leads.map(lead => {
    const act = activityMap[lead.id] ?? { count: 0, last: null };
    const opp = oppMap[lead.id] ?? { count: 0, hasActive: false, value: 0 };
    const hasVisit = visitSet.has(lead.id);

    let score = 0;

    // Activity recency (0-30)
    if (act.last) {
      const daysSince = (now - new Date(act.last).getTime()) / DAY;
      if (daysSince < 1) score += 30;
      else if (daysSince < 3) score += 20;
      else if (daysSince < 7) score += 10;
      else if (daysSince < 14) score += 5;
    }

    // Activity volume (0-15)
    score += Math.min(act.count * 3, 15);

    // Has opportunity (0-20)
    if (opp.hasActive) score += 20;
    else if (opp.count > 0) score += 10;

    // Opportunity value (0-10)
    if (opp.value >= 10_000_000) score += 10;
    else if (opp.value >= 5_000_000) score += 7;
    else if (opp.value > 0) score += 3;

    // Has visit (0-10)
    if (hasVisit) score += 10;

    // Lead status progression (0-10)
    const statusScore: Record<string, number> = { new: 0, contacted: 3, meeting_scheduled: 6, quoted: 10 };
    score += statusScore[lead.status] ?? 0;

    // Temperature boost (0-5)
    if (lead.temperature === "hot") score += 5;
    else if (lead.temperature === "warm") score += 2;

    score = Math.min(score, 100);

    const level = score >= 60 ? "hot" : score >= 30 ? "warm" : "cold";

    // Suggest next action
    let next_action: string;
    let priority: "high" | "medium" | "low";

    if (lead.status === "new" && act.count === 0) {
      next_action = "Gọi điện liên hệ lần đầu";
      priority = level === "hot" ? "high" : "medium";
    } else if (lead.status === "contacted" && !hasVisit) {
      next_action = "Đặt lịch ghé thăm";
      priority = level === "hot" ? "high" : "medium";
    } else if (lead.status === "meeting_scheduled") {
      next_action = "Chuẩn bị báo giá";
      priority = "high";
    } else if (lead.status === "quoted" && !opp.hasActive) {
      next_action = "Tạo cơ hội bán hàng";
      priority = "high";
    } else if (opp.hasActive) {
      next_action = "Follow-up cơ hội đang mở";
      priority = level === "hot" ? "high" : "medium";
    } else if (act.last) {
      const daysSince = (now - new Date(act.last).getTime()) / DAY;
      if (daysSince > 7) {
        next_action = "Liên hệ lại — đã lâu không tương tác";
        priority = level === "hot" ? "high" : "low";
      } else {
        next_action = "Theo dõi tiến trình";
        priority = "low";
      }
    } else {
      next_action = "Gọi điện tìm hiểu nhu cầu";
      priority = "medium";
    }

    return {
      lead_id: lead.id,
      name: lead.name,
      phone: lead.phone,
      status: lead.status,
      temperature: lead.temperature,
      owner_user_id: lead.owner_user_id,
      score,
      level,
      activity_count: act.count,
      last_contact: act.last,
      has_opportunity: opp.hasActive,
      opportunity_value: opp.value,
      has_visit: hasVisit,
      next_action,
      priority,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return NextResponse.json({ ok: true, data: scored });
}

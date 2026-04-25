import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS = {
  crm: { stale_lead_days: 7, stuck_opp_days: 5, dormant_customer_days: 60 },
  kpi: { monthly_revenue_target: 0 },
  stock: { default_min_stock_kg: 5 },
};

async function resolveOrg(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 }) } as const;

  const { data: member } = await supabase
    .from("org_members").select("org_id, role")
    .eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return { error: NextResponse.json({ error: "Không có tổ chức" }, { status: 403 }) } as const;

  return { supabase, user, orgId: member.org_id as string, role: member.role as string } as const;
}

export async function GET(request: Request) {
  const auth = await resolveOrg(request);
  if ("error" in auth) return auth.error;
  const { supabase, orgId } = auth;

  const { data, error } = await supabase
    .from("orgs")
    .select("id, name, address, tax_code, phone, email, logo_url, settings")
    .eq("id", orgId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const settings = { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) };
  settings.crm = { ...DEFAULT_SETTINGS.crm, ...(settings.crm ?? {}) };
  settings.kpi = { ...DEFAULT_SETTINGS.kpi, ...(settings.kpi ?? {}) };
  settings.stock = { ...DEFAULT_SETTINGS.stock, ...(settings.stock ?? {}) };

  return NextResponse.json({ ok: true, data: { ...data, settings } });
}

export async function PATCH(request: Request) {
  const auth = await resolveOrg(request);
  if ("error" in auth) return auth.error;
  const { supabase, orgId, role } = auth;

  if (!["admin", "manager"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({} as any));
  const patch: Record<string, any> = {};

  const FIELDS = ["name", "address", "tax_code", "phone", "email", "logo_url"];
  for (const key of FIELDS) {
    if (key in body) patch[key] = typeof body[key] === "string" ? (body[key].trim() || null) : body[key];
  }

  // Merge settings: shallow-merge crm and kpi sub-objects from body.settings.
  if (body.settings && typeof body.settings === "object") {
    const { data: cur } = await supabase.from("orgs").select("settings").eq("id", orgId).maybeSingle();
    const existing = (cur?.settings ?? {}) as any;
    const incoming = body.settings as any;
    const merged: any = { ...existing };

    if (incoming.crm && typeof incoming.crm === "object") {
      const crm = { ...(existing.crm ?? {}) };
      const n = incoming.crm;
      if (n.stale_lead_days !== undefined)       crm.stale_lead_days       = Math.max(1, Math.min(365, Number(n.stale_lead_days) || 7));
      if (n.stuck_opp_days !== undefined)        crm.stuck_opp_days        = Math.max(1, Math.min(365, Number(n.stuck_opp_days) || 5));
      if (n.dormant_customer_days !== undefined) crm.dormant_customer_days = Math.max(1, Math.min(365, Number(n.dormant_customer_days) || 60));
      merged.crm = crm;
    }
    if (incoming.kpi && typeof incoming.kpi === "object") {
      const kpi = { ...(existing.kpi ?? {}) };
      const n = incoming.kpi;
      if (n.monthly_revenue_target !== undefined)
        kpi.monthly_revenue_target = Math.max(0, Number(n.monthly_revenue_target) || 0);
      merged.kpi = kpi;
    }
    if (incoming.stock && typeof incoming.stock === "object") {
      const stock = { ...(existing.stock ?? {}) };
      const n = incoming.stock;
      if (n.default_min_stock_kg !== undefined)
        stock.default_min_stock_kg = Math.max(0, Number(n.default_min_stock_kg) || 0);
      merged.stock = stock;
    }
    patch.settings = merged;
  }

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Không có gì để cập nhật" }, { status: 400 });

  const { error } = await supabase.from("orgs").update(patch).eq("id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

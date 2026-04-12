import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";
import { getCrmDashboardData } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const res = NextResponse.json({});
  const supabase = createRouteSupabase(request, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get role from org_members
  const { data: member } = await supabase
    .from("org_members").select("role")
    .eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();

  const crmUser = { id: user.id, role: member?.role ?? "sales" };
  const data = await getCrmDashboardData(crmUser);
  return NextResponse.json({ data });
}

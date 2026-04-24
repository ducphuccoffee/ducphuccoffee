import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";

// PATCH own profile (full_name only). Role/can_view_profit are managed via /api/admin/users.
export async function PATCH(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await request.json().catch(() => ({} as any));
  const patch: Record<string, any> = {};
  if (typeof body.full_name === "string") patch.full_name = body.full_name.trim() || null;
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Không có trường nào để cập nhật" }, { status: 400 });

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

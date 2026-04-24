import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await request.json().catch(() => ({} as any));
  const newPassword: string = body.new_password ?? "";
  if (typeof newPassword !== "string" || newPassword.length < 8)
    return NextResponse.json({ error: "Mật khẩu phải ít nhất 8 ký tự" }, { status: 400 });

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

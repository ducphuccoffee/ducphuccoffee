import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export async function POST(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);

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

  const body = await request.json().catch(() => ({}));
  const green_type_id = body?.green_type_id;
  if (!green_type_id)
    return NextResponse.json({ error: "Thiếu green_type_id" }, { status: 400 });

  // Check duplicate: same type + ref_type + ref_id + still active
  const { data: existing } = await supabase
    .from("tasks")
    .select("id, status, created_at")
    .eq("org_id", member.org_id)
    .eq("type", "production")
    .eq("ref_type", "green_type")
    .eq("ref_id", green_type_id)
    .in("status", ["todo", "in_progress"])
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: false,
      duplicate: true,
      existing_task_id: existing.id,
      existing_status: existing.status,
      message: "Đã có lệnh rang chưa hoàn thành cho loại nhân này",
    }, { status: 409 });
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      org_id:     member.org_id,
      type:       "production",
      status:     "todo",
      role:       "warehouse",
      ref_type:   "green_type",
      ref_id:     green_type_id,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, data: task });
}

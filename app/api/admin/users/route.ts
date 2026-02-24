import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ORG_ID = "00000000-0000-0000-0000-000000000001" as const;

type CreateUserBody = {
  email: string;
  role: "admin" | "manager" | "warehouse" | "sales" | "collaborator";
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<CreateUserBody>;
    const email = (body.email ?? "").trim().toLowerCase();
    const role = body.role;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
    }
    if (!role || !["admin", "manager", "warehouse", "sales", "collaborator"].includes(role)) {
      return NextResponse.json({ error: "Role không hợp lệ" }, { status: 400 });
    }

    // 1) Check người gọi (session) + quyền admin/manager
    const supabase = createServerSupabaseClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();

    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: member, error: memErr } = await supabase
      .from("org_members")
      .select("role, is_active")
      .eq("org_id", ORG_ID)
      .eq("user_id", userRes.user.id)
      .single();

    if (memErr || !member?.is_active) {
      return NextResponse.json({ error: "Bạn chưa được cấp quyền vào công ty" }, { status: 403 });
    }
    if (!["admin", "manager"].includes(member.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2) Admin client (service role) để tạo user
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !url) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      );
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Invite user (gửi email)
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email);
    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 400 });
    }

    const newUserId = invited.user?.id;
    if (!newUserId) {
      return NextResponse.json({ error: "Invite failed" }, { status: 400 });
    }

    // 3) Gán role vào org_members
    const { error: upsertErr } = await admin.from("org_members").upsert(
      {
        org_id: ORG_ID,
        user_id: newUserId,
        role,
        is_active: true,
      },
      { onConflict: "org_id,user_id" }
    );

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, user_id: newUserId, email, role });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
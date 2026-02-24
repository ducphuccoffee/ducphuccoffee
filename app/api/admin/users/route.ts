import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Role = "admin" | "manager" | "warehouse" | "sales" | "collaborator";

type CreateUserBody = {
  email?: string;
  role?: Role;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonError(status: number, payload: Record<string, any>) {
  return NextResponse.json(payload, { status });
}

export async function POST(req: Request) {
  try {
    // 0) Parse body
    const body = (await req.json()) as CreateUserBody;
    const safeEmail = (body.email ?? "").trim().toLowerCase();
    const role = body.role;

    if (!safeEmail || !isValidEmail(safeEmail)) {
      return jsonError(400, { error: "Email không hợp lệ" });
    }
    if (!role || !["admin", "manager", "warehouse", "sales", "collaborator"].includes(role)) {
      return jsonError(400, { error: "Role không hợp lệ" });
    }

    // 1) Check session người gọi (phải login)
    const supabase = createServerSupabaseClient();
    const { data: meRes, error: meErr } = await supabase.auth.getUser();

    if (meErr || !meRes?.user) {
      return jsonError(401, { error: "Unauthorized" });
    }
    const actorId = meRes.user.id;

    // 2) Lấy org_id + role của actor từ org_members (vì bạn 1 công ty)
    //    Nếu bạn đã seed admin đúng, query này sẽ ra 1 dòng.
    const { data: actorMember, error: actorMemberErr } = await supabase
      .from("org_members")
      .select("org_id, role, is_active")
      .eq("user_id", actorId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (actorMemberErr || !actorMember) {
      return jsonError(403, { error: "Bạn chưa được cấp quyền vào công ty" });
    }

    if (!["admin", "manager"].includes(actorMember.role)) {
      return jsonError(403, { error: "Forbidden" });
    }

    const orgId = actorMember.org_id as string;

    // 3) Service role admin client (server-only) để invite user
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return jsonError(500, {
        error: "Missing env",
        missing: {
          NEXT_PUBLIC_SUPABASE_URL: !url,
          SUPABASE_SERVICE_ROLE_KEY: !serviceKey,
        },
      });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 4) Invite user (Supabase sẽ gửi email invite)
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(safeEmail);

    if (inviteErr) {
      return jsonError(400, {
        error: inviteErr.message,
        code: (inviteErr as any).code,
        status: (inviteErr as any).status,
      });
    }

    const newUserId = invited.user?.id;
    if (!newUserId) {
      return jsonError(400, { error: "Invite failed (no user id returned)" });
    }

    // 5) Upsert org_members (gán role)
    //    Điều kiện: DB phải có UNIQUE/PK cho (org_id, user_id) để onConflict hoạt động.
    const { data: upserted, error: upsertErr } = await admin
      .from("org_members")
      .upsert(
        { org_id: orgId, user_id: newUserId, role, is_active: true },
        { onConflict: "org_id,user_id" }
      )
      .select("org_id,user_id,role,is_active")
      .single();

    if (upsertErr) {
      return jsonError(400, {
        error: upsertErr.message,
        code: (upsertErr as any).code,
        details: (upsertErr as any).details,
        hint: (upsertErr as any).hint,
      });
    }

    return NextResponse.json({
      ok: true,
      invited: { user_id: newUserId, email: safeEmail },
      member: upserted,
    });
  } catch (e: any) {
    return jsonError(500, { error: e?.message ?? "Unknown error" });
  }
}
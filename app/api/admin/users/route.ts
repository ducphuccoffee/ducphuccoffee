import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Role = "admin" | "manager" | "roastery_manager" | "warehouse" | "sales" | "collaborator";

const VALID_ROLES: Role[] = ["admin", "manager", "roastery_manager", "warehouse", "sales", "collaborator"];

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

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: meRes, error: meErr } = await supabase.auth.getUser();
  if (meErr || !meRes?.user) return { error: jsonError(401, { error: "Unauthorized" }) } as const;

  const actorId = meRes.user.id;
  const { data: actorMember } = await supabase
    .from("org_members")
    .select("org_id, role, is_active")
    .eq("user_id", actorId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!actorMember) return { error: jsonError(403, { error: "Bạn chưa được cấp quyền vào công ty" }) } as const;
  if (!["admin", "manager"].includes(actorMember.role)) return { error: jsonError(403, { error: "Forbidden" }) } as const;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { error: jsonError(500, { error: "Missing env" }) } as const;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  return { actorId, orgId: actorMember.org_id as string, admin } as const;
}

// GET: list members of caller's org with role, is_active, can_view_profit, full_name, email.
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { orgId, admin } = auth;

  const { data: members, error: mErr } = await admin
    .from("org_members")
    .select("user_id, role, is_active, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (mErr) return jsonError(400, { error: mErr.message });

  const userIds = (members ?? []).map((m: any) => m.user_id);
  if (userIds.length === 0) return NextResponse.json({ ok: true, data: [] });

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role, can_view_profit")
    .in("id", userIds);
  const profMap: Record<string, any> = {};
  for (const p of profiles ?? []) profMap[p.id] = p;

  // Fetch emails via admin API (one call per page; we paginate up to 1000).
  const emailMap: Record<string, string> = {};
  try {
    const { data: usersRes } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of usersRes?.users ?? []) if (u.id) emailMap[u.id] = u.email ?? "";
  } catch { /* ignore — emails optional */ }

  const rows = (members ?? []).map((m: any) => ({
    user_id: m.user_id,
    email: emailMap[m.user_id] ?? null,
    full_name: profMap[m.user_id]?.full_name ?? null,
    // org_members.role is authoritative for org-scoped role; profiles.role is mirror.
    role: m.role,
    profile_role: profMap[m.user_id]?.role ?? null,
    can_view_profit: !!profMap[m.user_id]?.can_view_profit,
    is_active: !!m.is_active,
    created_at: m.created_at,
  }));

  return NextResponse.json({ ok: true, data: rows });
}

// PATCH: update role / can_view_profit / is_active for one user in caller's org.
// Body: { user_id, role?, can_view_profit?, is_active? }
export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { actorId, orgId, admin } = auth;

  const body = await req.json().catch(() => ({} as any));
  const targetId = body.user_id as string | undefined;
  if (!targetId) return jsonError(400, { error: "Thiếu user_id" });

  // Verify target belongs to same org
  const { data: target } = await admin
    .from("org_members")
    .select("user_id, org_id, role, is_active")
    .eq("user_id", targetId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!target) return jsonError(404, { error: "Không tìm thấy thành viên trong công ty" });

  // Prevent self-demotion / self-deactivation lockout.
  if (targetId === actorId) {
    if (body.role && body.role !== target.role)
      return jsonError(400, { error: "Không thể tự đổi role của chính bạn" });
    if (body.is_active === false)
      return jsonError(400, { error: "Không thể tự vô hiệu hoá tài khoản của bạn" });
  }

  if (body.role !== undefined && !VALID_ROLES.includes(body.role))
    return jsonError(400, { error: `Role phải là: ${VALID_ROLES.join(", ")}` });

  const memberPatch: Record<string, any> = {};
  if (body.role !== undefined) memberPatch.role = body.role;
  if (body.is_active !== undefined) memberPatch.is_active = !!body.is_active;

  if (Object.keys(memberPatch).length > 0) {
    const { error: uErr } = await admin
      .from("org_members")
      .update(memberPatch)
      .eq("user_id", targetId)
      .eq("org_id", orgId);
    if (uErr) return jsonError(400, { error: uErr.message });
  }

  const profilePatch: Record<string, any> = {};
  if (body.role !== undefined) profilePatch.role = body.role;
  if (body.can_view_profit !== undefined) profilePatch.can_view_profit = !!body.can_view_profit;

  if (Object.keys(profilePatch).length > 0) {
    const { error: pErr } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("id", targetId);
    if (pErr) return jsonError(400, { error: pErr.message });
  }

  return NextResponse.json({ ok: true });
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
    if (!role || !VALID_ROLES.includes(role)) {
      return jsonError(400, { error: "Role không hợp lệ" });
    }

    // 1) Check session người gọi (phải login)
    const supabase = await createServerSupabaseClient();
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
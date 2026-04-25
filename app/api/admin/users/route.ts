import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Role =
  | "admin"
  | "manager"
  | "roastery_manager"
  | "warehouse"
  | "sales"
  | "collaborator"
  | "delivery";

const VALID_ROLES: Role[] = [
  "admin", "manager", "roastery_manager",
  "warehouse", "sales", "collaborator", "delivery",
];

// Internal domain used for username-based logins. Never sends real email.
const INTERNAL_DOMAIN = "ducphuccoffee.local";

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${INTERNAL_DOMAIN}`;
}

function isValidUsername(u: string) {
  // Allow phone-like digits, dots, underscores, hyphens, letters (3–32 chars).
  return /^[a-z0-9._-]{3,32}$/i.test(u);
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

// GET: list members of caller's org with role, is_active, can_view_profit, full_name, username.
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
    .select("id, full_name, role, can_view_profit, username")
    .in("id", userIds);
  const profMap: Record<string, any> = {};
  for (const p of profiles ?? []) profMap[p.id] = p;

  // Fetch emails via admin API (up to 1000 — enough for our size).
  const emailMap: Record<string, string> = {};
  try {
    const { data: usersRes } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of usersRes?.users ?? []) if (u.id) emailMap[u.id] = u.email ?? "";
  } catch { /* ignore */ }

  const rows = (members ?? []).map((m: any) => {
    const email = emailMap[m.user_id] ?? null;
    const usernameFromEmail = email && email.endsWith("@" + INTERNAL_DOMAIN)
      ? email.slice(0, -("@" + INTERNAL_DOMAIN).length)
      : null;
    return {
      user_id: m.user_id,
      email,
      username: profMap[m.user_id]?.username ?? usernameFromEmail,
      is_internal: email ? email.endsWith("@" + INTERNAL_DOMAIN) : false,
      full_name: profMap[m.user_id]?.full_name ?? null,
      role: m.role,
      profile_role: profMap[m.user_id]?.role ?? null,
      can_view_profit: !!profMap[m.user_id]?.can_view_profit,
      is_active: !!m.is_active,
      created_at: m.created_at,
    };
  });

  return NextResponse.json({ ok: true, data: rows });
}

// PATCH: update role / can_view_profit / is_active / password for one user.
// Body: { user_id, role?, can_view_profit?, is_active?, password? (min 6) }
export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { actorId, orgId, admin } = auth;

  const body = await req.json().catch(() => ({} as any));
  const targetId = body.user_id as string | undefined;
  if (!targetId) return jsonError(400, { error: "Thiếu user_id" });

  const { data: target } = await admin
    .from("org_members")
    .select("user_id, org_id, role, is_active")
    .eq("user_id", targetId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!target) return jsonError(404, { error: "Không tìm thấy thành viên trong công ty" });

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
  if (typeof body.full_name === "string") profilePatch.full_name = body.full_name.trim() || null;

  if (Object.keys(profilePatch).length > 0) {
    const { error: pErr } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("id", targetId);
    if (pErr) return jsonError(400, { error: pErr.message });
  }

  // Reset password (admin → new password)
  if (typeof body.password === "string") {
    if (body.password.length < 6)
      return jsonError(400, { error: "Mật khẩu phải ít nhất 6 ký tự" });
    const { error: pwErr } = await admin.auth.admin.updateUserById(targetId, { password: body.password });
    if (pwErr) return jsonError(400, { error: pwErr.message });
  }

  // Audit any of: role change, activate/deactivate, password reset, profit toggle
  const auditMeta: Record<string, any> = {};
  if (body.role !== undefined && body.role !== target.role)
    auditMeta.role = { from: target.role, to: body.role };
  if (body.is_active !== undefined && !!body.is_active !== !!target.is_active)
    auditMeta.is_active = { from: !!target.is_active, to: !!body.is_active };
  if (body.can_view_profit !== undefined) auditMeta.can_view_profit = !!body.can_view_profit;
  if (typeof body.password === "string") auditMeta.password_reset = true;
  if (Object.keys(auditMeta).length > 0) {
    await writeAudit({
      orgId, actorId,
      action: "user.update",
      entityType: "user",
      entityId: targetId,
      meta: auditMeta,
    });
  }

  return NextResponse.json({ ok: true });
}

// POST: create user.
// Two modes:
//   A) Username + password (no email). Body: { username, password, role, full_name? }
//      → creates auth user with synthetic email `{username}@ducphuccoffee.local`, email_confirm=true.
//   B) Email invite. Body: { email, role }
//      → sends Supabase invite email (legacy flow, still supported).
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { orgId, admin } = auth;

  const body = await req.json().catch(() => ({} as any));
  const role = body.role as Role | undefined;
  if (!role || !VALID_ROLES.includes(role))
    return jsonError(400, { error: "Role không hợp lệ" });

  // Mode A — direct create with username + password.
  if (typeof body.username === "string" && body.username.trim() !== "") {
    const username = body.username.trim().toLowerCase();
    if (!isValidUsername(username))
      return jsonError(400, { error: "Tên đăng nhập chỉ gồm chữ/số/._- (3–32 ký tự)" });
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 6)
      return jsonError(400, { error: "Mật khẩu phải ít nhất 6 ký tự" });

    // Pre-check duplicate username in profiles.
    const { data: dup } = await admin
      .from("profiles").select("id").eq("username", username).maybeSingle();
    if (dup) return jsonError(400, { error: "Tên đăng nhập đã tồn tại" });

    const email = usernameToEmail(username);
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, full_name: body.full_name ?? null },
    });
    if (createErr) return jsonError(400, { error: createErr.message });
    const newUserId = created.user?.id;
    if (!newUserId) return jsonError(400, { error: "Tạo user thất bại" });

    // Profile row is auto-created by handle_new_user trigger; update it with username.
    await admin.from("profiles").update({
      username,
      full_name: body.full_name ?? null,
      role,
    }).eq("id", newUserId);

    const { error: memberErr } = await admin
      .from("org_members")
      .upsert(
        { org_id: orgId, user_id: newUserId, role, is_active: true },
        { onConflict: "org_id,user_id" },
      );
    if (memberErr) return jsonError(400, { error: memberErr.message });

    await writeAudit({
      orgId, actorId: auth.actorId,
      action: "user.create",
      entityType: "user",
      entityId: newUserId,
      meta: { mode: "username", username, role },
    });

    return NextResponse.json({ ok: true, mode: "create", user_id: newUserId, username });
  }

  // Mode B — legacy email invite.
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return jsonError(400, { error: "Cần username hoặc email hợp lệ" });

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteErr) return jsonError(400, { error: inviteErr.message });
  const newUserId = invited.user?.id;
  if (!newUserId) return jsonError(400, { error: "Invite failed" });

  const { error: memberErr } = await admin
    .from("org_members")
    .upsert(
      { org_id: orgId, user_id: newUserId, role, is_active: true },
      { onConflict: "org_id,user_id" },
    );
  if (memberErr) return jsonError(400, { error: memberErr.message });

  await admin.from("profiles").update({ role }).eq("id", newUserId);

  await writeAudit({
    orgId, actorId: auth.actorId,
    action: "user.create",
    entityType: "user",
    entityId: newUserId,
    meta: { mode: "invite", email, role },
  });

  return NextResponse.json({ ok: true, mode: "invite", user_id: newUserId, email });
}

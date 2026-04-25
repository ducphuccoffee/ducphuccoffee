import { createClient } from "@supabase/supabase-js";

// Server-side audit log writer. Uses service-role to bypass RLS so any
// API route can record an event regardless of who the caller is.
//
// Usage from a Route Handler:
//   await writeAudit({
//     orgId, actorId,
//     action: "order.update_status",
//     entityType: "order",
//     entityId: orderId,
//     meta: { from: "new", to: "delivered" },
//   });

type AuditInput = {
  orgId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, any>;
};

let _admin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  const a = admin();
  if (!a) return;
  try {
    await (a.from("audit_log") as any).insert({
      org_id: input.orgId,
      actor_user_id: input.actorId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      meta: input.meta ?? {},
    });
  } catch {
    // Never let audit failures break the main request.
  }
}

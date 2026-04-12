import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MIGRATION_SQL = `
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS note            text,
  ADD COLUMN IF NOT EXISTS order_code      text,
  ADD COLUMN IF NOT EXISTS customer_name   text,
  ADD COLUMN IF NOT EXISTS customer_phone  text,
  ADD COLUMN IF NOT EXISTS ordered_at      timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS payment_status  text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_method  text NOT NULL DEFAULT 'cash';
`;

const BACKFILL_SQL = `
UPDATE orders
SET order_code = '#' || UPPER(SUBSTRING(id::text, 1, 8))
WHERE order_code IS NULL OR order_code = '';
`;

const MIGRATE_STATUS_SQL = `
UPDATE orders SET status = 'new'       WHERE status = 'draft';
UPDATE orders SET status = 'accepted'  WHERE status = 'confirmed';
UPDATE orders SET status = 'completed' WHERE status = 'closed';
`;

const DROP_CONSTRAINT_SQL = `
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
`;

const ADD_CONSTRAINT_SQL = `
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (
  status IN ('new','accepted','preparing','ready_to_ship','shipping','delivered','completed','cancelled','failed')
);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK (
  payment_status IN ('unpaid','partial_paid','paid','debt')
);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (
  payment_method IN ('cash','bank_transfer','debt')
);
`;

const INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_org_status     ON orders(org_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer       ON orders(customer_id);
`;

async function runSql(supabaseUrl: string, serviceKey: string, sql: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql }),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-migration-secret");
  if (secret !== "ducphuc-migrate-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url   = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !svcKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  // Use pg module via DATABASE_URL_DIRECT if available, fallback to RPC
  const dbUrl = process.env.DATABASE_URL_DIRECT;
  if (dbUrl) {
    try {
      const { Client } = await import("pg");
      const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
      await client.connect();
      const results: string[] = [];
      const steps = [
        { name: "add_columns",    sql: MIGRATION_SQL },
        { name: "backfill_code",  sql: BACKFILL_SQL },
        { name: "migrate_status", sql: MIGRATE_STATUS_SQL },
        { name: "drop_constraint",sql: DROP_CONSTRAINT_SQL },
        { name: "add_constraint", sql: ADD_CONSTRAINT_SQL },
        { name: "indexes",        sql: INDEX_SQL },
      ];
      for (const step of steps) {
        try {
          await client.query(step.sql);
          results.push(`${step.name}: OK`);
        } catch (e: any) {
          results.push(`${step.name}: ${e.message}`);
        }
      }
      await client.end();
      return NextResponse.json({ ok: true, method: "pg", results });
    } catch (e: any) {
      return NextResponse.json({ ok: false, method: "pg", error: e.message }, { status: 500 });
    }
  }

  // Fallback: return instructions
  return NextResponse.json({
    ok: false,
    error: "DATABASE_URL_DIRECT not set",
    sql: [MIGRATION_SQL, BACKFILL_SQL, MIGRATE_STATUS_SQL, DROP_CONSTRAINT_SQL, ADD_CONSTRAINT_SQL, INDEX_SQL].join("\n\n"),
  }, { status: 400 });
}

export async function GET(request: Request) {
  const secret = request.headers.get("x-migration-secret");
  if (secret !== "ducphuc-migrate-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const svc    = createClient(url, svcKey, { auth: { persistSession: false } });

  const checks: Record<string, boolean> = {};

  // Check columns
  const cols = ["note","order_code","customer_name","customer_phone","ordered_at","payment_status","payment_method"];
  for (const col of cols) {
    const { error } = await svc.from("orders").select(col).limit(1);
    checks[`orders_${col}`] = !error;
  }

  // Check status values
  const { data: statusRows } = await svc.from("orders").select("status").limit(100);
  const statuses = [...new Set((statusRows || []).map((r: any) => r.status))];
  checks["status_no_draft"] = !statuses.includes("draft");
  checks["status_no_confirmed"] = !statuses.includes("confirmed");
  checks["status_no_closed"] = !statuses.includes("closed");
  checks["status_has_new"] = statuses.includes("new") || (statusRows || []).length === 0;

  return NextResponse.json({ status: checks, statuses });
}

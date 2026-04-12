import { NextResponse } from "next/server";
import { Client } from "pg";

export const dynamic = "force-dynamic";

// ── ONE-TIME migration runner ──────────────────────────────────────────────
// Protected by secret. Delete this file after migrations are applied.
// Endpoint: POST /api/admin/migrate
// Header: x-migration-secret: ducphuc-migrate-2026

const MIGRATION_SECRET = "ducphuc-migrate-2026";

const MIGRATIONS = {
  "0005_crm_sfa": `
    -- customers: CRM + SFA fields
    ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS latitude          numeric,
      ADD COLUMN IF NOT EXISTS longitude         numeric,
      ADD COLUMN IF NOT EXISTS next_follow_up_at timestamptz,
      ADD COLUMN IF NOT EXISTS crm_status        text DEFAULT 'active';

    -- customer_notes
    CREATE TABLE IF NOT EXISTS customer_notes (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      content      text NOT NULL,
      created_by   uuid NOT NULL REFERENCES auth.users(id),
      created_at   timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      CREATE POLICY "auth_all" ON customer_notes
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- sales_visits (SFA)
    CREATE TABLE IF NOT EXISTS sales_visits (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id    uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      user_id        uuid NOT NULL REFERENCES auth.users(id),
      check_in_time  timestamptz NOT NULL DEFAULT now(),
      check_in_lat   numeric,
      check_in_lng   numeric,
      note           text,
      status         text NOT NULL DEFAULT 'visited',
      created_at     timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE sales_visits ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      CREATE POLICY "auth_all" ON sales_visits
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_customers_assigned_user   ON customers(assigned_user_id);
    CREATE INDEX IF NOT EXISTS idx_customer_notes_customer   ON customer_notes(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_notes_created_by ON customer_notes(created_by);
    CREATE INDEX IF NOT EXISTS idx_sales_visits_customer     ON sales_visits(customer_id);
    CREATE INDEX IF NOT EXISTS idx_sales_visits_user         ON sales_visits(user_id);
  `,

  "0006_crm_automation": `
    -- customers: CRM automation fields
    ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
      ADD COLUMN IF NOT EXISTS crm_segment     text DEFAULT 'lead',
      ADD COLUMN IF NOT EXISTS avg_order_days  numeric;

    UPDATE customers SET crm_segment = 'lead' WHERE crm_segment IS NULL;

    -- orders: owner column (safe if exists)
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_customers_crm_segment   ON customers(crm_segment);
    CREATE INDEX IF NOT EXISTS idx_customers_last_contact  ON customers(last_contact_at);
    CREATE INDEX IF NOT EXISTS idx_customers_next_followup ON customers(next_follow_up_at);
    CREATE INDEX IF NOT EXISTS idx_sales_visits_checkin    ON sales_visits(check_in_time);
    CREATE INDEX IF NOT EXISTS idx_customer_notes_created  ON customer_notes(created_at DESC);
  `,
};

export async function POST(request: Request) {
  const secret = request.headers.get("x-migration-secret");
  if (secret !== MIGRATION_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build connection string from Supabase project
  // Format: postgresql://postgres.[ref]:[password]@[host]:5432/postgres
  // We need the DB_URL env var set in Vercel pointing to the direct DB
  const dbUrl = process.env.DATABASE_URL_DIRECT ?? process.env.POSTGRES_URL ?? process.env.DB_URL;

  if (!dbUrl || dbUrl.includes("file:./")) {
    return NextResponse.json({
      error: "DATABASE_URL_DIRECT not set. Add it to Vercel env vars.",
      hint: "Go to Supabase Dashboard → Settings → Database → Connection string (URI mode) and add it as DATABASE_URL_DIRECT in Vercel.",
    }, { status: 500 });
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    const results: Record<string, { ok: boolean; error?: string }> = {};

    for (const [name, sql] of Object.entries(MIGRATIONS)) {
      try {
        await client.query(sql);
        results[name] = { ok: true };
      } catch (err: any) {
        results[name] = { ok: false, error: err.message };
      }
    }

    await client.end();
    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    await client.end().catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const secret = request.headers.get("x-migration-secret");
  if (secret !== MIGRATION_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Schema audit via REST (no direct DB needed)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  async function checkCol(table: string, col: string): Promise<boolean> {
    const res = await fetch(`${url}/rest/v1/${table}?select=${col}&limit=1`, { headers: headers as any });
    return res.ok;
  }
  async function checkTable(table: string): Promise<boolean> {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers: headers as any });
    if (!res.ok) return false;
    const j = await res.json();
    return !j?.code?.startsWith("PGRST2");
  }

  const status = {
    customers_assigned_user_id:  await checkCol("customers", "assigned_user_id"),
    customers_crm_status:        await checkCol("customers", "crm_status"),
    customers_crm_segment:       await checkCol("customers", "crm_segment"),
    customers_last_contact_at:   await checkCol("customers", "last_contact_at"),
    customers_next_follow_up_at: await checkCol("customers", "next_follow_up_at"),
    customers_latitude:          await checkCol("customers", "latitude"),
    customer_notes_table:        await checkTable("customer_notes"),
    sales_visits_table:          await checkTable("sales_visits"),
    orders_owner_user_id:        await checkCol("orders", "owner_user_id"),
  };

  return NextResponse.json({ status });
}

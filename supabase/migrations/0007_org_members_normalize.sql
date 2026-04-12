-- Migration 0007: orgs + org_members + normalize product/customer/order columns
-- Safe to re-run: all ADD COLUMN IF NOT EXISTS, all CREATE TABLE IF NOT EXISTS
-- Run in Supabase Dashboard → SQL Editor

-- ── 1) orgs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orgs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON public.orgs FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insert default org if none exists
INSERT INTO public.orgs (name)
SELECT 'Đức Phúc Coffee'
WHERE NOT EXISTS (SELECT 1 FROM public.orgs LIMIT 1);

-- ── 2) org_members ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'sales',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON public.org_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: add org_members for all existing profiles (users) not yet enrolled
INSERT INTO public.org_members (org_id, user_id, role, is_active)
SELECT o.id, p.id, COALESCE(p.role, 'sales'), true
FROM   public.profiles p
CROSS  JOIN (SELECT id FROM public.orgs LIMIT 1) o
WHERE  NOT EXISTS (
  SELECT 1 FROM public.org_members m WHERE m.user_id = p.id
);

-- ── 3) Extend products table with columns the app expects ────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS kind           text DEFAULT 'original',
  ADD COLUMN IF NOT EXISTS price          numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weight_per_unit numeric,
  ADD COLUMN IF NOT EXISTS green_type_id  uuid REFERENCES public.green_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS packaging_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note          text;

-- Backfill price from sell_price if it exists and price is 0
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'sell_price') THEN
    UPDATE public.products SET price = sell_price WHERE price = 0 AND sell_price IS NOT NULL AND sell_price > 0;
  END IF;
END $$;

-- product_formulas (for blend products)
CREATE TABLE IF NOT EXISTS public.product_formulas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  green_type_id uuid NOT NULL REFERENCES public.green_types(id) ON DELETE CASCADE,
  ratio_pct     numeric NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_formulas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON public.product_formulas FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4) Extend customers table ────────────────────────────────────────────────
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS org_id        uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by    uuid REFERENCES auth.users(id)  ON DELETE SET NULL;

-- Backfill org_id for existing customers that have none
UPDATE public.customers
SET org_id = (SELECT id FROM public.orgs LIMIT 1)
WHERE org_id IS NULL;

-- ── 5) Extend orders table ───────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS org_id        uuid REFERENCES public.orgs(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id_ref uuid, -- temp placeholder, already exists in most schemas
  ADD COLUMN IF NOT EXISTS created_by    uuid REFERENCES auth.users(id)    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_qty_kg  numeric NOT NULL DEFAULT 0;

-- Drop temp column if added (org_id already on orders via 0005 or not needed to re-add)
ALTER TABLE public.orders DROP COLUMN IF EXISTS customer_id_ref;

-- Backfill org_id for existing orders
UPDATE public.orders
SET org_id = (SELECT id FROM public.orgs LIMIT 1)
WHERE org_id IS NULL;

-- ── 6) Update handle_new_user trigger to also create org_member ──────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.email), 'admin')
  ON CONFLICT (id) DO NOTHING;

  -- Create org_member for default org
  SELECT id INTO v_org_id FROM public.orgs LIMIT 1;
  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.org_members (org_id, user_id, role, is_active)
    VALUES (v_org_id, new.id, 'admin', true)
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- ── 7) Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_org_members_user    ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org     ON public.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_customers_org       ON public.customers(org_id);
CREATE INDEX IF NOT EXISTS idx_orders_org          ON public.orders(org_id);
CREATE INDEX IF NOT EXISTS idx_product_formulas_product ON public.product_formulas(product_id);

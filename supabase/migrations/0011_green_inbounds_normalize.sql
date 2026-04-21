-- Migration 0011: Chuẩn hóa green_inbounds — thêm org_id, supplier_id
-- Safe to re-run (IF NOT EXISTS / DO $$ blocks)

-- Step 1: Add missing columns
ALTER TABLE public.green_inbounds
  ADD COLUMN IF NOT EXISTS org_id      uuid,
  ADD COLUMN IF NOT EXISTS supplier_id uuid;

-- Step 2: FK constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'green_inbounds_org_id_fkey' AND table_name = 'green_inbounds'
  ) THEN
    ALTER TABLE public.green_inbounds
      ADD CONSTRAINT green_inbounds_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- organizations might be named 'orgs'
  BEGIN
    ALTER TABLE public.green_inbounds
      ADD CONSTRAINT green_inbounds_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'green_inbounds_supplier_id_fkey' AND table_name = 'green_inbounds'
  ) THEN
    ALTER TABLE public.green_inbounds
      ADD CONSTRAINT green_inbounds_supplier_id_fkey
      FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Step 3: Backfill org_id for existing rows (use default org)
UPDATE public.green_inbounds
SET org_id = '00000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

-- Step 4: Make org_id NOT NULL after backfill
ALTER TABLE public.green_inbounds
  ALTER COLUMN org_id SET NOT NULL;

-- Step 5: Update v_green_stock view to include supplier info
CREATE OR REPLACE VIEW public.v_green_stock AS
SELECT
  gi.id              AS green_inbound_id,
  gi.inbound_at,
  gi.lot_code,
  gi.green_type_id,
  gt.name            AS green_type_name,
  gi.qty_kg          AS original_qty_kg,
  gi.unit_cost,
  gi.org_id,
  gi.supplier_id,
  s.name             AS supplier_name,
  gi.created_by,
  coalesce(u.used_kg, 0)                    AS used_kg,
  gi.qty_kg - coalesce(u.used_kg, 0)        AS remaining_kg
FROM public.green_inbounds gi
JOIN public.green_types gt ON gt.id = gi.green_type_id
LEFT JOIN public.suppliers s ON s.id = gi.supplier_id
LEFT JOIN (
  SELECT green_inbound_id, sum(input_kg) AS used_kg
  FROM public.roast_batches
  WHERE status != 'cancelled'
  GROUP BY green_inbound_id
) u ON u.green_inbound_id = gi.id
ORDER BY gi.inbound_at ASC;

-- Step 6: Index
CREATE INDEX IF NOT EXISTS idx_green_inbounds_org_id ON public.green_inbounds(org_id);
CREATE INDEX IF NOT EXISTS idx_green_inbounds_supplier ON public.green_inbounds(supplier_id);

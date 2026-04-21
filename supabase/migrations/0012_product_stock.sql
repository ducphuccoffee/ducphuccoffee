-- Migration 0012: product_stock + fix batch cost calculation
-- Creates product_stock table for finished goods inventory tracking

-- Step 1: Create product_stock table
CREATE TABLE IF NOT EXISTS public.product_stock (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id    uuid REFERENCES public.roast_batches(id) ON DELETE SET NULL,
  qty_kg      numeric NOT NULL DEFAULT 0,
  cost_per_kg numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Step 2: Indexes
CREATE INDEX IF NOT EXISTS idx_product_stock_org     ON public.product_stock(org_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_product ON public.product_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_batch   ON public.product_stock(batch_id);

-- Step 3: RLS
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_stock_org_read" ON public.product_stock
  FOR SELECT USING (true);

CREATE POLICY "product_stock_org_insert" ON public.product_stock
  FOR INSERT WITH CHECK (true);

CREATE POLICY "product_stock_org_update" ON public.product_stock
  FOR UPDATE USING (true);

-- Step 4: View for aggregated stock per product
CREATE OR REPLACE VIEW public.v_product_stock AS
SELECT
  ps.org_id,
  ps.product_id,
  p.name        AS product_name,
  p.sku,
  p.kind,
  p.price       AS sell_price,
  p.unit,
  SUM(ps.qty_kg)                                      AS total_qty_kg,
  CASE WHEN SUM(ps.qty_kg) > 0
    THEN ROUND(SUM(ps.qty_kg * ps.cost_per_kg) / SUM(ps.qty_kg))
    ELSE 0
  END                                                  AS avg_cost_per_kg,
  COUNT(ps.id)                                         AS batch_count
FROM public.product_stock ps
JOIN public.products p ON p.id = ps.product_id
GROUP BY ps.org_id, ps.product_id, p.name, p.sku, p.kind, p.price, p.unit;

-- Step 5: Backfill existing batches — recalculate cost fields
UPDATE public.roast_batches
SET
  loss_kg      = input_kg - output_kg,
  loss_percent = CASE WHEN input_kg > 0 THEN ROUND(((input_kg - output_kg) / input_kg) * 100, 2) ELSE 0 END,
  cost_per_kg  = CASE WHEN output_kg > 0 THEN ROUND((input_kg * unit_cost_green) / output_kg) ELSE 0 END,
  cost_total   = CASE WHEN output_kg > 0 THEN ROUND((input_kg * unit_cost_green) / output_kg * output_kg) ELSE 0 END
WHERE status = 'completed'
  AND (loss_kg = 0 OR cost_per_kg = 0 OR cost_total = 0);

-- Step 6: Backfill product_stock from existing completed batches
-- Match batch.green_type_id → products.green_type_id (kind = 'original')
INSERT INTO public.product_stock (org_id, product_id, batch_id, qty_kg, cost_per_kg)
SELECT
  rb.org_id,
  p.id,
  rb.id,
  rb.output_kg,
  CASE WHEN rb.output_kg > 0 THEN ROUND((rb.input_kg * rb.unit_cost_green) / rb.output_kg) ELSE 0 END
FROM public.roast_batches rb
JOIN public.products p ON p.green_type_id = rb.green_type_id AND p.kind = 'original'
WHERE rb.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_stock ps WHERE ps.batch_id = rb.id
  );

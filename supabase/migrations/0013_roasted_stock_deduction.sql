-- Migration 0013: roasted_stock_lots + product_recipe_lines + stock deduction function
-- Replaces product_stock with proper roasted stock tracking

-- Step 1: Create roasted_stock_lots
CREATE TABLE IF NOT EXISTS public.roasted_stock_lots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  green_type_id   uuid NOT NULL REFERENCES public.green_types(id),
  batch_id        uuid REFERENCES public.roast_batches(id) ON DELETE SET NULL,
  qty_kg          numeric NOT NULL DEFAULT 0,
  remaining_kg    numeric NOT NULL DEFAULT 0,
  cost_per_kg     numeric NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roasted_stock_org ON public.roasted_stock_lots(org_id);
CREATE INDEX IF NOT EXISTS idx_roasted_stock_green ON public.roasted_stock_lots(green_type_id);
CREATE INDEX IF NOT EXISTS idx_roasted_stock_batch ON public.roasted_stock_lots(batch_id);
CREATE INDEX IF NOT EXISTS idx_roasted_stock_remaining ON public.roasted_stock_lots(remaining_kg) WHERE remaining_kg > 0;

ALTER TABLE public.roasted_stock_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roasted_stock_lots_all" ON public.roasted_stock_lots FOR ALL USING (true) WITH CHECK (true);

-- Step 2: Create product_recipe_lines
CREATE TABLE IF NOT EXISTS public.product_recipe_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  green_type_id   uuid NOT NULL REFERENCES public.green_types(id),
  ratio           numeric NOT NULL CHECK (ratio > 0 AND ratio <= 1)
);

CREATE INDEX IF NOT EXISTS idx_recipe_product ON public.product_recipe_lines(product_id);

ALTER TABLE public.product_recipe_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_lines_all" ON public.product_recipe_lines FOR ALL USING (true) WITH CHECK (true);

-- Step 3: Create stock_movements log
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  green_type_id   uuid NOT NULL REFERENCES public.green_types(id),
  roasted_lot_id  uuid REFERENCES public.roasted_stock_lots(id),
  order_id        uuid,
  movement_type   text NOT NULL, -- 'production_in', 'sale_out'
  qty_kg          numeric NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_order ON public.stock_movements(order_id);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_movements_all" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);

-- Step 4: View v_roasted_stock
CREATE OR REPLACE VIEW public.v_roasted_stock AS
SELECT
  rsl.org_id,
  rsl.green_type_id,
  gt.name AS green_type_name,
  SUM(rsl.remaining_kg) AS total_remaining_kg,
  CASE WHEN SUM(rsl.remaining_kg) > 0
    THEN ROUND(SUM(rsl.remaining_kg * rsl.cost_per_kg) / SUM(rsl.remaining_kg))
    ELSE 0
  END AS avg_cost_per_kg,
  COUNT(*) FILTER (WHERE rsl.remaining_kg > 0) AS lot_count
FROM public.roasted_stock_lots rsl
JOIN public.green_types gt ON gt.id = rsl.green_type_id
GROUP BY rsl.org_id, rsl.green_type_id, gt.name;

-- Step 5: Backfill roasted_stock_lots from existing completed batches
INSERT INTO public.roasted_stock_lots (org_id, green_type_id, batch_id, qty_kg, remaining_kg, cost_per_kg, created_at)
SELECT
  rb.org_id,
  rb.green_type_id,
  rb.id,
  rb.output_kg,
  rb.output_kg,
  CASE WHEN rb.output_kg > 0 THEN ROUND((rb.input_kg * rb.unit_cost_green) / rb.output_kg) ELSE 0 END,
  rb.created_at
FROM public.roast_batches rb
WHERE rb.status = 'completed'
  AND rb.green_type_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.roasted_stock_lots rsl WHERE rsl.batch_id = rb.id);

-- Step 6: DB function apply_stock_deduction
CREATE OR REPLACE FUNCTION public.apply_stock_deduction(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_id uuid;
  v_item RECORD;
  v_product RECORD;
  v_recipe RECORD;
  v_required_kg numeric;
  v_green_type_id uuid;
  v_lot RECORD;
  v_to_deduct numeric;
BEGIN
  -- Get order org_id
  SELECT org_id INTO v_org_id FROM public.orders WHERE id = p_order_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  -- Check no prior deduction for this order
  IF EXISTS (SELECT 1 FROM public.stock_movements WHERE order_id = p_order_id AND movement_type = 'sale_out') THEN
    RAISE EXCEPTION 'Stock already deducted for order %', p_order_id;
  END IF;

  -- Loop order_items
  FOR v_item IN
    SELECT oi.product_id, oi.qty
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    -- Get product
    SELECT id, kind, green_type_id INTO v_product
    FROM public.products WHERE id = v_item.product_id;

    IF v_product IS NULL THEN
      RAISE EXCEPTION 'Product % not found', v_item.product_id;
    END IF;

    IF v_product.kind = 'original' THEN
      -- Direct deduction by green_type_id
      IF v_product.green_type_id IS NULL THEN
        RAISE EXCEPTION 'Product % (original) has no green_type_id', v_item.product_id;
      END IF;
      PERFORM _deduct_roasted_fifo(v_org_id, v_product.green_type_id, v_item.qty, p_order_id);

    ELSIF v_product.kind = 'blend' THEN
      -- Deduct per recipe line
      FOR v_recipe IN
        SELECT green_type_id, ratio
        FROM public.product_recipe_lines
        WHERE product_id = v_item.product_id
      LOOP
        v_required_kg := v_item.qty * v_recipe.ratio;
        PERFORM _deduct_roasted_fifo(v_org_id, v_recipe.green_type_id, v_required_kg, p_order_id);
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- Helper: FIFO deduction from roasted_stock_lots
CREATE OR REPLACE FUNCTION public._deduct_roasted_fifo(
  p_org_id uuid,
  p_green_type_id uuid,
  p_required_kg numeric,
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_remaining numeric := p_required_kg;
  v_lot RECORD;
  v_take numeric;
BEGIN
  IF p_required_kg <= 0 THEN RETURN; END IF;

  FOR v_lot IN
    SELECT id, remaining_kg
    FROM public.roasted_stock_lots
    WHERE org_id = p_org_id
      AND green_type_id = p_green_type_id
      AND remaining_kg > 0
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    IF v_lot.remaining_kg >= v_remaining THEN
      v_take := v_remaining;
    ELSE
      v_take := v_lot.remaining_kg;
    END IF;

    UPDATE public.roasted_stock_lots
    SET remaining_kg = remaining_kg - v_take
    WHERE id = v_lot.id;

    INSERT INTO public.stock_movements (org_id, green_type_id, roasted_lot_id, order_id, movement_type, qty_kg)
    VALUES (p_org_id, p_green_type_id, v_lot.id, p_order_id, 'sale_out', v_take);

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Not enough roasted stock for green_type %, need % kg more',
      p_green_type_id, v_remaining;
  END IF;
END;
$$;

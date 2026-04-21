-- Migration 0014: Create product_recipe_lines as view over product_formulas
-- product_formulas stores ratio_pct (0-100)
-- product_recipe_lines expected by apply_stock_deduction with ratio (0-1)

CREATE OR REPLACE VIEW public.product_recipe_lines AS
SELECT
  id,
  product_id,
  green_type_id,
  ratio_pct / 100.0 AS ratio
FROM public.product_formulas;

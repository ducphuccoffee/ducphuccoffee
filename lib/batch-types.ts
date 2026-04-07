export type RoastBatch = {
  id: string;
  batch_code: string;
  roast_date: string;
  status: "draft" | "completed" | "cancelled";
  green_inbound_id: string | null;
  green_type_id: string | null;
  green_type_name: string | null;
  lot_code: string | null;
  input_kg: number;
  output_kg: number;
  loss_kg: number;
  loss_pct: number;
  unit_cost_green: number;
  total_cost: number;
  cost_per_kg: number;
  note: string | null;
  created_at: string;
};

export type GreenStock = {
  green_inbound_id: string;
  inbound_at: string;
  lot_code: string;
  green_type_id: string;
  green_type_name: string;
  original_qty_kg: number;
  unit_cost: number;
  used_kg: number;
  remaining_kg: number;
};

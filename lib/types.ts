export type Product = {
  id: string;
  name: string;
  sku: string | null;
  type: "raw" | "finished";
  unit: string | null;
  cost_price: number;
  sell_price: number;
  is_active: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  role: "admin" | "roastery_manager" | "warehouse" | "sales" | "collaborator" | string;
  can_view_profit: boolean;
  created_at: string;
};

export type GreenType = {
  id: string;
  name: string;
  created_at: string;
};

export type GreenInbound = {
  id: string;
  inbound_at: string;
  lot_code: string;
  green_type_id: string;
  green_type_name?: string | null;
  qty_kg: number;
  unit_cost: number;
  created_at: string;
};

export type RoastBatch = {
  id: string;
  roasted_at: string;
  batch_code: string;
  input_kg: number;
  output_kg: number;
  loss_kg: number;
  loss_pct: number;
  total_cost: number;
  cost_per_kg: number;
  created_at: string;
};

export type Lead = {
  id: string;
  name: string;
  phone: string | null;
  stage: string;
  owner_id: string;
  created_at: string;
};

export type Checkin = {
  id: string;
  checkin_at: string;
  lat: number;
  lng: number;
  place_name: string | null;
  note: string | null;
  created_at: string;
};

export type CommissionRow = {
  id: string;
  order_id: string;
  beneficiary_id: string;
  amount: number;
  status: string;
  reason: string;
  created_at: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number;
  created_at: string;
};


export type Order = {
  id: string;
  order_code: string | null;
  customer_id: string | null;
  customer_name?: string | null;
  total_amount: number;
  cost_amount: number;
  profit: number;
  status: string | null;
  created_at: string;
};

export type OrderItemInput = {
  product_id: string;
  qty: number;
  sell_price?: number; // allow override
};

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

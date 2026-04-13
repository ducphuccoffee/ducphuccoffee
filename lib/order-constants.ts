// Order flow constants — shared between API route and client components
// Statuses match the actual order_status enum in Supabase
export const ORDER_STATUSES = [
  "draft", "confirmed", "delivered", "closed",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Payment fields are not yet in the DB schema — kept here for future migration
export const PAYMENT_STATUSES = ["unpaid", "partial_paid", "paid", "debt"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["cash", "bank_transfer", "debt"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_STATUS_LABEL: Record<string, string> = {
  draft:     "Nháp",
  confirmed: "Đã xác nhận",
  delivered: "Đã giao",
  closed:    "Đã đóng",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid:       "Chưa TT",
  partial_paid: "TT một phần",
  paid:         "Đã TT",
  debt:         "Công nợ",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash:          "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  debt:          "Công nợ",
};

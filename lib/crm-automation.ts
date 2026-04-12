/**
 * CRM Automation helpers
 * - Customer attention/risk scoring
 * - At-risk detection
 * - Follow-up overdue detection
 * - Timeline builder
 * - Segment classification
 */

// ── Constants (tunable) ────────────────────────────────────────────────────
export const CRM_THRESHOLDS = {
  /** Days since last order before customer is considered "need attention" */
  DAYS_NEED_ATTENTION: 30,
  /** Days since last order before customer is considered "at risk" */
  DAYS_AT_RISK: 60,
  /** Days since last order before customer is considered "churn risk" */
  DAYS_CHURN_RISK: 90,
  /** Minimum orders to be considered "active" (not just a one-time buyer) */
  MIN_ORDERS_ACTIVE: 2,
  /** Revenue threshold (VND) to be considered VIP */
  VIP_REVENUE_THRESHOLD: 5_000_000,
  /** Days an overdue follow-up is considered "critical" */
  OVERDUE_CRITICAL_DAYS: 3,
} as const;

// ── Types ──────────────────────────────────────────────────────────────────

export type AttentionStatus =
  | "healthy"        // recently active, no issues
  | "need_attention" // 30-60 days no order
  | "at_risk"        // 60-90 days no order
  | "churn_risk"     // 90+ days no order
  | "new"            // never ordered
  | "overdue_followup"; // has overdue follow-up (overrides other statuses)

export type CrmSegment = "lead" | "active" | "vip" | "inactive" | "at_risk";

export interface CustomerMetrics {
  customer_id: string;
  total_orders: number;
  total_revenue: number;
  last_order_date: string | null;
  days_since_last_order: number | null;
  avg_order_value: number;
  attention_status: AttentionStatus;
  crm_segment: CrmSegment;
}

export interface CustomerRiskItem {
  customer_id: string;
  customer_name: string;
  phone: string | null;
  assigned_user_id: string | null;
  attention_status: AttentionStatus;
  days_since_last_order: number | null;
  last_order_date: string | null;
  total_orders: number;
  total_revenue: number;
  next_follow_up_at: string | null;
  overdue_days: number | null;
}

export interface TimelineItem {
  id: string;
  type: "order" | "note" | "visit" | "followup_set";
  ts: string;
  title: string;
  subtitle: string;
  badge?: string;
  badge_color?: string;
}

// ── Attention status logic ─────────────────────────────────────────────────

export function computeAttentionStatus(
  daysSinceLastOrder: number | null,
  nextFollowUpAt: string | null,
  totalOrders: number
): AttentionStatus {
  const now = Date.now();

  // Overdue follow-up takes priority
  if (nextFollowUpAt) {
    const dueMs = new Date(nextFollowUpAt).getTime();
    if (dueMs < now) return "overdue_followup";
  }

  if (totalOrders === 0) return "new";
  if (daysSinceLastOrder === null) return "new";

  if (daysSinceLastOrder >= CRM_THRESHOLDS.DAYS_CHURN_RISK)  return "churn_risk";
  if (daysSinceLastOrder >= CRM_THRESHOLDS.DAYS_AT_RISK)     return "at_risk";
  if (daysSinceLastOrder >= CRM_THRESHOLDS.DAYS_NEED_ATTENTION) return "need_attention";
  return "healthy";
}

export function computeCrmSegment(
  totalOrders: number,
  totalRevenue: number,
  daysSinceLastOrder: number | null,
  currentSegment?: string | null
): CrmSegment {
  if (totalOrders === 0) return "lead";
  if (totalRevenue >= CRM_THRESHOLDS.VIP_REVENUE_THRESHOLD) return "vip";
  if (daysSinceLastOrder !== null && daysSinceLastOrder >= CRM_THRESHOLDS.DAYS_AT_RISK) return "at_risk";
  if (daysSinceLastOrder !== null && daysSinceLastOrder >= CRM_THRESHOLDS.DAYS_CHURN_RISK) return "inactive";
  if (totalOrders >= CRM_THRESHOLDS.MIN_ORDERS_ACTIVE) return "active";
  return "lead";
}

export function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / 86_400_000);
}

export function overdueDays(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  if (ms <= 0) return null; // not yet due
  return Math.floor(ms / 86_400_000);
}

// ── Batch metrics from raw arrays ──────────────────────────────────────────

export function buildCustomerMetricsMap(
  orders: Array<{ customer_id: string | null; total_amount: number; created_at: string }>
): Record<string, { count: number; revenue: number; lastOrder: string | null }> {
  const map: Record<string, { count: number; revenue: number; lastOrder: string | null }> = {};
  for (const o of orders) {
    const cid = o.customer_id;
    if (!cid) continue;
    if (!map[cid]) map[cid] = { count: 0, revenue: 0, lastOrder: null };
    map[cid].count++;
    map[cid].revenue += Number(o.total_amount) || 0;
    if (!map[cid].lastOrder || o.created_at > map[cid].lastOrder!) {
      map[cid].lastOrder = o.created_at;
    }
  }
  return map;
}

export function enrichCustomerWithMetrics<
  T extends {
    id: string;
    next_follow_up_at?: string | null;
    crm_segment?: string | null;
  }
>(
  customer: T,
  metricsMap: Record<string, { count: number; revenue: number; lastOrder: string | null }>
): T & {
  order_count: number;
  revenue: number;
  last_order: string | null;
  days_since_last_order: number | null;
  attention_status: AttentionStatus;
  computed_segment: CrmSegment;
} {
  const m = metricsMap[customer.id] ?? { count: 0, revenue: 0, lastOrder: null };
  const daysSinceLast = daysSince(m.lastOrder);
  const attention = computeAttentionStatus(
    daysSinceLast,
    customer.next_follow_up_at ?? null,
    m.count
  );
  const segment = computeCrmSegment(m.count, m.revenue, daysSinceLast, customer.crm_segment);
  return {
    ...customer,
    order_count: m.count,
    revenue: m.revenue,
    last_order: m.lastOrder,
    days_since_last_order: daysSinceLast,
    attention_status: attention,
    computed_segment: segment,
  };
}

// ── Timeline builder ───────────────────────────────────────────────────────

export function buildTimeline(
  orders: Array<{ id: string; order_code?: string | null; total_amount: number; created_at: string; status?: string | null }>,
  notes: Array<{ id: string; content: string; created_at: string; profiles?: { full_name?: string | null } | null }>,
  visits: Array<{ id: string; check_in_time: string; note?: string | null; status: string }>
): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const o of orders) {
    items.push({
      id: `order-${o.id}`,
      type: "order",
      ts: o.created_at,
      title: `Đơn hàng${o.order_code ? ` #${o.order_code}` : ""}`,
      subtitle: Number(o.total_amount).toLocaleString("vi-VN") + " ₫",
      badge: o.status ?? "new",
      badge_color:
        o.status === "completed" || o.status === "delivered"
          ? "green"
          : o.status === "cancelled" || o.status === "failed"
          ? "red"
          : "blue",
    });
  }

  for (const n of notes) {
    items.push({
      id: `note-${n.id}`,
      type: "note",
      ts: n.created_at,
      title: "Ghi chú",
      subtitle: n.content.slice(0, 80) + (n.content.length > 80 ? "…" : ""),
      badge: (n.profiles as any)?.full_name ?? undefined,
    });
  }

  for (const v of visits) {
    const statusLabel: Record<string, string> = {
      visited: "Đã thăm",
      no_answer: "Không bắt máy",
      follow_up: "Cần follow-up",
    };
    items.push({
      id: `visit-${v.id}`,
      type: "visit",
      ts: v.check_in_time,
      title: `Check-in: ${statusLabel[v.status] ?? v.status}`,
      subtitle: v.note ?? "",
    });
  }

  return items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
}

// ── Labels / colors for UI ─────────────────────────────────────────────────

export const ATTENTION_CONFIG: Record<
  AttentionStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  healthy:          { label: "Bình thường",       color: "text-green-700",  bg: "bg-green-100",  icon: "✓" },
  need_attention:   { label: "Cần chú ý",         color: "text-amber-700",  bg: "bg-amber-100",  icon: "!" },
  at_risk:          { label: "Có nguy cơ",         color: "text-orange-700", bg: "bg-orange-100", icon: "⚠" },
  churn_risk:       { label: "Nguy cơ mất khách", color: "text-red-700",    bg: "bg-red-100",    icon: "✕" },
  new:              { label: "Khách mới",          color: "text-blue-700",   bg: "bg-blue-100",   icon: "★" },
  overdue_followup: { label: "Follow-up trễ",     color: "text-purple-700", bg: "bg-purple-100", icon: "⏰" },
};

export const SEGMENT_CONFIG: Record<
  CrmSegment,
  { label: string; color: string; bg: string }
> = {
  lead:     { label: "Lead",     color: "text-gray-600",   bg: "bg-gray-100"   },
  active:   { label: "Đang mua", color: "text-blue-700",   bg: "bg-blue-100"   },
  vip:      { label: "VIP",      color: "text-yellow-700", bg: "bg-yellow-100" },
  inactive: { label: "Ngừng mua",color: "text-gray-500",   bg: "bg-gray-100"   },
  at_risk:  { label: "Rủi ro",   color: "text-red-700",    bg: "bg-red-100"    },
};

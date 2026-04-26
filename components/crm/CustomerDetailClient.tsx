"use client";

import { useEffect, useState } from "react";
import { formatDateVN, formatDateTimeVN, formatCurrencyVN } from "@/lib/date";
import { Phone, MapPin, DollarSign, ShoppingCart, Target, MessageSquare, Footprints, CheckSquare, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Sheet } from "@/components/ui/Sheet";

type Activity = { id: string; type: string; content: string | null; created_at: string };
type Visit = { id: string; checkin_at: string; result: string | null; note: string | null };
type Opp = { id: string; title: string; expected_value: number; stage: string; updated_at: string };
type Task = { id: string; type: string; status: string; description: string | null; due_at: string | null; created_at: string };
type Order = { id: string; order_code: string; total_amount: number; status: string; created_at: string };
type Debt = { total_ordered: number; total_paid: number; debt_amount: number };
type Customer = { id: string; name: string; phone: string | null; address: string | null; crm_status: string | null; crm_segment: string | null; stage: string | null; owner_user_id: string | null; created_at: string };

const ACTIVITY_LABEL: Record<string, string> = { call: "Gọi", message: "Nhắn tin", meeting: "Gặp", visit: "Ghé thăm", quotation: "Báo giá", note: "Ghi chú" };
const RESULT_LABEL: Record<string, string> = { no_answer: "Không gặp", met_owner: "Gặp chủ", sampled: "Gửi sample", quoted: "Báo giá", followup_needed: "Cần F/U", won: "Chốt", lost: "Mất" };
const STAGE_LABEL: Record<string, string> = { new: "Mới", consulting: "Tư vấn", demo: "Demo", quoted: "Báo giá", negotiating: "Đàm phán", won: "Thắng", lost: "Mất" };

export function CustomerDetailClient({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [opps, setOpps] = useState<Opp[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [debt, setDebt] = useState<Debt | null>(null);
  const [loading, setLoading] = useState(true);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [actType, setActType] = useState("call");
  const [actContent, setActContent] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [planScheduledAt, setPlanScheduledAt] = useState(() => {
    const d = new Date();
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/customers?id=${customerId}`).then(r => r.json()),
      fetch(`/api/crm-activities?customer_id=${customerId}`).then(r => r.json()),
      fetch(`/api/sfa-visits?customer_id=${customerId}`).then(r => r.json()),
      fetch(`/api/opportunities?customer_id=${customerId}`).then(r => r.json()),
      fetch(`/api/orders?customer_id=${customerId}`).then(r => r.json()),
      fetch(`/api/customer-debt`).then(r => r.json()),
    ]).then(([cust, act, vis, opp, ord, dbt]) => {
      if (cust.data) {
        const c = Array.isArray(cust.data) ? cust.data.find((x: any) => x.id === customerId) : cust.data;
        setCustomer(c ?? null);
      }
      setActivities(act.data ?? []);
      const allVisits = (vis.data ?? []) as any[];
      setVisits(allVisits.map((v: any) => ({ ...v })));
      // Planned visits (no result, no checkout) become the "tasks" list for this customer.
      setTasks(
        allVisits
          .filter((v: any) => v.result == null && v.checkout_at == null)
          .map((v: any) => ({
            id: v.id,
            type: "visit",
            status: "todo",
            description: v.note,
            due_at: v.checkin_at,
            created_at: v.created_at ?? v.checkin_at,
          }))
      );
      setOpps(opp.data ?? []);
      setOrders(ord.data ?? []);
      const debtRow = (dbt.data ?? []).find((d: any) => d.customer_id === customerId);
      setDebt(debtRow ?? null);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [customerId]);

  async function addActivity(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/crm-activities", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: customerId, type: actType, content: actContent }),
    });
    setSaving(false); setShowActivityForm(false); setActContent(""); load();
  }

  async function planVisit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/sfa-visits", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode:         "plan",
        customer_id:  customerId,
        scheduled_at: planScheduledAt ? new Date(planScheduledAt).toISOString() : undefined,
        note:         planNote.trim() || null,
      }),
    });
    setSaving(false); setShowPlanForm(false); setPlanNote(""); load();
  }

  async function completeTask(id: string) {
    // Planned visits are sfa_visits rows — "closing" one means marking it lost
    // (cancelled) to take it off the planned list without losing the history.
    await fetch(`/api/sfa-visits?id=${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: "lost", note: "(đã huỷ từ trang KH)" }),
    });
    load();
  }

  if (loading) return <div className="p-4 space-y-3 animate-pulse">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>;
  if (!customer) return <div className="p-4 text-gray-500">Không tìm thấy khách hàng</div>;

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

  return (
    <div className="p-4 space-y-4">
      <Link href="/customers" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mb-2"><ArrowLeft className="h-3 w-3" /> Danh sách KH</Link>

      {/* Overview */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-bold text-gray-800">{customer.name}</h2>
        <div className="mt-2 space-y-1 text-sm text-gray-600">
          {customer.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{customer.phone}</div>}
          {customer.address && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{customer.address}</div>}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {customer.crm_status && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{customer.crm_status}</span>}
          {customer.crm_segment && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{customer.crm_segment}</span>}
          {customer.stage && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{customer.stage}</span>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border bg-white p-3 text-center">
          <div className="text-[10px] text-gray-400 uppercase"><ShoppingCart className="h-3 w-3 inline mr-1" />Đơn hàng</div>
          <div className="text-xl font-bold text-gray-800">{orders.length}</div>
        </div>
        <div className="rounded-xl border bg-white p-3 text-center">
          <div className="text-[10px] text-gray-400 uppercase"><DollarSign className="h-3 w-3 inline mr-1" />Doanh thu</div>
          <div className="text-sm font-bold text-gray-800">{formatCurrencyVN(totalRevenue)}đ</div>
        </div>
        <div className="rounded-xl border bg-white p-3 text-center">
          <div className="text-[10px] text-gray-400 uppercase"><DollarSign className="h-3 w-3 inline mr-1" />Công nợ</div>
          <div className={`text-sm font-bold ${debt && debt.debt_amount > 0 ? "text-red-600" : "text-green-600"}`}>{debt ? formatCurrencyVN(debt.debt_amount) : 0}đ</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setShowActivityForm(true)} className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs text-gray-700 hover:bg-gray-50"><MessageSquare className="h-3 w-3" />Ghi hoạt động</button>
        <button onClick={() => setShowPlanForm(true)} className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs text-gray-700 hover:bg-gray-50"><CheckSquare className="h-3 w-3" />Lên kế hoạch visit</button>
        <Link href={`/crm/opportunities?customer_id=${customerId}`} className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs text-gray-700 hover:bg-gray-50"><Target className="h-3 w-3" />Tạo cơ hội</Link>
      </div>

      {/* Planned visits (derived from sfa_visits with result IS NULL) */}
      {tasks.length > 0 && (
        <Section title="Kế hoạch ghé thăm" icon={<CheckSquare className="h-4 w-4" />} count={tasks.length}>
          {tasks.map(t => (
            <div key={t.id} className="flex items-start justify-between gap-2 py-1.5">
              <div className="min-w-0">
                <span className="text-[10px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded mr-1">Ghé thăm</span>
                <span className="text-sm text-gray-700">{t.description ?? "—"}</span>
                {t.due_at && <span className="text-[10px] text-gray-400 ml-2">{formatDateVN(t.due_at)}</span>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Link href={`/crm/sfa?customer_id=${customerId}&visit_id=${t.id}`} className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded hover:bg-blue-700">Check-in</Link>
                <button onClick={() => completeTask(t.id)} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-200">Huỷ</button>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Opportunities */}
      {opps.length > 0 && (
        <Section title="Cơ hội" icon={<Target className="h-4 w-4" />} count={opps.length}>
          {opps.map(o => (
            <div key={o.id} className="flex items-center justify-between py-1.5">
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-800 truncate">{o.title}</span>
                <span className={`text-[10px] ml-1.5 px-1 py-0.5 rounded ${o.stage === "won" ? "bg-green-100 text-green-700" : o.stage === "lost" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{STAGE_LABEL[o.stage] ?? o.stage}</span>
              </div>
              <span className="text-sm text-gray-600 shrink-0">{formatCurrencyVN(Number(o.expected_value))}đ</span>
            </div>
          ))}
        </Section>
      )}

      {/* Activity timeline */}
      <Section title="Hoạt động" icon={<MessageSquare className="h-4 w-4" />} count={activities.length}>
        {activities.length === 0 ? <p className="text-xs text-gray-400">Chưa có</p> : activities.slice(0, 20).map(a => (
          <div key={a.id} className="py-1.5 border-l-2 border-gray-200 pl-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded">{ACTIVITY_LABEL[a.type] ?? a.type}</span>
              <span className="text-[10px] text-gray-400">{formatDateTimeVN(a.created_at)}</span>
            </div>
            {a.content && <p className="text-xs text-gray-600 mt-0.5">{a.content}</p>}
          </div>
        ))}
      </Section>

      {/* Visits */}
      <Section title="Lịch sử ghé thăm" icon={<Footprints className="h-4 w-4" />} count={visits.length}>
        {visits.length === 0 ? <p className="text-xs text-gray-400">Chưa có</p> : visits.slice(0, 10).map(v => (
          <div key={v.id} className="flex items-center justify-between py-1.5">
            <div className="text-xs text-gray-600">{formatDateTimeVN(v.checkin_at)}{v.note ? ` — ${v.note}` : ""}</div>
            {v.result && <span className="text-[10px] bg-gray-100 text-gray-600 px-1 py-0.5 rounded shrink-0">{RESULT_LABEL[v.result] ?? v.result}</span>}
          </div>
        ))}
      </Section>

      {/* Orders */}
      <Section title="Đơn hàng" icon={<ShoppingCart className="h-4 w-4" />} count={orders.length}>
        {orders.length === 0 ? <p className="text-xs text-gray-400">Chưa có</p> : orders.slice(0, 10).map(o => (
          <div key={o.id} className="flex items-center justify-between py-1.5">
            <div className="text-sm text-gray-700">#{o.order_code}</div>
            <div className="text-right">
              <span className="text-sm font-bold text-gray-800">{formatCurrencyVN(Number(o.total_amount))}đ</span>
              <span className="text-[10px] text-gray-400 ml-1.5">{o.status}</span>
            </div>
          </div>
        ))}
      </Section>

      {/* Activity form modal */}
      {showActivityForm && (
        <Modal onClose={() => setShowActivityForm(false)} title="Ghi hoạt động">
          <form onSubmit={addActivity} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Loại</label>
              <select value={actType} onChange={e => setActType(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-white">
                {Object.entries(ACTIVITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Nội dung</label>
              <textarea value={actContent} onChange={e => setActContent(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm resize-none" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowActivityForm(false)} className="flex-1 px-3 py-2 border rounded-lg text-sm text-gray-600">Huỷ</button>
              <button type="submit" disabled={saving} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? "..." : "Lưu"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Plan visit modal */}
      {showPlanForm && (
        <Modal onClose={() => setShowPlanForm(false)} title="Lên kế hoạch ghé thăm">
          <form onSubmit={planVisit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Giờ dự kiến</label>
              <input type="datetime-local" value={planScheduledAt} onChange={e => setPlanScheduledAt(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Ghi chú</label>
              <input value={planNote} onChange={e => setPlanNote(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Chào hàng sản phẩm mới..." />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowPlanForm(false)} className="flex-1 px-3 py-2 border rounded-lg text-sm text-gray-600">Huỷ</button>
              <button type="submit" disabled={saving} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? "..." : "Lên kế hoạch"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Section({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="px-3 py-2.5 border-b bg-gray-50 flex items-center gap-2">
        {icon}
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{title}</span>
        <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="px-3 py-2 divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <Sheet open onClose={onClose} title={<h3 className="text-base font-bold text-gray-800">{title}</h3>}>
      <div className="p-4">{children}</div>
    </Sheet>
  );
}

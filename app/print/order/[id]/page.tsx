import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDateTimeVN, formatCurrencyVN } from "@/lib/date";
import { PrintControls } from "./PrintControls";

export const dynamic = "force-dynamic";

function makeOrderCode(id: string) {
  return "#" + id.slice(0, 8).toUpperCase();
}

export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div className="p-8 text-sm text-red-600">Chưa đăng nhập</div>;
  }

  const { data: order } = await supabase
    .from("orders")
    .select(`
      id, org_id, status, total_qty_kg, total_amount, created_at, note,
      customers(id, name, phone, address),
      order_items(id, product_name, unit, qty, unit_price, subtotal)
    `)
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return <div className="p-8 text-sm text-red-600">Không tìm thấy đơn hàng</div>;
  }

  const { data: org } = await supabase
    .from("orgs")
    .select("name, address, tax_code, phone, email, logo_url")
    .eq("id", (order as any).org_id)
    .maybeSingle();

  const cust: any = (order as any).customers ?? {};
  const items: any[] = (order as any).order_items ?? [];
  const total = Number((order as any).total_amount ?? 0);

  return (
    <div className="bg-zinc-100 min-h-screen print:bg-white">
      <PrintControls />

      <div className="mx-auto my-6 print:my-0 max-w-[800px] bg-white shadow print:shadow-none p-8 print:p-6 text-[13px] text-zinc-900">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-4">
          <div className="flex items-start gap-3">
            {org?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt="logo" className="w-16 h-16 object-contain" />
            ) : null}
            <div>
              <div className="text-lg font-bold uppercase">{org?.name ?? "—"}</div>
              {org?.address && <div className="text-xs text-zinc-600">{org.address}</div>}
              <div className="text-xs text-zinc-600 space-x-2">
                {org?.phone && <span>ĐT: {org.phone}</span>}
                {org?.email && <span>· {org.email}</span>}
                {org?.tax_code && <span>· MST: {org.tax_code}</span>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold tracking-wide">HOÁ ĐƠN BÁN HÀNG</div>
            <div className="text-sm font-semibold text-zinc-700 mt-1">
              Số: {makeOrderCode((order as any).id)}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Ngày: {formatDateTimeVN((order as any).created_at)}
            </div>
          </div>
        </div>

        {/* Customer block */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-zinc-500 uppercase">Khách hàng</div>
            <div className="font-semibold">{cust.name ?? "—"}</div>
            {cust.phone && <div className="text-xs">ĐT: {cust.phone}</div>}
            {cust.address && <div className="text-xs">Địa chỉ: {cust.address}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500 uppercase">Thanh toán</div>
            <div className="font-semibold">Tổng: {formatCurrencyVN(total)} đ</div>
          </div>
        </div>

        {/* Items */}
        <table className="w-full mt-5 border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-100 border-y border-zinc-300">
              <th className="text-left py-2 px-2 w-10">STT</th>
              <th className="text-left py-2 px-2">Sản phẩm</th>
              <th className="text-center py-2 px-2 w-20">SL</th>
              <th className="text-center py-2 px-2 w-14">ĐVT</th>
              <th className="text-right py-2 px-2 w-28">Đơn giá</th>
              <th className="text-right py-2 px-2 w-32">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className="border-b border-zinc-200">
                <td className="py-2 px-2">{idx + 1}</td>
                <td className="py-2 px-2">{it.product_name}</td>
                <td className="py-2 px-2 text-center">{Number(it.qty)}</td>
                <td className="py-2 px-2 text-center">{it.unit ?? "kg"}</td>
                <td className="py-2 px-2 text-right">{formatCurrencyVN(Number(it.unit_price))}</td>
                <td className="py-2 px-2 text-right">{formatCurrencyVN(Number(it.subtotal))}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="py-3 text-center text-zinc-400">— Không có sản phẩm —</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-400">
              <td colSpan={5} className="py-2 px-2 text-right font-semibold">Tổng cộng</td>
              <td className="py-2 px-2 text-right font-bold text-base">{formatCurrencyVN(total)} đ</td>
            </tr>
          </tfoot>
        </table>

        {(order as any).note && (
          <div className="mt-4 text-sm">
            <span className="text-zinc-500">Ghi chú: </span>
            <span>{(order as any).note}</span>
          </div>
        )}

        {/* Signatures */}
        <div className="mt-12 grid grid-cols-2 gap-6 text-center text-sm">
          <div>
            <div className="font-semibold">Khách hàng</div>
            <div className="text-xs text-zinc-500">(Ký, ghi rõ họ tên)</div>
            <div className="h-20" />
          </div>
          <div>
            <div className="font-semibold">Người bán</div>
            <div className="text-xs text-zinc-500">(Ký, ghi rõ họ tên)</div>
            <div className="h-20" />
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-zinc-500 print:block">
          Cảm ơn quý khách. Hẹn gặp lại!
        </div>
      </div>
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { Bell, Search, ChevronRight } from "lucide-react";

const PAGE_META: Record<string, { title: string; desc: string }> = {
  "/dashboard":   { title: "Dashboard",    desc: "Tổng quan hoạt động kinh doanh" },
  "/orders":      { title: "Đơn hàng",     desc: "Quản lý đơn hàng khách hàng" },
  "/customers":   { title: "Khách hàng",   desc: "Danh sách và lịch sử giao dịch" },
  "/leads":       { title: "CRM / Leads",  desc: "Theo dõi cơ hội bán hàng" },
  "/payments":    { title: "Thu tiền",     desc: "Quản lý công nợ và thanh toán" },
  "/batches":     { title: "Sản xuất",     desc: "Lịch sử batch rang cà phê" },
  "/products":    { title: "Sản phẩm",     desc: "Danh mục sản phẩm" },
  "/inventory-in":{ title: "Nhập hàng",   desc: "Nhập kho nguyên liệu" },
  "/commissions": { title: "Hoa hồng",     desc: "Quản lý hoa hồng nhân viên" },
  "/checkins":    { title: "Check-in",     desc: "Lịch sử check-in khách hàng" },
  "/reports":     { title: "Báo cáo",      desc: "Thống kê và phân tích" },
  "/settings":    { title: "Cài đặt",      desc: "Cấu hình hệ thống" },
};

export function StickyTopbar() {
  const pathname = usePathname();
  const meta = PAGE_META[pathname] ?? { title: "Đức Phúc Coffee", desc: "" };

  return (
    <header
      className="sticky top-0 z-20 bg-white border-b border-gray-200 flex items-center justify-between px-5"
      style={{ height: 52 }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] text-gray-400">Đức Phúc</span>
        <ChevronRight className="h-3 w-3 text-gray-300" />
        <span className="text-[13px] font-bold text-gray-700">{meta.title}</span>
        {meta.desc && (
          <>
            <span className="text-gray-200 mx-1 hidden lg:block">·</span>
            <span className="text-[11px] text-gray-400 hidden lg:block">{meta.desc}</span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded border border-gray-200 text-gray-400 hover:border-gray-300 transition-colors text-[12px]">
          <Search className="h-3.5 w-3.5" />
          <span>Tìm kiếm...</span>
          <kbd className="text-[10px] bg-gray-100 px-1 rounded border border-gray-200 font-mono ml-4">⌘K</kbd>
        </button>

        <button className="relative p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-1 ring-white" />
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-gray-200 ml-1">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[11px] font-bold">
            HT
          </div>
          <span className="text-[12px] font-semibold text-gray-700 hidden sm:block">Huỳnh Tài</span>
        </div>
      </div>
    </header>
  );
}

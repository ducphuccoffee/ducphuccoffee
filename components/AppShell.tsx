"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  PackagePlus,
  Package,
  Users,
  UserCheck,
  ShoppingCart,
  Factory,
  CreditCard,
  Award,
  MapPin,
  BarChart2,
  Settings,
  Coffee,
  ChevronRight,
  Menu,
  X,
  PieChart,
  HeartHandshake,
  Footprints,
} from "lucide-react";

const NAV_GROUPS = [
  {
    group: "TỔNG QUAN",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    group: "BÁN HÀNG",
    items: [
      { href: "/orders",    label: "Đơn hàng",         icon: ShoppingCart },
      { href: "/payments",  label: "Thu tiền",          icon: CreditCard },
    ],
  },
  {
    group: "CRM",
    items: [
      { href: "/crm/dashboard",    label: "CRM Dashboard",  icon: PieChart },
      { href: "/crm/care",         label: "Customer Care",  icon: HeartHandshake },
      { href: "/crm/sfa",          label: "SFA",            icon: Footprints },
    ],
  },
  {
    group: "NHẬP HÀNG / SX",
    items: [
      { href: "/inventory-in", label: "Nhập nguyên liệu", icon: PackagePlus },
      { href: "/batches",      label: "Batch rang",        icon: Factory },
    ],
  },
  {
    group: "DANH MỤC",
    items: [
      { href: "/products",  label: "Sản phẩm",   icon: Package },
      { href: "/customers", label: "Khách hàng", icon: Users },
      { href: "/leads",     label: "Leads",      icon: UserCheck },
    ],
  },
  {
    group: "KHÁC",
    items: [
      { href: "/commissions", label: "Hoa hồng", icon: Award },
      { href: "/reports",     label: "Báo cáo",  icon: BarChart2 },
      { href: "/settings",    label: "Cài đặt",  icon: Settings },
    ],
  },
];

// ── Sidebar desktop ──────────────────────────────────────────────
function SidebarContent({ pathname, displayName, initials }: { pathname: string; displayName: string; initials: string }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4 shrink-0"
        style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow">
          <Coffee className="h-4 w-4 text-white" />
        </div>
        <div className="overflow-hidden leading-snug">
          <p className="text-white font-bold text-[13px] truncate">Đức Phúc Coffee</p>
          <p className="text-slate-500 text-[10px] truncate">Quản lý vận hành</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3">
        {NAV_GROUPS.map(({ group, items }) => (
          <div key={group}>
            <p className="px-2 mb-1 text-[10px] font-bold tracking-widest text-slate-600 uppercase">
              {group}
            </p>
            <ul className="space-y-0.5">
              {items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== "/" && pathname.startsWith(href));
                return (
                  <li key={href}>
                    <Link href={href}>
                      <div
                        className={[
                          "flex items-center gap-2.5 px-3 py-[9px] rounded-md text-[13px] font-medium transition-all",
                          active
                            ? "bg-blue-600 text-white"
                            : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{label}</span>
                        {active && (
                          <ChevronRight className="h-3 w-3 text-white/50 shrink-0" />
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="px-3 py-3 shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-white/[0.06] cursor-pointer transition-colors">
          <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            {initials}
          </div>
          <div className="overflow-hidden leading-snug flex-1">
            <p className="text-[12px] text-slate-300 font-semibold truncate">{displayName}</p>
            <p className="text-[10px] text-slate-600 truncate">Đã đăng nhập</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main AppShell ────────────────────────────────────────────────
export function AppShell({
  children,
  topbar,
  displayName = "Admin",
  initials = "AD",
}: {
  children: React.ReactNode;
  topbar?: React.ReactNode;
  displayName?: string;
  initials?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── Desktop sidebar (fixed) ────── */}
      <aside
        className="hidden md:flex flex-col fixed inset-y-0 left-0 z-40"
        style={{ width: 220, background: "#101828" }}
      >
        <SidebarContent pathname={pathname} displayName={displayName} initials={initials} />
      </aside>

      {/* ── Main content area ──────────── */}
      <div className="md:ml-[220px] min-h-screen bg-[#f0f2f5]">
        {/* Sticky topbar (desktop only) */}
        <div className="hidden md:block">{topbar}</div>

        {/* Mobile topbar */}
        <div
          className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-white border-b border-gray-200 px-4"
          style={{ height: 52 }}
        >
          <button
            type="button"
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-[14px] font-bold text-gray-800">Đức Phúc Coffee</p>
          <div className="w-9" />
        </div>

        {/* Page content */}
        <div className="p-4 md:p-6">
          {children}
        </div>
      </div>

      {/* ── Mobile drawer ──────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 top-0 h-full flex flex-col"
            style={{ width: 240, background: "#101828" }}
          >
            <div
              className="flex items-center justify-end px-3 py-3 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            >
              <button
                type="button"
                className="p-2 rounded-md text-slate-400 hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent pathname={pathname} displayName={displayName} initials={initials} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

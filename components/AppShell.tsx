"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutGrid,
  Package,
  Users,
  ShoppingCart,
  Flame,
  CreditCard,
  BarChart3,
  MapPin,
  BadgePercent,
  Settings,
  Warehouse,
  LogOut,
  X,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/Button";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/inventory-in", label: "Nhập nhân xanh", icon: Warehouse },
  { href: "/products", label: "Sản phẩm", icon: Package },
  { href: "/customers", label: "Khách hàng", icon: Users },
  { href: "/leads", label: "CRM / Leads", icon: Users },
  { href: "/orders", label: "Đơn hàng", icon: ShoppingCart },
  { href: "/batches", label: "Sản xuất", icon: Flame },
  { href: "/payments", label: "Thu tiền", icon: CreditCard },
  { href: "/commissions", label: "Hoa hồng", icon: BadgePercent },
  { href: "/checkins", label: "Check-in", icon: MapPin },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createBrowserSupabaseClient();

  async function logout() {
    // Server-side signOut to clear cookies used by middleware
    await fetch("/api/auth/logout", { method: "POST" });
    // Also clear local storage session (client)
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <div className="mb-4">
        <div className="text-sm font-semibold">Duc Phuc Coffee</div>
        <div className="text-xs text-zinc-500">Roastery • CRM • ERP mini</div>
      </div>

      <nav className="space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4">
        <Button
          variant="secondary"
          className="w-full justify-center gap-2"
          onClick={logout}
        >
          <LogOut size={16} />
          Đăng xuất
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
          >
            <Menu size={16} />
            Menu
          </button>

          <div className="text-sm font-semibold">Duc Phuc Coffee</div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          {/* panel */}
          <div className="absolute left-0 top-0 h-full w-[86%] max-w-[340px] bg-zinc-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Menu</div>
              <button
                type="button"
                className="rounded-xl border bg-white p-2"
                onClick={() => setMobileOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      {/* Desktop layout */}
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="hidden w-64 shrink-0 md:block">
          <Sidebar />
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
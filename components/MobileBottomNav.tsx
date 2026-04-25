"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, Sun, Plus, Menu } from "lucide-react";

type Props = {
  onOpenMenu: () => void;
  onOpenQuickCreate: () => void;
};

const TABS = [
  { href: "/dashboard",  label: "Trang chủ", icon: Home },
  { href: "/orders",     label: "Đơn hàng",  icon: ShoppingCart },
  { href: "/crm/today",  label: "Hôm nay",   icon: Sun },
];

export function MobileBottomNav({ onOpenMenu, onOpenQuickCreate }: Props) {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5 h-[60px]">
        {TABS.slice(0, 2).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? "text-blue-600" : "text-gray-500 active:text-gray-700"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
              <span className={`text-[10px] font-medium ${active ? "font-semibold" : ""}`}>{label}</span>
            </Link>
          );
        })}

        {/* Center FAB — quick create */}
        <button
          type="button"
          onClick={onOpenQuickCreate}
          className="flex items-center justify-center"
          aria-label="Tạo nhanh"
        >
          <span className="w-12 h-12 -mt-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/40 active:scale-95 transition-transform">
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </span>
        </button>

        {TABS.slice(2).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? "text-blue-600" : "text-gray-500 active:text-gray-700"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
              <span className={`text-[10px] font-medium ${active ? "font-semibold" : ""}`}>{label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center gap-0.5 text-gray-500 active:text-gray-700"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </div>
    </nav>
  );
}

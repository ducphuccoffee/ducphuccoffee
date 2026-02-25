"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
        active ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // đóng drawer khi chuyển trang (mobile)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const nav = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/inventory-in", label: "Nhập hàng nhanh" },
      { href: "/products", label: "Sản phẩm" },
      { href: "/customers", label: "Khách hàng" },
      { href: "/leads", label: "CRM / Leads" },
      { href: "/orders", label: "Đơn hàng" },
      { href: "/batches", label: "Sản xuất" },
      { href: "/payments", label: "Thu tiền" },
      { href: "/commissions", label: "Hoa hồng" },
      { href: "/checkins", label: "Check-in" },
      { href: "/reports", label: "Báo cáo" },
      { href: "/settings", label: "Cài đặt" },
    ],
    []
  );

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Top bar (mobile) */}
      <div className="sticky top-0 z-40 border-b bg-white md:hidden">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm"
            onClick={() => setOpen(true)}
            aria-label="Mở menu"
          >
            ☰
          </button>
          <div className="text-sm font-semibold">Duc Phuc Coffee</div>
          <div className="w-[44px]" /> {/* spacer */}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl gap-4 px-3 py-3 md:px-6 md:py-6">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="rounded-2xl border bg-white p-3">
            <div className="px-2 py-2 text-sm font-semibold">Duc Phuc Coffee</div>
            <div className="mt-2 space-y-1">
              {nav.map((n) => (
                <NavLink
                  key={n.href}
                  href={n.href}
                  label={n.label}
                  active={pathname === n.href}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Drawer (mobile) */}
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[84%] max-w-xs bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-3 py-3">
              <div className="text-sm font-semibold">Menu</div>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="p-3">
              <div className="space-y-1">
                {nav.map((n) => (
                  <NavLink
                    key={n.href}
                    href={n.href}
                    label={n.label}
                    active={pathname === n.href}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
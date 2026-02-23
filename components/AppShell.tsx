"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Package, Users, ShoppingCart, Flame, CreditCard, BarChart3, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/Button";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/products", label: "Sản phẩm", icon: Package },
  { href: "/customers", label: "Khách hàng", icon: Users },
  { href: "/orders", label: "Đơn hàng", icon: ShoppingCart },
  { href: "/batches", label: "Batch rang", icon: Flame },
  { href: "/payments", label: "Thu tiền", icon: CreditCard },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = createBrowserSupabaseClient();

  async function logout() {
  // Server-side signOut to clear cookies used by middleware
  await fetch("/api/auth/logout", { method: "POST" });
  // Also clear local storage session (client)
  await supabase.auth.signOut();
  window.location.href = "/login";
}

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="hidden w-64 shrink-0 md:block">
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
              <Button variant="secondary" className="w-full justify-center gap-2" onClick={logout}>
                <LogOut size={16} />
                Đăng xuất
              </Button>
            </div>
          </div>
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

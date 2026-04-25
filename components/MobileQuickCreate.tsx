"use client";

import Link from "next/link";
import {
  ShoppingCart, Users, UserPlus, Sun, PackagePlus, Factory, X,
} from "lucide-react";

const ACTIONS = [
  { href: "/orders",            label: "Tạo đơn hàng",     icon: ShoppingCart, color: "bg-blue-500" },
  { href: "/crm/pipeline",      label: "Tạo lead",          icon: UserPlus,     color: "bg-purple-500" },
  { href: "/crm/today",         label: "Check-in viếng",    icon: Sun,          color: "bg-amber-500" },
  { href: "/customers",         label: "Thêm khách hàng",   icon: Users,        color: "bg-pink-500" },
  { href: "/inventory-in",      label: "Nhập nguyên liệu",  icon: PackagePlus,  color: "bg-emerald-500" },
  { href: "/batches",           label: "Tạo batch rang",    icon: Factory,      color: "bg-orange-500" },
];

export function MobileQuickCreate({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="md:hidden fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute bottom-0 inset-x-0 bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-800">Tạo nhanh</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          {ACTIONS.map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl active:bg-gray-100 transition-colors"
            >
              <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center shadow-sm`}>
                <Icon className="h-5 w-5 text-white" strokeWidth={2.2} />
              </div>
              <span className="text-[11px] font-medium text-gray-700 text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

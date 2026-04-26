"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

type Ctx = {
  push: (kind: ToastKind, message: string) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

let externalPush: ((kind: ToastKind, msg: string) => void) | null = null;

/** Imperative API usable outside React tree:
 *   import { toast } from "@/components/ui/Toast";
 *   toast.success("Lưu thành công");
 *   toast.error("Lỗi mạng");
 */
export const toast = {
  success: (msg: string) => externalPush?.("success", msg),
  error:   (msg: string) => externalPush?.("error",   msg),
  info:    (msg: string) => externalPush?.("info",    msg),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setItems(prev => [...prev, { id, kind, message }]);
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // Wire up external imperative API
  useEffect(() => {
    externalPush = (kind, msg) => push(kind, msg);
    return () => { externalPush = null; };
  }, [push]);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div
        className="fixed inset-x-0 z-[2000] pointer-events-none flex flex-col items-center gap-2 px-4"
        style={{
          // Mobile: above bottom nav. Desktop: top-right.
          bottom: "calc(72px + env(safe-area-inset-bottom))",
          top: "auto",
        }}
      >
        <div className="hidden md:flex md:fixed md:top-4 md:right-4 md:flex-col md:gap-2 md:items-end md:max-w-sm">
          {items.map(t => <ToastItem key={t.id} item={t} onClose={() => setItems(p => p.filter(x => x.id !== t.id))} />)}
        </div>
        <div className="md:hidden flex flex-col gap-2 w-full max-w-sm">
          {items.map(t => <ToastItem key={t.id} item={t} onClose={() => setItems(p => p.filter(x => x.id !== t.id))} />)}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastItem({ item, onClose }: { item: Toast; onClose: () => void }) {
  const cfg = {
    success: { icon: CheckCircle2, bg: "bg-emerald-600", text: "text-white" },
    error:   { icon: AlertCircle,  bg: "bg-rose-600",    text: "text-white" },
    info:    { icon: Info,         bg: "bg-slate-800",   text: "text-white" },
  }[item.kind];
  const Icon = cfg.icon;
  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-2.5 px-3.5 py-3 rounded-2xl shadow-xl ${cfg.bg} ${cfg.text} w-full md:min-w-[260px] animate-in slide-in-from-bottom md:slide-in-from-right`}
    >
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <p className="text-sm font-medium flex-1 leading-snug">{item.message}</p>
      <button
        onClick={onClose}
        className="opacity-70 hover:opacity-100 active:opacity-50 -mr-1 -mt-1 p-1 shrink-0"
        aria-label="Đóng"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

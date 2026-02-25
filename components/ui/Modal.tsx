"use client";

import { ReactNode, useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden"; // khóa scroll nền
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/30 md:bg-black/30"
        onClick={onClose}
      />

      {/* panel */}
      <div
        className="
          absolute inset-0 bg-white
          md:inset-auto md:left-1/2 md:top-1/2
          md:w-[min(640px,calc(100vw-32px))]
          md:-translate-x-1/2 md:-translate-y-1/2
          md:rounded-2xl md:shadow-xl
          flex flex-col
        "
      >
        {/* header */}
        <div className="flex items-center justify-between border-b px-4 py-3 md:px-5 md:py-4">
          <div className="text-base font-semibold">{title}</div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* body (scrollable on mobile) */}
        <div className="flex-1 overflow-auto px-4 py-4 md:px-5 md:py-4">
          {children}
        </div>

        {/* footer */}
        {footer ? (
          <div className="border-t px-4 py-3 md:px-5 md:py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
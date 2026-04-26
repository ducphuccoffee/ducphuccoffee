"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Optional sticky footer (action buttons) — only rendered when provided. */
  footer?: React.ReactNode;
  /** Maximum height of the sheet on mobile. Default 92vh. */
  maxHeightMobile?: string;
  /** Width on desktop. Default max-w-lg. Pass tailwind class. */
  desktopWidth?: string;
  children: React.ReactNode;
};

/**
 * Mobile-first bottom-sheet. On desktop renders as a centered modal.
 * - z-[1000] so it sits above maps (Leaflet ~800)
 * - Drag handle (visual only on mobile)
 * - ESC + backdrop close
 * - Locks body scroll while open
 * - Sticky header & optional sticky footer for long forms
 * - Safe-area padding on bottom
 */
export function Sheet({
  open, onClose, title, footer, children,
  maxHeightMobile = "92vh",
  desktopWidth = "sm:max-w-lg",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Esc to close + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/50 sm:backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-white w-full ${desktopWidth} rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom sm:fade-in sm:zoom-in-95`}
        style={{ maxHeight: `min(${maxHeightMobile}, calc(100vh - env(safe-area-inset-top)))` }}
      >
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        {title && (
          <div className="px-4 sm:px-5 pt-2 sm:pt-4 pb-3 border-b border-gray-100 shrink-0 flex items-start gap-3">
            <div className="flex-1 min-w-0">{title}</div>
            <button
              onClick={onClose}
              className="-mr-1 -mt-1 w-8 h-8 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center text-2xl shrink-0"
              aria-label="Đóng"
            >
              ×
            </button>
          </div>
        )}

        {/* Scrollable body */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{
            paddingBottom: footer ? 0 : "calc(env(safe-area-inset-bottom) + 16px)",
          }}
        >
          {children}
        </div>

        {/* Sticky footer */}
        {footer && (
          <div
            className="border-t border-gray-100 bg-white shrink-0 px-4 py-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

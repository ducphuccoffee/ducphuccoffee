"use client";

export function PrintControls() {
  return (
    <div className="print:hidden sticky top-0 z-10 bg-white border-b border-zinc-200 px-4 py-2 flex items-center gap-2">
      <button
        onClick={() => window.print()}
        className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700"
      >
        🖨 In hoá đơn
      </button>
      <button
        onClick={() => window.close()}
        className="px-3 py-1.5 rounded-lg text-sm border border-zinc-300 hover:bg-zinc-50"
      >
        Đóng
      </button>
      <span className="text-xs text-zinc-400 ml-2">Tip: Bấm Ctrl+P để in / lưu PDF</span>
    </div>
  );
}

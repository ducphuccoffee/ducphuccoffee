"use client";

/**
 * Lightweight skeleton primitives. All accept className overrides for one-off shapes.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-100 ${className}`} />;
}

/** N stacked rounded rows — typical list skeleton. */
export function SkeletonList({ rows = 4, rowClass = "h-16" }: { rows?: number; rowClass?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`w-full rounded-2xl ${rowClass}`} />
      ))}
    </div>
  );
}

/** Card-shape skeleton used in dashboards (icon + 2 lines). */
export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3.5 flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </div>
  );
}

/** Grid of N stat cards. */
export function SkeletonStatGrid({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {Array.from({ length: n }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

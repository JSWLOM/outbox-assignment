export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-label="Loading" className="divide-y divide-neutral-100">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="h-3 w-28 animate-pulse rounded bg-neutral-100" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-neutral-100" />
          <div className="h-3 flex-1 animate-pulse rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  );
}

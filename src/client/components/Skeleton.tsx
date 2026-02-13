interface SkeletonLineProps {
  width?: string;
  height?: string;
}

export function SkeletonLine({ width = 'w-full', height = 'h-4' }: SkeletonLineProps) {
  return (
    <div className={`animate-pulse bg-neutral-200 dark:bg-neutral-700 rounded ${width} ${height}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded p-6">
      <SkeletonLine width="w-1/3" height="h-5" />
      <div className="mt-3">
        <SkeletonLine width="w-full" />
      </div>
      <div className="mt-2">
        <SkeletonLine width="w-2/3" />
      </div>
      <div className="mt-2">
        <SkeletonLine width="w-1/2" />
      </div>
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
}

export function SkeletonTable({ rows = 5, cols = 4 }: SkeletonTableProps) {
  return (
    <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded overflow-hidden">
      {/* Header row */}
      <div className="flex gap-4 p-4 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="flex-1">
            <SkeletonLine height="h-4" width={c === 0 ? 'w-2/3' : 'w-1/2'} />
          </div>
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex gap-4 p-4 border-b border-neutral-100 dark:border-neutral-700 last:border-b-0"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="flex-1">
              <SkeletonLine height="h-3" width={c === 0 ? 'w-3/4' : 'w-1/2'} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded p-6"
          >
            <SkeletonLine width="w-1/2" height="h-3" />
            <div className="mt-3">
              <SkeletonLine width="w-1/3" height="h-8" />
            </div>
          </div>
        ))}
      </div>
      {/* Pipeline card */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded p-6">
        <SkeletonLine width="w-1/4" height="h-5" />
        <div className="mt-4 flex gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1">
              <SkeletonLine height="h-20" />
            </div>
          ))}
        </div>
      </div>
      {/* 2 medium cards side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded p-6"
          >
            <SkeletonLine width="w-1/3" height="h-5" />
            <div className="mt-4 space-y-3">
              <SkeletonLine width="w-full" />
              <SkeletonLine width="w-3/4" />
              <SkeletonLine width="w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="space-y-6">
      {/* Header area */}
      <div>
        <SkeletonLine width="w-1/3" height="h-7" />
        <div className="mt-2">
          <SkeletonLine width="w-1/4" height="h-4" />
        </div>
      </div>
      {/* 3 card sections */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded p-6"
        >
          <SkeletonLine width="w-1/4" height="h-5" />
          <div className="mt-4 space-y-3">
            <SkeletonLine width="w-full" />
            <SkeletonLine width="w-5/6" />
            <SkeletonLine width="w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

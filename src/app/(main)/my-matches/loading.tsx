import { Skeleton } from '@/components/ui/skeleton';

export default function MyMatchesLoading() {
  return (
    <div>
      {/* TopBar skeleton */}
      <div className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <Skeleton className="w-10 h-5" />
          <Skeleton className="w-16 h-5" />
          <Skeleton className="w-10 h-5" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="px-4 pt-4">
        <div className="flex gap-2 mb-4">
          <Skeleton className="w-24 h-9 rounded-xl" />
          <Skeleton className="w-24 h-9 rounded-xl" />
        </div>

        {/* Match cards skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface rounded-2xl border border-border p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="w-32 h-5" />
                <Skeleton className="w-16 h-5 rounded-full" />
              </div>
              <Skeleton className="w-48 h-4" />
              <Skeleton className="w-28 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

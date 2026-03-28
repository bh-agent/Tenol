import { Skeleton } from '@/components/ui/skeleton';

export default function ClubsLoading() {
  return (
    <div>
      {/* TopBar skeleton */}
      <div className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <Skeleton className="w-10 h-5" />
          <Skeleton className="w-16 h-5" />
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </div>
      {/* Club cards skeleton */}
      <div className="px-4 py-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-surface rounded-2xl border border-border p-4"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="w-12 h-12 rounded-2xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-28 h-5" />
                  <Skeleton className="w-12 h-5 rounded-full" />
                </div>
                <Skeleton className="w-20 h-4" />
                <Skeleton className="w-full h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

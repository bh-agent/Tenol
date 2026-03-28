import { Skeleton } from '@/components/ui/skeleton';

export default function ClubStatsLoading() {
  return (
    <div>
      {/* TopBar skeleton */}
      <div className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="w-12 h-5" />
          <div className="w-6" />
        </div>
      </div>

      <div className="px-4 py-5 space-y-6">
        {/* Section header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="w-16 h-5" />
            <Skeleton className="w-28 h-3" />
          </div>
        </div>

        {/* Stats grid skeleton */}
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>

        {/* Win rate chart skeleton */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4" />
            <Skeleton className="w-20 h-5" />
          </div>
          <Skeleton className="w-full h-32 rounded-xl" />
        </div>

        {/* Leaderboard skeleton */}
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="w-20 h-5" />
            <Skeleton className="w-24 h-3" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border">
              <Skeleton className="w-6 h-6 rounded-full" />
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="w-20 h-4" />
                <Skeleton className="w-12 h-3" />
              </div>
              <Skeleton className="w-12 h-5" />
            </div>
          ))}
        </div>

        {/* Recent games skeleton */}
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="w-20 h-5" />
            <Skeleton className="w-16 h-3" />
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface rounded-2xl border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-12 h-5 rounded-full" />
              </div>
              <Skeleton className="w-32 h-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

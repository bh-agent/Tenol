import { Skeleton } from '@/components/ui/skeleton';

export default function MatchDetailLoading() {
  return (
    <div>
      {/* TopBar skeleton */}
      <div className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="w-28 h-5" />
          <Skeleton className="w-10 h-5" />
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Match info card */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="w-16 h-6 rounded-full" />
            <Skeleton className="w-12 h-6 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="w-48 h-4" />
            <Skeleton className="w-36 h-4" />
            <Skeleton className="w-24 h-4" />
          </div>
        </div>

        {/* Quick links skeleton */}
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>

        {/* Participants card */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <Skeleton className="w-24 h-5" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="w-24 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

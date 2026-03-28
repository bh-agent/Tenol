import { Skeleton } from '@/components/ui/skeleton';

export default function ClubDetailLoading() {
  return (
    <div>
      {/* TopBar skeleton */}
      <div className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="w-24 h-5" />
          <Skeleton className="w-6 h-6 rounded-full" />
        </div>
      </div>

      {/* Club info card skeleton */}
      <div className="px-4 pt-4 pb-2">
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-14 h-14 rounded-2xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="w-32 h-6" />
              <div className="flex items-center gap-2">
                <Skeleton className="w-14 h-5 rounded-full" />
                <Skeleton className="w-12 h-4" />
              </div>
            </div>
          </div>
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-40 h-4" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="px-4 pt-4">
        <div className="flex gap-2 mb-4">
          <Skeleton className="w-20 h-9 rounded-xl" />
          <Skeleton className="w-20 h-9 rounded-xl" />
          <Skeleton className="w-20 h-9 rounded-xl" />
        </div>
        {/* Tab content skeleton */}
        <div className="space-y-3">
          <Skeleton className="w-full h-20 rounded-2xl" />
          <Skeleton className="w-full h-20 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

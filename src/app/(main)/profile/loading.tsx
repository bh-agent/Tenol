import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <div>
      {/* TopBar skeleton */}
      <div className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <Skeleton className="w-10 h-5" />
          <Skeleton className="w-12 h-5" />
          <Skeleton className="w-10 h-5" />
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Profile header skeleton */}
        <div className="flex flex-col items-center py-4 space-y-3">
          <Skeleton className="w-20 h-20 rounded-full" />
          <Skeleton className="w-24 h-6" />
          <Skeleton className="w-16 h-5 rounded-full" />
        </div>

        {/* Clubs card skeleton */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="w-24 h-5" />
            <Skeleton className="w-8 h-4" />
          </div>
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-1">
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-16 h-3" />
              </div>
              <Skeleton className="w-12 h-5 rounded-full" />
            </div>
          ))}
        </div>

        {/* Sign out button skeleton */}
        <Skeleton className="w-full h-11 rounded-xl" />
      </div>
    </div>
  );
}

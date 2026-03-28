import { Skeleton } from '@/components/ui/skeleton';

export default function UserProfileLoading() {
  return (
    <div>
      {/* TopBar skeleton */}
      <div className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="w-20 h-5" />
          <div className="w-6" />
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Profile header skeleton */}
        <div className="flex flex-col items-center space-y-3">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="flex items-center gap-3">
            <Skeleton className="w-24 h-6" />
            <Skeleton className="w-16 h-8 rounded-xl" />
          </div>
          <Skeleton className="w-48 h-4" />
          <div className="flex gap-2">
            <Skeleton className="w-16 h-5 rounded-full" />
            <Skeleton className="w-20 h-5 rounded-full" />
          </div>
        </div>

        {/* Follow stats bar skeleton */}
        <div className="flex items-center justify-center gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center space-y-1">
              <Skeleton className="w-8 h-6 mx-auto" />
              <Skeleton className="w-6 h-3 mx-auto" />
            </div>
          ))}
        </div>

        {/* Match stats skeleton */}
        <div className="flex items-center justify-center gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="text-center space-y-1">
              <Skeleton className="w-10 h-6 mx-auto" />
              <Skeleton className="w-6 h-3 mx-auto" />
            </div>
          ))}
        </div>

        {/* Clubs card skeleton */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <Skeleton className="w-24 h-5" />
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-1">
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-16 h-3" />
              </div>
              <Skeleton className="w-4 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

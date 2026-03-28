import { Skeleton } from '@/components/ui/skeleton';

export default function FeedLoading() {
  return (
    <div>
      {/* TopBar skeleton */}
      <div className="sticky top-0 z-30 glass border-b border-border/50 safe-top">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <div className="w-10" />
          <Skeleton className="h-5 w-12" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>

      {/* Tab skeleton */}
      <div className="flex border-b border-border">
        <div className="flex-1 py-3 flex justify-center">
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="flex-1 py-3 flex justify-center">
          <Skeleton className="h-4 w-8" />
        </div>
      </div>

      {/* Post card skeletons */}
      <div className="space-y-0">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-[#141414] border-b border-[#2A2A2A]">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            {/* Image placeholder */}
            <Skeleton className="w-full aspect-[4/5]" />
            {/* Action bar */}
            <div className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
            {/* Caption lines */}
            <div className="px-4 pb-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

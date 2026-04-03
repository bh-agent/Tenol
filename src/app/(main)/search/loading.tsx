import { Skeleton } from '@/components/ui/skeleton';

export default function SearchLoading() {
  return (
    <div className="px-4 pt-4">
      {/* TopBar skeleton */}
      <Skeleton className="h-14 w-full mb-4" />

      {/* Search input skeleton */}
      <Skeleton className="h-11 w-full rounded-xl mb-3" />

      {/* Filter chips skeleton */}
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>

      {/* Result cards skeleton */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

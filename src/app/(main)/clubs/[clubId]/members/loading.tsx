import { Skeleton } from '@/components/ui/skeleton';

export default function MembersLoading() {
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <Skeleton className="w-10 h-5" />
          <Skeleton className="w-20 h-5" />
          <Skeleton className="w-10 h-5" />
        </div>
      </div>
      <div className="px-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="w-24 h-4" />
              <Skeleton className="w-16 h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

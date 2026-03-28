import { Skeleton } from '@/components/ui/skeleton';

export default function RecruitLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-14 bg-surface border-b border-border" />
      <div className="px-4 pt-4 pb-2 space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="px-4 pt-2 pb-3">
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
      <div className="flex border-b border-border px-4">
        <Skeleton className="flex-1 h-10" />
        <Skeleton className="flex-1 h-10" />
        <Skeleton className="flex-1 h-10" />
      </div>
      <div className="px-4 pt-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

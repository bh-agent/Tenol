import { Skeleton } from '@/components/ui/skeleton';

export default function NewMatchLoading() {
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
          <Skeleton className="w-10 h-5" />
          <Skeleton className="w-24 h-5" />
          <Skeleton className="w-10 h-5" />
        </div>
      </div>
      <div className="px-4 space-y-4">
        <Skeleton className="w-full h-12 rounded-xl" />
        <Skeleton className="w-full h-12 rounded-xl" />
        <Skeleton className="w-full h-12 rounded-xl" />
        <Skeleton className="w-full h-12 rounded-xl" />
      </div>
    </div>
  );
}

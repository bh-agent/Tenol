import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function MatchNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center mb-5">
        <SearchX className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">
        경기를 찾을 수 없어요
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        이 경기는 존재하지 않거나 삭제되었어요
      </p>
      <div className="flex flex-col gap-3 w-full max-w-[240px]">
        <Link href="/clubs">
          <Button fullWidth>클럽 목록으로 돌아가기</Button>
        </Link>
        <Link href="/clubs/explore">
          <Button variant="outline" fullWidth>클럽 탐색하기</Button>
        </Link>
      </div>
    </div>
  );
}

import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ClubNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center mb-5">
        <SearchX className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">
        클럽을 찾을 수 없어요
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        요청하신 클럽이 존재하지 않거나 삭제되었습니다.
      </p>
      <Link href="/clubs">
        <Button>클럽 목록으로 돌아가기</Button>
      </Link>
    </div>
  );
}

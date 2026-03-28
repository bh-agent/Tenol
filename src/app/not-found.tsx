import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-background">
      <div className="w-20 h-20 rounded-full bg-surface-elevated flex items-center justify-center mb-5">
        <SearchX className="w-10 h-10 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        페이지를 찾을 수 없어요
      </h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-xs">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <Link href="/clubs">
        <Button size="lg">홈으로 돌아가기</Button>
      </Link>
    </div>
  );
}

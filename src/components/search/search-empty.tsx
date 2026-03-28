import { SearchX } from 'lucide-react';

interface SearchEmptyProps {
  query?: string;
  message?: string;
  description?: string;
}

export function SearchEmpty({
  query,
  message,
  description,
}: SearchEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center mb-4">
        <SearchX className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {message || '검색 결과가 없어요'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {description || (query
          ? `"${query}"에 대한 결과를 찾을 수 없습니다. 다른 검색어를 시도해보세요.`
          : '조건에 맞는 결과가 없습니다. 필터를 변경해보세요.'
        )}
      </p>
    </div>
  );
}

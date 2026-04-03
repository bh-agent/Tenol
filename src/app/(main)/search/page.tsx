import { TopBar } from '@/components/layout/top-bar';
import { SearchContent } from '@/components/search/search-content';

export default function SearchPage() {
  return (
    <>
      <TopBar title="검색" />
      <SearchContent />
    </>
  );
}

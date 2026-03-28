import { BottomNav } from '@/components/layout/bottom-nav';
import { ScrollTopButton } from '@/components/ui/scroll-top-button';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto w-full">
      <main className="flex-1 pb-28">
        {children}
      </main>
      <ScrollTopButton />
      <BottomNav />
    </div>
  );
}

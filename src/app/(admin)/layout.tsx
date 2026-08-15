import { ScrollTopButton } from '@/components/ui/scroll-top-button';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh max-w-4xl mx-auto w-full">
      <main className="flex-1 pb-8">
        {children}
      </main>
      <ScrollTopButton />
    </div>
  );
}

'use client';

import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ScrollTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="맨 위로 이동"
      className={`
        fixed bottom-24 right-4 z-40
        w-10 h-10 rounded-full
        bg-surface-elevated/80 border border-border
        flex items-center justify-center
        backdrop-blur-sm
        transition-all duration-300 ease-out
        hover:bg-surface-hover hover:border-primary/30
        active:scale-90 cursor-pointer
        ${visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
        }
      `}
    >
      <ArrowUp className="w-4.5 h-4.5 text-muted-foreground" />
    </button>
  );
}

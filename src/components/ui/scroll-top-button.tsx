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
        hide-on-keyboard fixed bottom-24 left-1/2 -translate-x-1/2 z-20
        h-8 px-4 rounded-full
        bg-surface-elevated/90 border border-border
        flex items-center justify-center gap-1.5
        backdrop-blur-sm shadow-sm
        transition-all duration-300 ease-out
        hover:bg-surface-hover hover:border-primary/30
        active:scale-95 cursor-pointer
        ${visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
        }
      `}
    >
      <ArrowUp className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground font-medium">맨 위로</span>
    </button>
  );
}

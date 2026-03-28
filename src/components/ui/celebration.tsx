'use client';

import { CheckCircle } from 'lucide-react';
import { useEffect } from 'react';

interface CelebrationProps {
  show: boolean;
  title: string;
  description?: string;
  onComplete: () => void;
}

export function Celebration({ show, title, description, onComplete }: CelebrationProps) {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
      <div className="flex flex-col items-center gap-4 px-8 text-center">
        <div className="animate-scale-in">
          <CheckCircle className="w-20 h-20 text-primary" strokeWidth={1.5} />
        </div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

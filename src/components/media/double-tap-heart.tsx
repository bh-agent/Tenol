'use client';

import { Heart } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';

interface DoubleTapHeartProps {
  children: ReactNode;
  onDoubleTap: () => void;
  disabled?: boolean;
}

export function DoubleTapHeart({ children, onDoubleTap, disabled }: DoubleTapHeartProps) {
  const [showHeart, setShowHeart] = useState(false);
  const lastTapRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = useCallback(() => {
    if (disabled) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    lastTapRef.current = now;

    if (timeSinceLastTap < 300) {
      // Double tap detected
      if (timerRef.current) clearTimeout(timerRef.current);

      onDoubleTap();
      setShowHeart(true);

      timerRef.current = setTimeout(() => {
        setShowHeart(false);
      }, 1000);
    }
  }, [onDoubleTap, disabled]);

  return (
    <div className="relative" onClick={handleTap}>
      {children}

      {/* Heart overlay animation */}
      {showHeart && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <Heart
            size={80}
            className="fill-white text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] animate-double-tap-heart"
            strokeWidth={0}
          />
        </div>
      )}
    </div>
  );
}

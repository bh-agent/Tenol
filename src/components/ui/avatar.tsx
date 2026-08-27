'use client';

import { cn } from '@/lib/utils/cn';
import Image from 'next/image';
import { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallback?: string;
  active?: boolean;
}

const sizePx = { sm: 32, md: 40, lg: 56, xl: 80 } as const;
const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-lg',
};

const ringClasses = {
  sm: 'ring-2 ring-offset-1',
  md: 'ring-2 ring-offset-2',
  lg: 'ring-[3px] ring-offset-2',
  xl: 'ring-[3px] ring-offset-3',
};

export function Avatar({
  src,
  alt = '',
  size = 'md',
  className,
  fallback,
  active,
}: AvatarProps) {
  const [loaded, setLoaded] = useState(false);
  const initial = fallback?.[0]?.toUpperCase() || alt?.[0]?.toUpperCase() || '?';

  const activeRing = active
    ? cn(ringClasses[size], 'ring-primary ring-offset-background')
    : '';

  if (src) {
    return (
      <div
        className={cn(
          'relative rounded-full overflow-hidden flex-shrink-0',
          'bg-surface-elevated',
          sizeClasses[size],
          activeRing,
          className
        )}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={`${sizePx[size]}px`}
          className={cn(
            'object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          onLoad={() => setLoaded(true)}
        />
        {/* Fallback shown while image loads */}
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary-dark/20 text-primary font-semibold">
            {initial}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex-shrink-0 flex items-center justify-center font-bold',
        'bg-gradient-to-br from-primary/30 to-primary-dark/40 text-primary-light',
        sizeClasses[size],
        activeRing,
        className
      )}
    >
      {initial}
    </div>
  );
}

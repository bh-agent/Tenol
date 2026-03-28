'use client';

import { cn } from '@/lib/utils/cn';
import Image from 'next/image';
import { useState } from 'react';

interface ClubAvatarProps {
  logoUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: { box: 'w-10 h-10 rounded-xl', text: 'text-sm', icon: 40 },
  md: { box: 'w-13 h-13 rounded-2xl', text: 'text-lg', icon: 52 },
  lg: { box: 'w-16 h-16 rounded-2xl', text: 'text-2xl', icon: 64 },
  xl: { box: 'w-20 h-20 rounded-2xl', text: 'text-3xl', icon: 80 },
};

export function ClubAvatar({ logoUrl, name, size = 'md', className }: ClubAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const s = sizeMap[size];

  if (logoUrl && !imgError) {
    return (
      <div className={cn(s.box, 'relative overflow-hidden flex-shrink-0 glow-primary-sm', className)}>
        <Image
          src={logoUrl}
          alt={name}
          fill
          className="object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        s.box,
        'bg-gradient-to-br from-primary/20 to-primary-dark/30 flex items-center justify-center flex-shrink-0 glow-primary-sm',
        className
      )}
    >
      <span className={cn('text-gradient font-bold', s.text)}>{name?.[0]}</span>
    </div>
  );
}

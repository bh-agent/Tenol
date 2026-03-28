import { cn } from '@/lib/utils/cn';
import { type HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'outline';
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        'border transition-colors duration-200',
        {
          'bg-muted text-muted-foreground border-border':
            variant === 'default',
          'bg-primary/10 text-primary border-primary/20':
            variant === 'primary',
          'bg-success/10 text-success border-success/20':
            variant === 'success',
          'bg-warning/10 text-warning border-warning/20':
            variant === 'warning',
          'bg-destructive/10 text-destructive border-destructive/20':
            variant === 'destructive',
          'border-border text-foreground bg-transparent':
            variant === 'outline',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

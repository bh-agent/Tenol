import { cn } from '@/lib/utils/cn';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      fullWidth,
      loading,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          // Base
          'relative inline-flex items-center justify-center font-medium rounded-xl overflow-hidden min-w-0',
          'transition-all duration-200 ease-out',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:opacity-40 disabled:pointer-events-none',
          'active:scale-[0.97] cursor-pointer',
          // Variants
          {
            // Primary: green with glow
            'bg-primary text-black font-semibold hover:bg-primary-light hover:shadow-[0_0_24px_rgba(0,230,118,0.25)] active:bg-primary-dark':
              variant === 'primary',
            // Secondary: elevated surface
            'bg-surface-elevated text-foreground border border-border hover:bg-surface-hover hover:border-primary/20':
              variant === 'secondary',
            // Outline: transparent with border
            'border border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-primary-dim':
              variant === 'outline',
            // Ghost: no border, subtle hover
            'bg-transparent text-muted-foreground hover:text-foreground hover:bg-surface-elevated':
              variant === 'ghost',
            // Destructive: red
            'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 hover:border-destructive/40':
              variant === 'destructive',
          },
          // Sizes
          {
            'h-9 px-3.5 text-sm gap-1.5': size === 'sm',
            'h-11 px-5 text-base gap-2': size === 'md',
            'h-13 px-6 text-lg gap-2.5': size === 'lg',
          },
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && (
          <Loader2 className="w-4 h-4 animate-spin absolute" />
        )}
        <span className={cn('inline-flex items-center gap-2 min-w-0', loading && 'invisible')}>
          {children}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';
export { Button, type ButtonProps };

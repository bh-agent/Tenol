import { cn } from '@/lib/utils/cn';

interface KbdProps {
  children: React.ReactNode;
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center',
        'min-w-[1.5rem] h-6 px-1.5',
        'text-xs font-mono font-medium',
        'text-muted-foreground bg-surface-elevated',
        'border border-border rounded-md',
        'shadow-[0_1px_0_1px_rgba(0,0,0,0.3)]',
        className
      )}
    >
      {children}
    </kbd>
  );
}

interface ShortcutRowProps {
  keys: string[];
  description: string;
}

export function ShortcutRow({ keys, description }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-xs text-subtle">+</span>}
            <Kbd>{key}</Kbd>
          </span>
        ))}
      </div>
    </div>
  );
}

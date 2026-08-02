import { type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from './button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <div className="w-20 h-20 rounded-full border-2 border-dashed border-border flex items-center justify-center mb-6">
        <Icon className="w-8 h-8 text-primary/70" strokeWidth={1.75} />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-7 max-w-xs leading-relaxed">
        {description}
      </p>
      {actionLabel &&
        (actionHref ? (
          <Link href={actionHref}>
            <Button>{actionLabel}</Button>
          </Link>
        ) : (
          <Button onClick={onAction}>{actionLabel}</Button>
        ))}
    </div>
  );
}

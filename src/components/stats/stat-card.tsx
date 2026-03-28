import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  variant?: 'default' | 'primary' | 'success' | 'destructive';
  className?: string;
}

export function StatCard({ label, value, subValue, variant = 'default', className }: StatCardProps) {
  return (
    <Card
      padding="sm"
      variant={variant === 'primary' ? 'glow' : 'default'}
      className={cn('text-center', className)}
    >
      <p className="text-[11px] text-muted-foreground font-medium mb-1">{label}</p>
      <p
        className={cn('text-2xl font-bold', {
          'text-foreground': variant === 'default',
          'text-primary': variant === 'primary',
          'text-success': variant === 'success',
          'text-destructive': variant === 'destructive',
        })}
      >
        {value}
      </p>
      {subValue && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{subValue}</p>
      )}
    </Card>
  );
}

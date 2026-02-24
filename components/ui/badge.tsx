import React from 'react';
import { cn } from '@/lib/utils';

const Badge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'secondary' | 'destructive' | 'outline' }
>(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: 'border-transparent bg-fcGold text-white hover:bg-opacity-80',
    secondary: 'border-transparent bg-gray-200 text-gray-900 hover:bg-gray-300',
    destructive: 'border-transparent bg-red-500 text-white hover:bg-red-600',
    outline: 'text-gray-900 border border-gray-300'
  };

  return (
    <div
      ref={ref}
      className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-fcGold focus:ring-offset-2', variants[variant], className)}
      {...props}
    />
  );
});
Badge.displayName = 'Badge';

export { Badge };

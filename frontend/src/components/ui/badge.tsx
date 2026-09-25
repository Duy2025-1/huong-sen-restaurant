import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'gold';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'border-transparent bg-amber-500/20 text-amber-300 border border-amber-500/30',
    secondary: 'border-transparent bg-slate-800 text-slate-300 border border-slate-700/60',
    destructive: 'border-transparent bg-red-500/15 text-red-400 border border-red-500/30',
    outline: 'text-slate-300 border border-white/10',
    success: 'border-transparent bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    warning: 'border-transparent bg-amber-500/15 text-amber-400 border border-amber-500/30',
    gold: 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };

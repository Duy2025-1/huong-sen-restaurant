import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'gold' | 'luxury';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 disabled:pointer-events-none disabled:opacity-50 select-none';

    const variants = {
      default: 'bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 shadow-md shadow-amber-500/20 active:scale-[0.98]',
      destructive: 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 active:scale-[0.98]',
      outline: 'border border-white/10 bg-slate-800/40 text-slate-200 hover:bg-slate-800/80 hover:text-white active:scale-[0.98]',
      secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700/80 active:scale-[0.98]',
      ghost: 'hover:bg-slate-800/60 text-slate-300 hover:text-white',
      link: 'text-amber-400 underline-offset-4 hover:underline',
      gold: 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98]',
      luxury: 'bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 text-slate-950 font-bold shadow-lg shadow-amber-500/25 hover:opacity-95 active:scale-[0.98]',
    };

    const sizes = {
      default: 'h-10 px-4 py-2',
      sm: 'h-8 rounded-md px-3 text-xs',
      lg: 'h-12 rounded-xl px-6 text-base font-semibold',
      icon: 'h-9 w-9 rounded-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };

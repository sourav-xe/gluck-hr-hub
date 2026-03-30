'use client';

import * as React from 'react';
import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface MotionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'primary' | 'secondary';
  classes?: string;
  animate?: boolean;
  delay?: number;
}

export default function MotionButton({
  label,
  classes,
  className,
  disabled,
  variant,
  animate,
  delay,
  ...props
}: MotionButtonProps) {
  return (
    <button
      type={props.type ?? 'button'}
      disabled={disabled}
      className={cn(
        // Full-width CTA to match the login form layout
        'group relative flex h-12 w-full items-center justify-center gap-2 rounded-xl',
        'bg-primary text-primary-foreground font-bold',
        'shadow-lg shadow-primary/20',
        'transition-colors hover:bg-primary/90',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className,
        classes
      )}
      {...props}
    >
      <ArrowRight
        className={cn('size-4 transition-transform duration-500 group-hover:translate-x-1')}
        aria-hidden="true"
      />
      <span>{label}</span>
    </button>
  );
}


'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onOpenChange,
  title,
  children,
  className,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    if (open) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'w-full max-w-sm border border-[#ffffff10] bg-[color:var(--bg-surface)] shadow-2xl',
          // Mobile: bottom sheet — rounded top only, full width
          'rounded-t-2xl rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
          // Tablet+: centered modal — fully rounded, padded all sides
          'sm:rounded-2xl sm:pb-5',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile only, affordance-only (no swipe gesture yet) */}
        <div
          aria-hidden="true"
          className="sm:hidden mx-auto mb-2 h-[3px] w-8 rounded-full bg-white/20"
        />
        <h2 className="mb-4 text-sm font-bold text-white tracking-wide uppercase">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
};

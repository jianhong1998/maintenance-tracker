'use client';

import type { FC, ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
};

export const Dialog: FC<DialogProps> = ({
  open,
  onOpenChange,
  title,
  children,
  className,
}) => {
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={onOpenChange}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className="fixed inset-0 z-50 bg-black/70"
          data-radix-dialog-overlay=""
        />
        <RadixDialog.Content
          className={cn(
            'fixed z-50 w-full border border-[#ffffff10] bg-[color:var(--bg-surface)] shadow-2xl',
            // Mobile: bottom sheet — pinned to bottom, rounded top only
            'bottom-0 left-0 right-0 rounded-t-2xl rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
            // Tablet+: centered modal — fully rounded, padded all sides
            'sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:bottom-auto sm:rounded-2xl sm:pb-5 sm:max-w-sm',
            className,
          )}
        >
          {/* Drag handle — mobile only, affordance-only */}
          <div
            aria-hidden="true"
            className="sm:hidden mx-auto mb-2 h-[3px] w-8 rounded-full bg-white/20"
          />
          <RadixDialog.Title className="mb-4 text-sm font-bold text-white tracking-wide uppercase">
            {title}
          </RadixDialog.Title>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

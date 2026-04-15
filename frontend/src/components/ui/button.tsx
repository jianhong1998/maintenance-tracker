import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 aria-invalid:ring-destructive/30 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground font-extrabold tracking-wide rounded-[10px] hover-pointer:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground border border-[#333] rounded-[10px] hover-pointer:bg-[color:var(--bg-card-hover)]',
        'secondary-destructive':
          'bg-secondary text-destructive border border-[#ff444330] rounded-[10px] hover-pointer:bg-[#ff44440d]',
        'dashed-ghost':
          'bg-transparent text-primary border border-dashed border-primary-dim rounded-[10px] hover-pointer:bg-[#00e5ff08]',
        destructive:
          'bg-destructive text-destructive-foreground rounded-[10px] hover-pointer:bg-destructive/90',
        outline:
          'bg-background text-foreground border border-border rounded-[10px] hover-pointer:bg-[color:var(--bg-card-hover)]',
        ghost:
          'bg-transparent text-foreground rounded-[10px] hover-pointer:bg-[color:var(--bg-card-hover)]',
        link: 'text-primary underline-offset-4 hover-pointer:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-xs': 'size-4 rounded-[4px] p-0 text-[10px] leading-none',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = React.ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };

# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the frontend from stock shadcn/ui white to a Dark Terminal aesthetic with Electric Cyan accent, mobile-first responsive layout, and progress-bar maintenance cards.

**Architecture:** All changes are pure frontend styling — no backend, no new data fields. A new `AppShell` component wraps the app in `layout.tsx` and renders a responsive nav (bottom tab bar on mobile, icon sidebar on tablet, full sidebar on desktop at `xl: 1280px`). CSS design tokens in `globals.css` expose every color through Tailwind's `@theme inline` bindings, so downstream components use token classes instead of hex literals. Reusable primitives (`VehicleStatusChip`, typography utility classes, new `Button` variants) are introduced up-front so later tasks consume rather than duplicate them.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, shadcn/ui components, lucide-react icons, class-variance-authority (CVA), Geist Mono (`--font-geist-mono`).

**Scope:** This plan implements every "in scope" item from `docs/superpowers/specs/2026-04-14-ui-redesign-design.md`. Deferred items listed in the spec's "Deferred Items" section are explicitly out of scope for this plan and tracked in `docs/raw-requirements/002-ui-redesign/002-follow-up-of-design.md`.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `frontend/src/app/globals.css` | Modify | Full dark palette, `@theme inline` bindings, `@custom-variant hover-pointer`, typography utility classes, `font-mono` on body |
| `frontend/src/components/ui/button.tsx` | Modify | New variants (`secondary-destructive`, `dashed-ghost`) and `icon-xs` size, remove `dark:` prefixes |
| `frontend/src/lib/vehicle-display.ts` | Modify | Add `getVehicleMetaLine` helper for detail-page meta line with plate number |
| `frontend/src/components/vehicles/vehicle-status-chip.tsx` | **Create** | Reusable chip — "ALL GOOD" / "{N} OVERDUE" |
| `frontend/src/components/vehicles/vehicle-status-chip.spec.tsx` | **Create** | Tests for the two chip states |
| `frontend/src/components/layout/app-shell.tsx` | **Create** | Client component: reads auth + pathname, passes props to presentation |
| `frontend/src/components/layout/app-shell-presentation.tsx` | **Create** | Renders responsive shell (bottom tab bar / icon sidebar / full sidebar) |
| `frontend/src/components/layout/app-shell-presentation.spec.tsx` | **Create** | Tests for nav visibility, active state, three-peer `NAV_ITEMS`, aria-current |
| `frontend/src/app/layout.tsx` | Modify | Wrap children in `<AppShell>`, set viewport-fit=cover meta |
| `frontend/src/app/login/page.tsx` | Modify | Centered layout with 52px logo mark, radial-gradient glow, cyan CTA |
| `frontend/src/components/pages/home-page.tsx` | Modify | Header gradient, alert pill with plural rule, vehicle grid, dashed-ghost add button |
| `frontend/src/components/vehicles/vehicle-card.tsx` | Modify | Dark card with `rounded-[10px]`, single meta line, `VehicleStatusChip`, pointer-only hover |
| `frontend/src/components/pages/vehicle-dashboard-page.tsx` | Modify | Functional back Link (hidden `xl:`), meta line with plate, `secondary-destructive` Delete, correct paddings, sort toggle, dashed-ghost add card |
| `frontend/src/components/vehicles/mileage-prompt-presentation.tsx` | Modify | Dark input, cyan OK button, correct sizing |
| `frontend/src/components/maintenance-cards/maintenance-card-row.tsx` | Modify | Progress bar with locked formula, single top-right sub-label, `icon-xs` action button, correct geometry, pointer-only hover |
| `frontend/src/components/maintenance-cards/maintenance-card-row.spec.tsx` | Modify | Replace old class-name assertions, add progress bar + sub-label tests |
| `frontend/src/components/ui/dialog.tsx` | Modify | Dark surface shell, mobile bottom sheet with drag handle, centered on `sm:` and up |
| `frontend/src/components/vehicles/vehicle-form-dialog.tsx` | Modify | Dark inputs, eyebrow labels, cyan/secondary button variants |
| `frontend/src/components/maintenance-cards/maintenance-card-form-dialog.tsx` | Modify | Same pattern as vehicle form dialog |
| `frontend/src/components/maintenance-cards/mark-done-dialog.tsx` | Modify | Same pattern |
| `frontend/src/components/vehicles/vehicle-delete-confirm-dialog.tsx` | Modify | Same pattern, destructive confirm button |
| `frontend/src/components/maintenance-cards/delete-confirm-dialog.tsx` | Modify | Same pattern |
| `frontend/src/app/vehicles/layout.tsx` | **Create** | Next.js segment layout wrapping `/vehicles/*` |
| `frontend/src/components/layout/vehicles-layout.tsx` | **Create** | Desktop split pane (vehicle list + detail content) using `VehicleStatusChip` |
| `frontend/src/components/layout/vehicles-layout.spec.tsx` | **Create** | Tests for list rendering and presence of status chips |
| `frontend/src/app/history/page.tsx` | **Create** | "Coming soon" placeholder page |
| `frontend/src/app/profile/page.tsx` | **Create** | "Coming soon" placeholder page |

---

## Task 1: CSS Design Tokens and Typography Utilities

**Files:**
- Modify: `frontend/src/app/globals.css`

This task lands the full palette + Tailwind `@theme inline` bindings + typography utility classes + global monospace font. Every downstream task consumes these, so Task 1 MUST land first.

- [ ] **Step 1: Replace the entire `globals.css` with the new dark token set**

```css
@import 'tailwindcss';
@import 'tw-animate-css';

/* Pointer-only hover: suppresses sticky-after-tap hover on touch devices.
   Used by `hover-pointer:` classes in VehicleCard and MaintenanceCardRow. */
@custom-variant hover-pointer (&:where(@media (hover: hover) and (pointer: fine)):hover);

:root {
  --radius: 0.625rem;

  /* Surfaces */
  --bg-base: #07090f;
  --bg-surface: #0d1117;
  --bg-card: #0f1923;
  --bg-card-hover: #111d2b;

  /* Interactive */
  --primary: #00e5ff;
  --primary-foreground: #07090f;
  --primary-dim: #00e5ff20;
  --primary-border: #00e5ff30;
  --border-accent: #00e5ff15;
  --ring: #00e5ff40;

  /* shadcn `--accent` keeps hover-surface semantics — NOT cyan.
     Components that want cyan interactive color use `--primary`. */
  --accent: #0f1923;
  --accent-foreground: #ffffff;

  /* Status */
  --danger: #ff4444;
  --danger-dim: #ff44440d;
  --danger-border: #ff444328;
  --warning: #f59e0b;
  --warning-dim: #f59e0b0d;
  --warning-border: #f59e0b28;

  /* Text */
  --text-primary: #ffffff;
  --text-secondary: #888888;
  --text-muted: #444444;
  --text-disabled: #555555;

  /* shadcn aliases -> new tokens */
  --background: var(--bg-base);
  --foreground: var(--text-primary);
  --card: var(--bg-card);
  --card-foreground: var(--text-primary);
  --popover: var(--bg-surface);
  --popover-foreground: var(--text-primary);
  --secondary: var(--bg-card);
  --secondary-foreground: #aaaaaa;
  --muted: var(--bg-surface);
  --muted-foreground: var(--text-secondary);
  --destructive: var(--danger);
  --destructive-foreground: var(--text-primary);
  --border: rgba(255, 255, 255, 0.06);
  --input: var(--bg-card);

  --chart-1: #00e5ff;
  --chart-2: #0066ff;
  --chart-3: #f59e0b;
  --chart-4: #ff4444;
  --chart-5: #22c55e;
  --sidebar: var(--bg-surface);
  --sidebar-foreground: var(--text-primary);
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: var(--primary-foreground);
  --sidebar-accent: var(--bg-card);
  --sidebar-accent-foreground: var(--text-primary);
  --sidebar-border: rgba(255, 255, 255, 0.05);
  --sidebar-ring: var(--ring);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-card-hover: var(--bg-card-hover);
  --color-surface: var(--bg-surface);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary-dim: var(--primary-dim);
  --color-primary-border: var(--primary-border);
  --color-border-accent: var(--border-accent);
  --color-ring: var(--ring);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-danger: var(--danger);
  --color-danger-dim: var(--danger-dim);
  --color-danger-border: var(--danger-border);
  --color-warning: var(--warning);
  --color-warning-dim: var(--warning-dim);
  --color-warning-border: var(--warning-border);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-muted: var(--text-muted);
  --color-text-disabled: var(--text-disabled);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html {
    color-scheme: dark;
  }
  body {
    @apply bg-background text-foreground font-mono;
  }
}

@layer components {
  .text-page-title {
    @apply text-xl font-extrabold text-white;
  }
  .text-eyebrow {
    font-size: 0.6rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }
  .text-eyebrow-primary {
    font-size: 0.6rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--primary);
  }
  .text-card-title {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  .text-meta {
    font-size: 0.625rem;
    color: var(--text-secondary);
  }
  .text-status-chip {
    font-size: 0.5rem;
    font-weight: 700;
    text-transform: uppercase;
  }
}
```

- [ ] **Step 2: Run format to normalize**

```bash
cd /Users/leejianhong/projects/personal-project/maintenance-tracker && just format
```

- [ ] **Step 3: Run the full frontend test suite**

```bash
cd frontend && pnpm exec vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass. Existing tests don't assert on global CSS, so token renames don't break them yet; component tests that assert on old class names are updated in their own tasks.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "replace color tokens with dark terminal palette and typography utilities"
```

---

## Task 2: Button Component Variants

**Files:**
- Modify: `frontend/src/components/ui/button.tsx`

This task introduces the four variants (`default`, `secondary`, `secondary-destructive`, `dashed-ghost`) and the `icon-xs` size consumed by later tasks. Downstream tasks assume these variants exist.

- [ ] **Step 1: Replace the entire `buttonVariants` definition and its `Button` export**

Overwrite `frontend/src/components/ui/button.tsx` with:

```typescript
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
          'bg-primary text-primary-foreground font-extrabold tracking-wide rounded-[10px] hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground border border-[#333] rounded-[10px] hover:bg-[color:var(--bg-card-hover)]',
        'secondary-destructive':
          'bg-secondary text-destructive border border-[#ff444330] rounded-[10px] hover:bg-[#ff44440d]',
        'dashed-ghost':
          'bg-transparent text-primary border border-dashed border-primary-dim rounded-[10px] hover:bg-[#00e5ff08]',
        destructive:
          'bg-destructive text-destructive-foreground rounded-[10px] hover:bg-destructive/90',
        outline:
          'bg-background text-foreground border border-border rounded-[10px] hover:bg-[color:var(--bg-card-hover)]',
        ghost:
          'bg-transparent text-foreground rounded-[10px] hover:bg-[color:var(--bg-card-hover)]',
        link: 'text-primary underline-offset-4 hover:underline',
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
```

Notes:
- No `dark:` prefixes. This is a dark-only theme.
- `default`: `font-extrabold` + `rounded-[10px]` per spec D1.
- `secondary`: `border-[#333]` per spec D2.
- `secondary-destructive`: new variant — used by Delete button on Vehicle Detail (spec D5).
- `dashed-ghost`: new variant — used by "+ ADD VEHICLE" and "+ ADD MAINTENANCE CARD" (spec D3).
- `icon-xs`: new size — `16×16px` with `rounded-[4px]` for the `⋮` action button on maintenance card rows (spec D4).
- `focus-visible:ring-2` provides a visible focus ring on all Button instances (addresses 1.4 partially; non-Button interactives are still a follow-up).

- [ ] **Step 2: Run existing button tests**

```bash
cd frontend && pnpm exec vitest run src/components/ui/button.spec.tsx --reporter=verbose 2>&1 | tail -20
```

If any assertions check old class names (e.g. `font-bold` without `font-extrabold`, `rounded-md`), update them inline to match the new variants. These tests check presentation classes, so they must track the redesign.

- [ ] **Step 3: Run the full frontend test suite**

```bash
cd frontend && pnpm exec vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/button.tsx frontend/src/components/ui/button.spec.tsx
git commit -m "add secondary-destructive, dashed-ghost, icon-xs button variants"
```

---

## Task 3: Vehicle Display Helpers and Status Chip Primitive

**Files:**
- Modify: `frontend/src/lib/vehicle-display.ts`
- Create: `frontend/src/components/vehicles/vehicle-status-chip.tsx`
- Create: `frontend/src/components/vehicles/vehicle-status-chip.spec.tsx`

`VehicleStatusChip` is consumed by both `VehicleCard` (Task 7) and `VehicleListItem` (Task 14), so it lands here. `getVehicleMetaLine` is consumed by `VehicleDashboardPage` (Task 9) and is distinct from the existing `getVehicleDisplayLabels` used for card-list brevity.

- [ ] **Step 1: Read the existing helper**

```bash
cat frontend/src/lib/vehicle-display.ts
```

You should see `getVehicleDisplayLabels` returning `{ primary, secondary }`. Leave that function unchanged — we are adding a new function alongside it.

- [ ] **Step 2: Add `getVehicleMetaLine` to `vehicle-display.ts`**

Append the following function to `frontend/src/lib/vehicle-display.ts` (keep existing exports):

```typescript
import type { IVehicleResDTO } from '@project/types';

// ...existing getVehicleDisplayLabels stays as-is...

/**
 * Meta line for the vehicle detail page header.
 * Format: "Colour · Mileage unit · Plate: XXX"
 * Distinct from getVehicleDisplayLabels — this is full detail, not card-list brevity.
 */
export const getVehicleMetaLine = (vehicle: IVehicleResDTO): string => {
  const parts = [
    vehicle.colour,
    `${vehicle.mileage.toLocaleString()} ${vehicle.mileageUnit}`,
  ];
  if (vehicle.plateNumber) {
    parts.push(`Plate: ${vehicle.plateNumber}`);
  }
  return parts.join(' · ');
};
```

If the existing file uses a different `import` style or the field is named differently (e.g. `plate` instead of `plateNumber`), adapt the field name to match the actual `IVehicleResDTO` shape — run `grep "plate" packages/types/src/*.ts` to confirm.

- [ ] **Step 3: Write the failing test for `VehicleStatusChip`**

Create `frontend/src/components/vehicles/vehicle-status-chip.spec.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { VehicleStatusChip } from './vehicle-status-chip';

describe('VehicleStatusChip', () => {
  it('renders "ALL GOOD" when count is 0', () => {
    render(<VehicleStatusChip count={0} />);
    expect(screen.getByText('ALL GOOD')).toBeInTheDocument();
  });

  it('renders "{count} OVERDUE" when count is greater than 0', () => {
    render(<VehicleStatusChip count={3} />);
    expect(screen.getByText('3 OVERDUE')).toBeInTheDocument();
  });

  it('applies danger classes when overdue', () => {
    const { container } = render(<VehicleStatusChip count={1} />);
    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toContain('text-[#ff4444]');
  });

  it('applies primary classes when all good', () => {
    const { container } = render(<VehicleStatusChip count={0} />);
    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toContain('text-[#00e5ff]');
  });
});
```

- [ ] **Step 4: Run the test to confirm it fails**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-status-chip.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 5: Create `vehicle-status-chip.tsx`**

Create `frontend/src/components/vehicles/vehicle-status-chip.tsx`:

```typescript
import type { FC } from 'react';
import { cn } from '@/lib/utils';

type VehicleStatusChipProps = {
  count: number;
  className?: string;
};

export const VehicleStatusChip: FC<VehicleStatusChipProps> = ({
  count,
  className,
}) => {
  const hasWarning = count > 0;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-status-chip border',
        hasWarning
          ? 'bg-[#ff444418] border-[#ff444440] text-[#ff4444]'
          : 'bg-[#00e5ff10] border-[#00e5ff25] text-[#00e5ff]',
        className,
      )}
    >
      {hasWarning ? `${count} OVERDUE` : 'ALL GOOD'}
    </span>
  );
};
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-status-chip.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/vehicle-display.ts frontend/src/components/vehicles/vehicle-status-chip.tsx frontend/src/components/vehicles/vehicle-status-chip.spec.tsx
git commit -m "add getVehicleMetaLine helper and VehicleStatusChip primitive"
```

---

## Task 4: AppShell Component

**Files:**
- Create: `frontend/src/components/layout/app-shell-presentation.tsx`
- Create: `frontend/src/components/layout/app-shell.tsx`
- Create: `frontend/src/components/layout/app-shell-presentation.spec.tsx`

Breakpoints: mobile `< md:`, tablet `md:` (768px), desktop `xl:` (1280px). The tablet sidebar shows an icon with a small label BELOW it; the desktop sidebar shows icon + label side-by-side.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/layout/app-shell-presentation.spec.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { AppShellPresentation } from './app-shell-presentation';

describe('AppShellPresentation', () => {
  it('renders children without nav when showNav is false', () => {
    render(
      <AppShellPresentation
        showNav={false}
        pathname="/login"
        userDisplayName={null}
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('renders nav with three peer items (Fleet, History, Profile) when showNav is true', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/"
        userDisplayName="Jane Smith"
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    // There are two nav elements on desktop+ (sidebar + hidden mobile bar), so getAllByRole
    const navs = screen.getAllByRole('navigation');
    expect(navs.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/fleet/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/history/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/profile/i).length).toBeGreaterThan(0);
  });

  it('marks Fleet link as aria-current="page" when pathname is /', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/"
        userDisplayName={null}
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    const fleetLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/');
    expect(fleetLinks.length).toBeGreaterThan(0);
    expect(fleetLinks[0]).toHaveAttribute('aria-current', 'page');
  });

  it('marks History as active on /history (segment match)', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/history"
        userDisplayName={null}
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    const historyLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/history');
    expect(historyLinks[0]).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark History as active on /history-foo (segment boundary)', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/history-foo"
        userDisplayName={null}
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    const historyLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/history');
    expect(historyLinks[0]).not.toHaveAttribute('aria-current', 'page');
  });

  it('renders the user display name in the desktop sidebar', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/"
        userDisplayName="Jane Smith"
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd frontend && pnpm exec vitest run src/components/layout/app-shell-presentation.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `app-shell-presentation.tsx`**

Create `frontend/src/components/layout/app-shell-presentation.tsx`:

```typescript
import type { FC, ReactNode } from 'react';
import Link from 'next/link';
import { Car, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type AppShellPresentationProps = {
  showNav: boolean;
  pathname: string;
  userDisplayName: string | null;
  children: ReactNode;
};

type NavItemConfig = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const NAV_ITEMS: NavItemConfig[] = [
  { href: '/', label: 'Fleet', icon: Car },
  { href: '/history', label: 'History', icon: Clock },
  { href: '/profile', label: 'Profile', icon: User },
];

const isActive = (pathname: string, href: string): boolean => {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
};

export const AppShellPresentation: FC<AppShellPresentationProps> = ({
  showNav,
  pathname,
  userDisplayName,
  children,
}) => {
  if (!showNav) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Tablet + Desktop: left sidebar */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 z-40 w-[52px] xl:w-[140px] bg-[color:var(--bg-surface)] border-r border-[#00e5ff12]">
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-4">
          <div className="w-7 h-7 flex-shrink-0 rounded-lg bg-gradient-to-br from-[#00e5ff] to-[#0066ff]" />
          <span className="hidden xl:block text-eyebrow-primary">MTRACK</span>
        </div>

        {/* Nav items */}
        <nav aria-label="Primary" className="flex flex-col gap-1 px-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  // Tablet: icon stacked over small label; Desktop: icon + label side-by-side
                  'flex flex-col items-center gap-0.5 rounded-md p-2 transition-colors',
                  'xl:flex-row xl:items-center xl:gap-2',
                  active
                    ? 'bg-[#00e5ff12] text-primary'
                    : 'text-[#444] hover:bg-[#0f1923] hover:text-[#888]',
                )}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="text-[0.55rem] xl:text-xs font-semibold tracking-wide">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User avatar at bottom */}
        <div className="mt-auto p-3">
          <div className="flex flex-col xl:flex-row items-center gap-1 xl:gap-2">
            <div className="w-7 h-7 flex-shrink-0 rounded-full bg-[color:var(--bg-card)] border border-[#ffffff10] flex items-center justify-center">
              <User size={14} className="text-[#444]" />
            </div>
            <span className="hidden xl:block text-[#888] text-xs truncate max-w-[80px]">
              {userDisplayName ?? 'Profile'}
            </span>
          </div>
        </div>
      </aside>

      {/* Page content wrapper — leaves room for sidebar on md+ and for bottom tab bar on mobile */}
      <div className="flex-1 min-w-0 md:ml-[52px] xl:ml-[140px] pb-[calc(3rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>

      {/* Mobile: bottom tab bar */}
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 inset-x-0 h-12 bg-[color:var(--bg-surface)] border-t border-[#00e5ff15] flex items-center justify-around z-40 px-4 pb-[env(safe-area-inset-bottom)]"
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1 px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e5ff40] rounded',
                active ? 'text-primary' : 'text-[#444]',
              )}
            >
              {active && (
                <span className="w-1 h-1 rounded-full bg-primary mb-0.5" />
              )}
              <Icon size={16} />
              <span className="text-[0.55rem] font-semibold tracking-wide">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
```

Key points vs the old spec:
- `NAV_ITEMS` holds three peers (Profile is not hardcoded outside the map) — blocker B6.
- `isActive` uses segment-boundary match — follow-up 3.4.
- `aria-current="page"` on active links — follow-up 1.3.
- Tablet sidebar width `52px`, desktop `xl:w-[140px]` — blocker B1.
- Label layout: `flex-col` (icon over label) on tablet, `xl:flex-row` on desktop — blocker B3.
- No absolutely-positioned edge bar; background tint alone signals active — blocker B4.
- Sidebar border `border-[#00e5ff12]`, bottom tab bar border `border-[#00e5ff15]` — blocker B5.
- Bottom tab bar includes `pb-[env(safe-area-inset-bottom)]`; content wrapper includes `pb-[calc(3rem+env(safe-area-inset-bottom))]` — follow-up 2.1.
- `userDisplayName` prop surfaces the real user name — blocker I2.
- `focus-visible:ring` on mobile nav Links — follow-up 1.4.

- [ ] **Step 4: Create `app-shell.tsx`**

Create `frontend/src/components/layout/app-shell.tsx`:

```typescript
'use client';

import type { FC, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthContext } from '@/contexts/auth-context';
import { AppShellPresentation } from './app-shell-presentation';

type AppShellProps = {
  children: ReactNode;
};

export const AppShell: FC<AppShellProps> = ({ children }) => {
  const { user, loading } = useAuthContext();
  const pathname = usePathname();

  const showNav = !loading && !!user && pathname !== '/login';
  const userDisplayName = user?.displayName ?? null;

  return (
    <AppShellPresentation
      showNav={showNav}
      pathname={pathname}
      userDisplayName={userDisplayName}
    >
      {children}
    </AppShellPresentation>
  );
};
```

If `useAuthContext().user` does not have a `displayName` field (check `frontend/src/contexts/auth-context.tsx`), adapt to the actual field (e.g. `user?.name ?? user?.email ?? null`).

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/components/layout/app-shell-presentation.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/
git commit -m "add responsive AppShell with three-peer nav and safe-area insets"
```

---

## Task 5: Wire AppShell into Root Layout

**Files:**
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Replace the root layout**

Replace the contents of `frontend/src/app/layout.tsx`:

```typescript
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { ConfigProvider } from '@/components/providers/config-provider';
import { ReactQueryProvider } from '@/components/providers/react-query-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { AppShell } from '@/components/layout/app-shell';
import './globals.css';

export const dynamic = 'force-dynamic';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Maintenance Tracker',
  description: 'Track your vehicle maintenance schedules',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const backendUrl =
    process.env.FRONTEND_BACKEND_BASE_URL ?? 'http://localhost:3001';

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ConfigProvider backendUrl={backendUrl}>
          <ReactQueryProvider>
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </ReactQueryProvider>
        </ConfigProvider>
        <Toaster position="top-right" duration={5000} theme="dark" />
      </body>
    </html>
  );
}
```

Notes:
- `viewport.viewportFit: 'cover'` enables `env(safe-area-inset-*)` on iOS — follow-up 2.1.
- If the existing layout already imports Geist fonts via a different path, keep that import and only add `AppShell` + `viewport`. If Geist is not yet wired, this task adds it so `--font-geist-mono` resolves to a real font family.

- [ ] **Step 2: Run all frontend tests**

```bash
cd frontend && pnpm exec vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 3: Run format and lint**

```bash
cd /Users/leejianhong/projects/personal-project/maintenance-tracker && just format && just lint
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/layout.tsx
git commit -m "wire AppShell into root layout with viewport-fit cover"
```

---

## Task 6: Login Page

**Files:**
- Modify: `frontend/src/app/login/page.tsx`

- [ ] **Step 1: Replace the login page JSX**

Overwrite `frontend/src/app/login/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuthContext();
  const router = useRouter();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    setSignInError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      setSignInError('Sign-in failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-6 w-full max-w-xs">
        {/* Logo mark with ambient radial glow */}
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute w-40 h-40"
            style={{
              background:
                'radial-gradient(circle, #00e5ff12, transparent 70%)',
            }}
          />
          <div className="relative w-[52px] h-[52px] rounded-2xl border border-[#00e5ff40] bg-[#00e5ff12] flex items-center justify-center">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#00e5ff] to-[#0066ff]" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <p
            className="text-primary font-bold mb-1"
            style={{ fontSize: '0.6rem', letterSpacing: '0.3em' }}
          >
            MAINTENANCE
          </p>
          <h1 className="text-white font-extrabold tracking-tight text-[1.5rem]">
            TRACKER
          </h1>
          <p className="text-[#444] text-xs mt-2">
            Vehicle maintenance, under control.
          </p>
        </div>

        {/* Decorative divider */}
        <div className="w-20 h-px bg-gradient-to-r from-transparent via-[#00e5ff30] to-transparent" />

        {/* CTA */}
        <div className="w-full flex flex-col gap-3">
          <Button
            className="w-full text-xs tracking-widest"
            onClick={() => void handleSignIn()}
            disabled={loading || isSigningIn}
          >
            {isSigningIn ? 'SIGNING IN...' : 'SIGN IN WITH GOOGLE'}
          </Button>

          {signInError && (
            <p className="text-destructive text-xs text-center">{signInError}</p>
          )}
        </div>

        <p className="text-[#333] text-[0.5rem] text-center">
          By signing in you agree to our Terms of Service
        </p>
      </div>
    </main>
  );
}
```

Notes:
- Logo container `w-[52px] h-[52px]` — blocker E1.
- Border `#00e5ff40`, bg `#00e5ff12` — blocker E2.
- Inner gradient block `w-6 h-6` (24px) — blocker E3.
- Glow is a `radial-gradient` background, not `blur-2xl` — blocker E4.
- Terms text `0.5rem` — blocker E5.
- `aria-hidden` on the decorative glow div.

- [ ] **Step 2: Run login page tests**

```bash
cd frontend && pnpm exec vitest run src/app/login/page.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: existing behavior tests pass. Update any class-name assertions that reference the old login layout.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/login/
git commit -m "restyle login page with 52px logo and radial glow"
```

---

## Task 7: Vehicle Card

**Files:**
- Modify: `frontend/src/components/vehicles/vehicle-card.tsx`

- [ ] **Step 1: Replace the vehicle card**

Overwrite `frontend/src/components/vehicles/vehicle-card.tsx`:

```typescript
'use client';

import type { FC } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { IVehicleResDTO } from '@project/types';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import { countWarningCards } from '@/lib/warning';
import { getVehicleDisplayLabels } from '@/lib/vehicle-display';
import { VehicleStatusChip } from './vehicle-status-chip';
import { cn } from '@/lib/utils';

type VehicleCardProps = {
  vehicle: IVehicleResDTO;
  thresholdKm: number;
};

export const VehicleCard: FC<VehicleCardProps> = ({ vehicle, thresholdKm }) => {
  const { data: cards = [] } = useMaintenanceCards(vehicle.id);

  const warningCount = countWarningCards(
    cards,
    vehicle.mileage,
    vehicle.mileageUnit,
    thresholdKm,
  );

  const { primary } = getVehicleDisplayLabels(vehicle);
  const hasWarning = warningCount > 0;

  const metaLine = `${vehicle.colour} · ${vehicle.mileage.toLocaleString()} ${vehicle.mileageUnit}`;

  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      className={cn(
        'block rounded-[10px] border p-[11px] transition-colors hover-pointer:bg-[#111d2b]',
        hasWarning
          ? 'bg-[color:var(--bg-card)] border-[#ff444328]'
          : 'bg-[color:var(--bg-card)] border-border-accent',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-card-title truncate">{primary}</p>
          <p className="text-meta truncate">{metaLine}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <VehicleStatusChip count={warningCount} />
          <ChevronRight size={14} className="text-[#444]" />
        </div>
      </div>
    </Link>
  );
};
```

**Pointer-only hover note:** The `hover-pointer:` variant is declared once in `globals.css` (Task 1) as `@custom-variant hover-pointer (&:where(@media (hover: hover) and (pointer: fine)):hover)`. It compiles to a `@media (hover: hover) and (pointer: fine)` block so hover styles only apply to real pointers — no sticky-after-tap on mobile Safari. If `hover-pointer:bg-[#111d2b]` does nothing at runtime, you skipped Task 1's custom variant declaration — go back and add it.

- [ ] **Step 2: Update `vehicle-card.spec.tsx` to match new output**

Find the spec and remove assertions that reference:
- Old `rounded-xl`, `p-3`, `border-white/5`
- Old separate `<p>` for `secondary` brand/model (it's dropped from the card)
- Hardcoded "ALL GOOD" / "{N} OVERDUE" rendered in-place (now emitted by `VehicleStatusChip`)

Replace with assertions that check:
- `VehicleStatusChip` is rendered (`screen.getByText('ALL GOOD')` still works — the chip renders the same text)
- The meta line contains `vehicle.colour + ' · ' + mileage + ' ' + unit`
- No `brand/model` text is rendered on the card

```typescript
it('renders the meta line as "colour · mileage unit"', () => {
  render(<VehicleCard vehicle={mockVehicle} thresholdKm={500} />);
  expect(
    screen.getByText(`${mockVehicle.colour} · ${mockVehicle.mileage.toLocaleString()} ${mockVehicle.mileageUnit}`),
  ).toBeInTheDocument();
});
```

Delete any test that asserted the card rendered the vehicle's brand/model.

- [ ] **Step 3: Run vehicle card tests**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-card.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/vehicles/vehicle-card.tsx frontend/src/components/vehicles/vehicle-card.spec.tsx frontend/src/app/globals.css
git commit -m "restyle vehicle card with status chip and pointer-only hover"
```

---

## Task 8: Home Page

**Files:**
- Modify: `frontend/src/components/pages/home-page.tsx`

- [ ] **Step 1: Replace the home page JSX**

Overwrite `frontend/src/components/pages/home-page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { User } from 'lucide-react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { VehicleCard } from '@/components/vehicles/vehicle-card';
import { VehicleFormDialog } from '@/components/vehicles/vehicle-form-dialog';
import { Button } from '@/components/ui/button';
import { useVehicles } from '@/hooks/queries/vehicles/useVehicles';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { useGlobalWarningCount } from '@/hooks/queries/vehicles/useGlobalWarningCount';

const formatAttentionPill = (count: number): string => {
  if (count === 1) return '1 ITEM NEEDS ATTENTION';
  return `${count} ITEMS NEED ATTENTION`;
};

const HomeContent = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: config } = useAppConfig();
  const thresholdKm = config?.mileageWarningThresholdKm ?? 0;
  const globalWarningCount = useGlobalWarningCount(vehicles, thresholdKm);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-[color:var(--bg-surface)] to-[color:var(--bg-base)] px-[12px] pt-[10px] pb-[8px]">
        <div className="flex items-center justify-between mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00e5ff] to-[#0066ff] md:hidden" />
          <div className="w-7 h-7 rounded-full bg-[color:var(--bg-card)] border border-[#ffffff10] flex items-center justify-center ml-auto md:ml-0">
            <User size={14} className="text-[#444]" />
          </div>
        </div>
        <p className="text-eyebrow mb-0.5">FLEET OVERVIEW</p>
        <h1 className="text-page-title">Your Vehicles</h1>

        {!isLoading && vehicles.length > 0 && globalWarningCount > 0 && (
          <div className="inline-flex items-center gap-2 mt-3 bg-[color:var(--danger-dim)] border border-[#ff444330] rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--danger)] flex-shrink-0" />
            <span className="text-[color:var(--danger)] text-status-chip">
              {formatAttentionPill(globalWarningCount)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-[10px] py-4 flex flex-col gap-3">
        {isLoading ? (
          <p className="text-[#555] text-sm">Loading vehicles…</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  thresholdKm={thresholdKm}
                />
              ))}
            </div>

            <Button
              variant="dashed-ghost"
              className="w-full py-4 text-xs tracking-widest"
              onClick={() => setCreateOpen(true)}
            >
              + ADD VEHICLE
            </Button>
          </>
        )}
      </div>

      <VehicleFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

export const HomePage = () => {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
};
```

Notes:
- Header padding `px-[12px] pt-[10px] pb-[8px]` — blocker G1 (applied to home header too so the gutter is consistent).
- Card grid gates on `md:` (2-col tablet) and `xl:` (3-col desktop) — blocker B1.
- Alert pill uses `formatAttentionPill` — blocker-adjacent follow-up 5.3 (full pluralization).
- Add Vehicle uses `<Button variant="dashed-ghost">` — blocker D3.

- [ ] **Step 2: Run home page tests**

```bash
cd frontend && pnpm exec vitest run src/components/pages/home-page.spec.tsx --reporter=verbose 2>&1 | tail -20
```

If the existing spec asserts on `N ITEMS NEED ATTENTION` for `count === 1`, update to `1 ITEM NEEDS ATTENTION`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/pages/home-page.tsx frontend/src/components/pages/home-page.spec.tsx
git commit -m "restyle home page with xl grid and pluralized alert pill"
```

---

## Task 9: Vehicle Dashboard Page

**Files:**
- Modify: `frontend/src/components/pages/vehicle-dashboard-page.tsx`

This task replaces the `DashboardContent` JSX only. Keep all existing state, hooks, and handler functions unchanged — only the returned JSX is rewritten.

**Desktop layout note:** On `xl:`, the vehicle list panel (delivered by Task 14 `VehiclesLayout`) owns fleet navigation. The back-navigation block on this page MUST be hidden on `xl:` (`xl:hidden`).

- [ ] **Step 1: Replace the `return (...)` block inside `DashboardContent`**

Inside `frontend/src/components/pages/vehicle-dashboard-page.tsx`, find the `DashboardContent` function and replace its return block with:

```typescript
import Link from 'next/link';
// ...existing imports...
import { getVehicleDisplayLabels, getVehicleMetaLine } from '@/lib/vehicle-display';
// ...rest of imports...

  const { primary } = getVehicleDisplayLabels(vehicle);
  const metaLine = getVehicleMetaLine(vehicle);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Vehicle header */}
      <div className="bg-gradient-to-b from-[color:var(--bg-surface)] to-[color:var(--bg-base)] px-[12px] pt-[10px] pb-[8px]">
        {/* Back nav — hidden on desktop where the split pane owns navigation */}
        <Link
          href="/"
          aria-label="Back to fleet"
          className="inline-flex items-center gap-1 text-primary text-eyebrow mb-1 xl:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e5ff40] rounded"
        >
          <span aria-hidden="true">←</span>
          <span>FLEET</span>
        </Link>

        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <h1 className="text-page-title truncate">{primary}</h1>
            <p className="text-[color:var(--text-muted)] text-[0.625rem]">
              {metaLine}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0 pt-1">
            <Button
              size="sm"
              variant="secondary"
              aria-label="Edit vehicle"
              onClick={() => setEditVehicleOpen(true)}
              className="text-xs"
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="secondary-destructive"
              aria-label="Delete vehicle"
              onClick={() => setDeleteVehicleOpen(true)}
              className="text-xs"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <MileagePrompt
          vehicleId={vehicleId}
          currentMileage={vehicle.mileage}
          mileageLastUpdatedAt={vehicle.mileageLastUpdatedAt}
        />

        {/* Sort toggle */}
        <div className="flex gap-2 mx-[10px] mb-[6px]">
          <Button
            size="sm"
            variant={sort === 'urgency' ? 'default' : 'secondary'}
            onClick={() => setSort('urgency')}
            className="text-xs tracking-widest"
          >
            URGENCY
          </Button>
          <Button
            size="sm"
            variant={sort === 'name' ? 'default' : 'secondary'}
            onClick={() => setSort('name')}
            className="text-xs tracking-widest"
          >
            NAME
          </Button>
        </div>

        {/* Card list */}
        <div className="flex flex-col gap-[5px] px-[10px] pb-4">
          <Button
            variant="dashed-ghost"
            aria-label="Add maintenance card"
            onClick={() => setCreateOpen(true)}
            className="w-full py-4 text-xs tracking-widest"
          >
            + ADD MAINTENANCE CARD
          </Button>

          {cardsLoading ? (
            <p className="text-[#555] text-sm">Loading cards…</p>
          ) : cards.length === 0 ? (
            <p className="text-[#555] text-sm">No maintenance cards yet.</p>
          ) : (
            cards.map((card) => (
              <MaintenanceCardRow
                key={card.id}
                card={card}
                vehicle={vehicle}
                isDropdownOpen={activeDropdownId === card.id}
                onDropdownToggle={setActiveDropdownId}
                onEdit={handleEdit}
                onMarkDone={handleMarkDone}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>

      {/* Dialogs — unchanged */}
      <MaintenanceCardFormDialog
        open={createOpen || !!editingCard}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditingCard(null);
          }
        }}
        vehicleId={vehicleId}
        vehicleMileage={vehicle.mileage}
        vehicleMileageUnit={vehicle.mileageUnit}
        card={editingCard ?? undefined}
      />

      {markingDoneCard && (
        <MarkDoneDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setMarkingDoneCard(null);
          }}
          card={markingDoneCard}
          vehicleId={vehicleId}
          currentMileage={vehicle.mileage}
        />
      )}

      {deletingCard && (
        <DeleteConfirmDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setDeletingCard(null);
          }}
          card={deletingCard}
          vehicleId={vehicleId}
        />
      )}

      <VehicleFormDialog
        open={editVehicleOpen}
        onOpenChange={setEditVehicleOpen}
        vehicle={vehicle}
        hasCards={cards.length > 0}
      />

      <VehicleDeleteConfirmDialog
        open={deleteVehicleOpen}
        onOpenChange={setDeleteVehicleOpen}
        vehicle={vehicle}
      />
    </div>
  );
```

Notes:
- Back nav is a functional `<Link href="/">` — blocker A1.
- Meta line uses `getVehicleMetaLine` (plate number + no duplicated colour) — blocker A2.
- Delete button uses `variant="secondary-destructive"` — blocker D5.
- Header padding `px-[12px] pt-[10px] pb-[8px]` — blocker G1.
- Card list uses `px-[10px] gap-[5px]` — blocker G4.
- Add card uses `<Button variant="dashed-ghost">` — blocker D3.
- Back nav has `xl:hidden` so the desktop split pane owns fleet navigation — blocker B2.

- [ ] **Step 2: Run dashboard tests**

```bash
cd frontend && pnpm exec vitest run src/components/pages/vehicle-dashboard-page.spec.tsx --reporter=verbose 2>&1 | tail -30
```

Update any spec assertions that reference the old back-nav `<p>`, or that checked for brand/model on its own line in the header. Add a test that confirms the back-nav is an actual `<a href="/">`:

```typescript
it('renders back navigation as a Link to /', () => {
  render(<DashboardContent vehicleId="veh-1" />);
  const backLink = screen.getByLabelText('Back to fleet');
  expect(backLink).toHaveAttribute('href', '/');
});

it('renders the meta line with plate number', () => {
  const vehicle = { ...mockVehicle, plateNumber: 'ABC123' };
  // ...render and assert...
  expect(screen.getByText(/Plate: ABC123/)).toBeInTheDocument();
});
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/pages/vehicle-dashboard-page.tsx frontend/src/components/pages/vehicle-dashboard-page.spec.tsx
git commit -m "restyle vehicle dashboard with functional back link and meta helper"
```

---

## Task 10: Mileage Prompt Presentation

**Files:**
- Modify: `frontend/src/components/vehicles/mileage-prompt-presentation.tsx`

- [ ] **Step 1: Replace the presentation**

Overwrite `frontend/src/components/vehicles/mileage-prompt-presentation.tsx`:

```typescript
import type { FC } from 'react';
import { Button } from '@/components/ui/button';

type MileagePromptPresentationProps = {
  currentMileage: number;
  value: string;
  isError: boolean;
  isBelowCurrent: boolean;
  isSubmitDisabled: boolean;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onDismiss: () => void;
};

export const MileagePromptPresentation: FC<MileagePromptPresentationProps> = ({
  currentMileage,
  value,
  isError,
  isBelowCurrent,
  isSubmitDisabled,
  onValueChange,
  onSubmit,
  onDismiss,
}) => {
  return (
    <div className="mx-[10px] mb-[6px] rounded-lg border border-primary-dim bg-[color:var(--bg-card)] p-2">
      <p className="text-eyebrow-primary mb-2">UPDATE ODOMETER</p>
      {isError && (
        <p className="text-destructive mb-2 text-xs">
          Failed to update mileage. Please try again.
        </p>
      )}
      {isBelowCurrent && (
        <p className="text-destructive mb-2 text-xs">
          Mileage cannot be less than current ({currentMileage})
        </p>
      )}
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="Enter mileage"
          className="flex-1 rounded-lg border border-primary-dim bg-[color:var(--bg-base)] px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:ring-2 focus:ring-[#00e5ff40]"
        />
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={isSubmitDisabled}
          className="text-xs tracking-widest"
        >
          OK
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="text-[#555] text-xs"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
};
```

Notes:
- Container `rounded-lg p-2 mx-[10px] mb-[6px]` — blocker G2.
- Input focus ring `#00e5ff40` — blocker G3.
- Eyebrow uses the `text-eyebrow-primary` utility class.

- [ ] **Step 2: Run the mileage prompt tests**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/mileage-prompt.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Update any class-name assertions that referenced the old `rounded-xl p-3` or `focus:ring-[#00e5ff30]`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/vehicles/mileage-prompt-presentation.tsx frontend/src/components/vehicles/mileage-prompt.spec.tsx
git commit -m "restyle mileage prompt with correct sizing and focus ring"
```

---

## Task 11: Maintenance Card Row

**Files:**
- Modify: `frontend/src/components/maintenance-cards/maintenance-card-row.tsx`
- Modify: `frontend/src/components/maintenance-cards/maintenance-card-row.spec.tsx`

This is the largest task. It encodes the locked progress-fill formula, the single-sub-label rule, the healthy label color threshold, and the new geometry.

### Sub-task 11.a — Update spec file first (tests before impl)

- [ ] **Step 1: Replace old class-name assertions and add new tests**

Find these tests in `maintenance-card-row.spec.tsx` and replace them:

Old:
```typescript
  it('applies overdue classes when status is overdue', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('overdue');
    const { container } = render(<MaintenanceCardRow {...defaultProps} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('bg-destructive/10');
    expect(row.className).toContain('border-destructive/40');
  });

  it('applies warning classes when status is warning', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('warning');
    const { container } = render(<MaintenanceCardRow {...defaultProps} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('bg-yellow-50');
    expect(row.className).toContain('border-yellow-300');
  });

  it('does not apply overdue or warning classes when status is ok', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('ok');
    const { container } = render(<MaintenanceCardRow {...defaultProps} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).not.toContain('bg-destructive/10');
    expect(row.className).not.toContain('bg-yellow-50');
  });
```

New:
```typescript
  it('applies overdue dark classes when status is overdue', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('overdue');
    const { container } = render(<MaintenanceCardRow {...defaultProps} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('bg-[#ff44440a]');
    expect(row.className).toContain('border-[#ff444328]');
  });

  it('applies warning dark classes when status is warning', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('warning');
    const { container } = render(<MaintenanceCardRow {...defaultProps} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('border-[#f59e0b28]');
  });

  it('applies healthy dark classes when status is ok', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('ok');
    const { container } = render(<MaintenanceCardRow {...defaultProps} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('border-[#00e5ff15]');
    expect(row.className).not.toContain('bg-[#ff44440a]');
  });

  it('renders a progress bar track when nextDueMileage is set', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 51000 }}
      />,
    );
    const track = document.querySelector('.bg-\\[\\#1a1a2e\\]');
    expect(track).toBeInTheDocument();
  });

  it('renders progress bar at 100% width when card is overdue', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('overdue');
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 49000 }}
      />,
    );
    const fill = document.querySelector('[style*="width: 100%"]');
    expect(fill).toBeInTheDocument();
  });

  it('does not render a progress bar when nextDueMileage is null', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null }}
      />,
    );
    const track = document.querySelector('.bg-\\[\\#1a1a2e\\]');
    expect(track).not.toBeInTheDocument();
  });

  it('renders "N unit past due" sub-label when overdue', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('overdue');
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 49880 }}
      />,
    );
    // currentMileage is 50000 in defaultProps mockVehicle
    expect(screen.getByText(/past due/i)).toBeInTheDocument();
  });

  it('renders "N unit left" sub-label when warning or healthy', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('ok');
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 52000 }}
      />,
    );
    expect(screen.getByText(/left/i)).toBeInTheDocument();
  });

  it('does not render "On track" text below the progress bar', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('ok');
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 52000 }}
      />,
    );
    expect(screen.queryByText(/on track/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/within warning threshold/i)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to confirm the new ones fail**

```bash
cd frontend && pnpm exec vitest run src/components/maintenance-cards/maintenance-card-row.spec.tsx --reporter=verbose 2>&1 | tail -30
```

Expected: multiple failures in the new tests until Step 3 lands.

### Sub-task 11.b — Implement the component

- [ ] **Step 3: Replace `maintenance-card-row.tsx`**

Overwrite `frontend/src/components/maintenance-cards/maintenance-card-row.tsx`:

```typescript
'use client';

import type { IMaintenanceCardResDTO, IVehicleResDTO } from '@project/types';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { getCardWarningStatus } from '@/lib/warning';
import type { CardWarningStatus } from '@/lib/warning';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MILES_TO_KM = 1.60934;

const TYPE_LABELS: Record<IMaintenanceCardResDTO['type'], string> = {
  task: 'Task',
  part: 'Part',
  item: 'Item',
};

/**
 * Progress bar fill percentage (0–100).
 * Overdue: 100 (clamped — magnitude communicated via text).
 * Warning: linear 60→99 as remaining goes from threshold→0.
 * Healthy: linear 0→59 as remaining goes from (5 × threshold)→threshold. No floor.
 */
const getProgressFill = (params: {
  remaining: number | null;
  thresholdNative: number;
  status: CardWarningStatus;
}): number => {
  const { remaining, thresholdNative, status } = params;
  if (status === 'overdue') return 100;
  if (remaining === null) return 0;
  if (status === 'warning') {
    return 60 + ((thresholdNative - remaining) / thresholdNative) * 39;
  }
  // Healthy zone
  const lookahead = thresholdNative * 5;
  if (remaining >= lookahead) return 0;
  return (1 - remaining / lookahead) * 59;
};

/**
 * Healthy label color — muted when far from due, cyan when approaching warning zone.
 * Threshold: 3× warning threshold.
 */
const getHealthyLabelColor = (
  remaining: number,
  thresholdNative: number,
): 'primary' | 'muted' => {
  return remaining > 3 * thresholdNative ? 'muted' : 'primary';
};

interface MaintenanceCardRowProps {
  card: IMaintenanceCardResDTO;
  vehicle: IVehicleResDTO;
  isDropdownOpen: boolean;
  onDropdownToggle: (cardId: string | null) => void;
  onEdit: (card: IMaintenanceCardResDTO) => void;
  onMarkDone: (card: IMaintenanceCardResDTO) => void;
  onDelete: (card: IMaintenanceCardResDTO) => void;
}

export function MaintenanceCardRow({
  card,
  vehicle,
  isDropdownOpen,
  onDropdownToggle,
  onEdit,
  onMarkDone,
  onDelete,
}: MaintenanceCardRowProps) {
  const { data: config } = useAppConfig();
  const thresholdKm = config?.mileageWarningThresholdKm ?? 500;

  const status = getCardWarningStatus(
    card,
    vehicle.mileage,
    vehicle.mileageUnit,
    thresholdKm,
  );

  const thresholdNative =
    vehicle.mileageUnit === 'mile' ? thresholdKm / MILES_TO_KM : thresholdKm;

  const remaining =
    card.nextDueMileage !== null ? card.nextDueMileage - vehicle.mileage : null;

  const progressFill = getProgressFill({
    remaining,
    thresholdNative,
    status,
  });

  // Sub-label — single source for remaining-mileage text
  const subLabel = (() => {
    if (remaining === null) return null;
    if (status === 'overdue') {
      return `${Math.abs(Math.round(remaining)).toLocaleString()} ${vehicle.mileageUnit} past due`;
    }
    return `${Math.round(remaining).toLocaleString()} ${vehicle.mileageUnit} left`;
  })();

  // Healthy label color follows the 3× rule
  const labelColorClass = (() => {
    if (status === 'overdue') return 'text-[#ff4444]';
    if (status === 'warning') return 'text-[#f59e0b]';
    if (remaining === null) return 'text-[#555]';
    return getHealthyLabelColor(remaining, thresholdNative) === 'primary'
      ? 'text-[#00e5ff]'
      : 'text-[#555]';
  })();

  const containerClass = (() => {
    if (status === 'overdue') return 'bg-[#ff44440a] border-[#ff444328]';
    if (status === 'warning') return 'bg-[#0f1923] border-[#f59e0b28]';
    return 'bg-[#0f1923] border-[#00e5ff15]';
  })();

  const barClass = (() => {
    if (status === 'overdue') return 'bg-[#ff4444]';
    if (status === 'warning')
      return 'bg-gradient-to-r from-[#f59e0b60] to-[#f59e0b]';
    return 'bg-gradient-to-r from-[#00e5ff40] to-[#00e5ff]';
  })();

  return (
    <div
      className={cn(
        'relative rounded-lg border p-[9px] hover-pointer:bg-[#111d2b]',
        containerClass,
      )}
    >
      {/* Top row: name + type badge | sub-label + ⋮ */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-card-title truncate">{card.name}</p>
          <span className="inline-block mt-0.5 bg-[color:var(--bg-card)] border border-[#333] text-[color:var(--text-disabled)] text-[0.375rem] px-[4px] py-[1px] rounded">
            {TYPE_LABELS[card.type]}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {subLabel && (
            <span className={cn('text-[0.625rem] font-bold', labelColorClass)}>
              {subLabel}
            </span>
          )}

          {/* ⋮ action button */}
          <div className="relative">
            <Button
              variant="secondary"
              size="icon-xs"
              aria-label="actions"
              aria-haspopup="menu"
              aria-expanded={isDropdownOpen}
              onClick={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                onDropdownToggle(isDropdownOpen ? null : card.id);
              }}
              className="bg-[color:var(--bg-card)] border-[#333] text-[color:var(--text-disabled)]"
            >
              ⋮
            </Button>

            {isDropdownOpen && (
              <div
                role="menu"
                className="absolute right-0 top-6 z-10 min-w-[140px] rounded-xl border border-[#ffffff10] bg-[color:var(--bg-surface)] shadow-xl"
              >
                <button
                  role="menuitem"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkDone(card);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-[color:var(--bg-card)] rounded-t-xl"
                >
                  Mark Done
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(card);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-[color:var(--bg-card)]"
                >
                  Edit
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(card);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-destructive hover:bg-[color:var(--bg-card)] rounded-b-xl"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {remaining !== null && (
        <div className="mt-[5px] mb-[2px]">
          <div className="h-[3px] w-full bg-[#1a1a2e] rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', barClass)}
              style={{ width: `${Math.min(progressFill, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

Notes:
- Card geometry `rounded-lg p-[9px]` — blocker H4.
- `hover-pointer:bg-[#111d2b]` — blocker H3 (requires the `@custom-variant` declared in Task 1).
- Progress bar wrapper `mt-[5px] mb-[2px]` — blocker H5.
- Type badge `text-[0.375rem] px-[4px] py-[1px] border-[#333]` — blocker H2.
- `⋮` uses `<Button variant="secondary" size="icon-xs">` — blocker H1 + D4.
- Single sub-label in the header row only (no text below bar) — follow-up 5.2.
- `aria-haspopup="menu"` + `aria-expanded` + `role="menu"` + `role="menuitem"` — partial fix for follow-up 1.1 (keyboard nav + Escape remain deferred).
- Progress formula uses `lookahead = 5 × threshold`, no floor — follow-up 5.1.
- Healthy label color uses the 3× threshold rule — follow-up 4.4.

- [ ] **Step 4: Run tests**

```bash
cd frontend && pnpm exec vitest run src/components/maintenance-cards/maintenance-card-row.spec.tsx --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 5: Run the full frontend test suite**

```bash
cd frontend && pnpm exec vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/maintenance-cards/
git commit -m "add maintenance card progress bar, single sub-label, icon-xs action"
```

---

## Task 12: Dialog Shell

**Files:**
- Modify: `frontend/src/components/ui/dialog.tsx`

Introduces the mobile bottom-sheet pattern with a drag-handle grabber, and the centered-modal pattern on `sm:` and up. Swipe-to-dismiss is NOT implemented in this sprint — the grabber is affordance-only.

- [ ] **Step 1: Replace `dialog.tsx`**

Overwrite `frontend/src/components/ui/dialog.tsx`:

```typescript
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

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: DialogProps) {
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
}
```

Notes:
- Mobile: `items-end`, `rounded-t-2xl rounded-b-none`, drag handle visible.
- Tablet+: `sm:items-center`, `sm:rounded-2xl`, drag handle hidden.
- `pb-[calc(1.25rem+env(safe-area-inset-bottom))]` keeps content above iOS home indicator on mobile — follow-up 2.1.
- Global `body { font-family: var(--font-mono) }` is already set by Task 1, so no `font-mono` class needed here.

- [ ] **Step 2: Run dialog tests**

```bash
cd frontend && pnpm exec vitest run src/components/ui/dialog.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/dialog.tsx
git commit -m "restyle dialog with mobile bottom sheet grabber and centered tablet+"
```

---

## Task 13: Form Dialog Content Restyle

**Files:**
- Modify: `frontend/src/components/vehicles/vehicle-form-dialog.tsx`
- Modify: `frontend/src/components/maintenance-cards/maintenance-card-form-dialog.tsx`
- Modify: `frontend/src/components/maintenance-cards/mark-done-dialog.tsx`
- Modify: `frontend/src/components/vehicles/vehicle-delete-confirm-dialog.tsx`
- Modify: `frontend/src/components/maintenance-cards/delete-confirm-dialog.tsx`

Each form dialog needs: dark inputs, eyebrow labels, correct button variants. The DOM structure and React logic stays unchanged — only class names and Button variants are touched.

**Input style** (apply to every `<input>`, `<select>`, `<textarea>` inside these dialogs):

```
className="w-full rounded-lg border border-primary-dim bg-[color:var(--bg-base)] px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:ring-2 focus:ring-[#00e5ff40]"
```

**Label style** (apply to every label / field heading):

```tsx
<label className="text-eyebrow mb-1 block">{labelText}</label>
```

**Error text** (keep existing logic):

```tsx
<p className="text-destructive text-xs mt-1">{errorMessage}</p>
```

**Submit/Cancel buttons:**

```tsx
<div className="flex gap-2 mt-4">
  <Button type="button" variant="secondary" onClick={onCancel}>
    Cancel
  </Button>
  <Button type="submit" variant="default">
    {submitLabel}
  </Button>
</div>
```

**Destructive confirm button** (in `vehicle-delete-confirm-dialog.tsx` and `delete-confirm-dialog.tsx`):

```tsx
<Button type="button" variant="destructive" onClick={onConfirm}>
  Delete
</Button>
```

- [ ] **Step 1: Update `vehicle-form-dialog.tsx`**

Open the file. For each field:
- Replace the input className with the input style above.
- Replace label text with `<label className="text-eyebrow mb-1 block">...</label>`.

At the bottom, ensure the Cancel/Submit block uses `variant="secondary"` and `variant="default"`.

- [ ] **Step 2: Update `maintenance-card-form-dialog.tsx`**

Same pattern. Multiple numeric input fields — each gets the input style.

- [ ] **Step 3: Update `mark-done-dialog.tsx`**

Same pattern. The mileage confirmation input uses the input style. Confirm button uses `variant="default"`.

- [ ] **Step 4: Update `vehicle-delete-confirm-dialog.tsx`**

No inputs — this is a confirm dialog. Update the two buttons:
- Cancel: `variant="secondary"`
- Delete: `variant="destructive"`

- [ ] **Step 5: Update `delete-confirm-dialog.tsx` (maintenance card variant)**

Same as Step 4. Two buttons, same variants.

- [ ] **Step 6: Update existing spec assertions where needed**

For each dialog, run its spec:

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-form-dialog.spec.tsx src/components/maintenance-cards/maintenance-card-form-dialog.spec.tsx src/components/maintenance-cards/mark-done-dialog.spec.tsx src/components/vehicles/vehicle-delete-confirm-dialog.spec.tsx src/components/maintenance-cards/delete-confirm-dialog.spec.tsx --reporter=verbose 2>&1 | tail -50
```

Any assertion that references the old shadcn-white classes (e.g. `bg-white`, `text-gray-900`, `rounded-md` on inputs) must be updated to the new dark classes or replaced with a behavior assertion (e.g. "submitting the form calls `onSubmit` with the entered values"). Prefer behavior assertions over class-name assertions — they are more stable.

- [ ] **Step 7: Run the full frontend test suite**

```bash
cd frontend && pnpm exec vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/vehicles/vehicle-form-dialog.tsx frontend/src/components/vehicles/vehicle-delete-confirm-dialog.tsx frontend/src/components/maintenance-cards/maintenance-card-form-dialog.tsx frontend/src/components/maintenance-cards/mark-done-dialog.tsx frontend/src/components/maintenance-cards/delete-confirm-dialog.tsx
git commit -m "restyle form dialog contents with dark inputs and button variants"
```

---

## Task 14: Desktop Split Pane (Vehicle Detail)

**Files:**
- Create: `frontend/src/app/vehicles/layout.tsx`
- Create: `frontend/src/components/layout/vehicles-layout.tsx`
- Create: `frontend/src/components/layout/vehicles-layout.spec.tsx`

On desktop (`xl:` ≥ 1280px), `/vehicles/[id]` shows the vehicle list panel on the left and the detail content on the right. On smaller breakpoints, only the detail content renders (the left panel is `hidden`).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/layout/vehicles-layout.spec.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@/hooks/queries/vehicles/useVehicles', () => ({
  useVehicles: vi.fn(() => ({
    data: [
      {
        id: 'v1',
        name: 'Civic',
        colour: 'Red',
        mileage: 45000,
        mileageUnit: 'km',
        plateNumber: 'ABC123',
      },
    ],
    isLoading: false,
  })),
}));
vi.mock('@/hooks/queries/config/useAppConfig', () => ({
  useAppConfig: vi.fn(() => ({ data: { mileageWarningThresholdKm: 500 } })),
}));
vi.mock('@/hooks/queries/maintenance-cards/useMaintenanceCards', () => ({
  useMaintenanceCards: vi.fn(() => ({ data: [] })),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/vehicles/v1',
}));

import { VehiclesLayout } from './vehicles-layout';

describe('VehiclesLayout', () => {
  it('renders children', () => {
    render(
      <VehiclesLayout>
        <div>detail content</div>
      </VehiclesLayout>,
    );
    expect(screen.getByText('detail content')).toBeInTheDocument();
  });

  it('renders the vehicle list panel header', () => {
    render(
      <VehiclesLayout>
        <div>detail content</div>
      </VehiclesLayout>,
    );
    expect(screen.getByText(/your vehicles/i)).toBeInTheDocument();
  });

  it('renders a status chip for each vehicle in the list', () => {
    render(
      <VehiclesLayout>
        <div>detail content</div>
      </VehiclesLayout>,
    );
    // Zero overdue cards in the mock -> "ALL GOOD"
    expect(screen.getByText('ALL GOOD')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd frontend && pnpm exec vitest run src/components/layout/vehicles-layout.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `vehicles-layout.tsx`**

Create `frontend/src/components/layout/vehicles-layout.tsx`:

```typescript
'use client';

import type { FC, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { IVehicleResDTO } from '@project/types';
import { useVehicles } from '@/hooks/queries/vehicles/useVehicles';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import { countWarningCards } from '@/lib/warning';
import { getVehicleDisplayLabels } from '@/lib/vehicle-display';
import { VehicleStatusChip } from '@/components/vehicles/vehicle-status-chip';
import { cn } from '@/lib/utils';

type VehicleListItemProps = {
  vehicle: IVehicleResDTO;
  thresholdKm: number;
  isActive: boolean;
};

const VehicleListItem: FC<VehicleListItemProps> = ({
  vehicle,
  thresholdKm,
  isActive,
}) => {
  const { data: cards = [] } = useMaintenanceCards(vehicle.id);
  const warningCount = countWarningCards(
    cards,
    vehicle.mileage,
    vehicle.mileageUnit,
    thresholdKm,
  );
  const { primary } = getVehicleDisplayLabels(vehicle);

  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      className={cn(
        'block rounded-xl border px-3 py-2.5 transition-colors',
        isActive
          ? 'bg-[color:var(--bg-card)] border-[#00e5ff30] text-white'
          : 'bg-transparent border-[#ffffff10] text-[#888] hover-pointer:bg-[color:var(--bg-card)] hover-pointer:text-white',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-card-title truncate">{primary}</p>
          <p className="text-meta truncate">
            {vehicle.mileage.toLocaleString()} {vehicle.mileageUnit}
          </p>
        </div>
        <VehicleStatusChip count={warningCount} />
      </div>
    </Link>
  );
};

type VehiclesLayoutProps = {
  children: ReactNode;
};

export const VehiclesLayout: FC<VehiclesLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: config } = useAppConfig();
  const thresholdKm = config?.mileageWarningThresholdKm ?? 0;

  return (
    <div className="flex min-h-screen">
      {/* Desktop-only vehicle list panel */}
      <aside className="hidden xl:flex flex-col w-[220px] flex-shrink-0 border-r border-[#ffffff10] bg-[color:var(--bg-base)] px-3 py-4 overflow-y-auto">
        <p className="text-eyebrow mb-3 px-1">YOUR VEHICLES</p>
        {isLoading ? (
          <p className="text-[#444] text-xs px-1">Loading…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {vehicles.map((vehicle) => (
              <VehicleListItem
                key={vehicle.id}
                vehicle={vehicle}
                thresholdKm={thresholdKm}
                isActive={pathname === `/vehicles/${vehicle.id}`}
              />
            ))}
          </div>
        )}
      </aside>

      {/* Detail content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
};
```

Key points:
- Desktop gate is `xl:flex` (1280px) — blocker B1.
- Uses the shared `VehicleStatusChip` — blocker I1.
- No text-only "N overdue" — the chip handles both states.

- [ ] **Step 4: Create the Next.js segment layout**

Create `frontend/src/app/vehicles/layout.tsx`:

```typescript
import type { ReactNode } from 'react';
import { VehiclesLayout } from '@/components/layout/vehicles-layout';

export default function VehiclesSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <VehiclesLayout>{children}</VehiclesLayout>;
}
```

- [ ] **Step 5: Run tests**

```bash
cd frontend && pnpm exec vitest run src/components/layout/vehicles-layout.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/vehicles/ frontend/src/components/layout/vehicles-layout.tsx frontend/src/components/layout/vehicles-layout.spec.tsx
git commit -m "add desktop split pane for vehicle detail with shared status chip"
```

---

## Task 15: Placeholder Routes for History and Profile

**Files:**
- Create: `frontend/src/app/history/page.tsx`
- Create: `frontend/src/app/profile/page.tsx`

Nav items exist in `AppShellPresentation` for Fleet, History, and Profile. History and Profile have no real features this sprint but MUST have routes so clicks don't 404.

- [ ] **Step 1: Create `history/page.tsx`**

Create `frontend/src/app/history/page.tsx`:

```typescript
'use client';

import { AuthGuard } from '@/components/auth/auth-guard';

const HistoryContent = () => (
  <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
    <p className="text-eyebrow mb-2">HISTORY</p>
    <p className="text-[color:var(--text-muted)] text-sm">Coming soon.</p>
  </main>
);

export default function HistoryPage() {
  return (
    <AuthGuard>
      <HistoryContent />
    </AuthGuard>
  );
}
```

- [ ] **Step 2: Create `profile/page.tsx`**

Create `frontend/src/app/profile/page.tsx`:

```typescript
'use client';

import { AuthGuard } from '@/components/auth/auth-guard';

const ProfileContent = () => (
  <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
    <p className="text-eyebrow mb-2">PROFILE</p>
    <p className="text-[color:var(--text-muted)] text-sm">Coming soon.</p>
  </main>
);

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
```

- [ ] **Step 3: Run the full frontend test suite**

```bash
cd frontend && pnpm exec vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 4: Run format and lint**

```bash
cd /Users/leejianhong/projects/personal-project/maintenance-tracker && just format && just lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/history/ frontend/src/app/profile/
git commit -m "add History and Profile placeholder routes"
```

---

## Post-Implementation Verification

- [ ] **Start the dev server:**

```bash
cd /Users/leejianhong/projects/personal-project/maintenance-tracker && just up-build
```

- [ ] **Browser checks:**

Open `http://localhost:3000` and verify at three viewport widths:

**Mobile (375px × 667px):**
- Login page: 52px logo mark, radial glow visible, cyan CTA, 0.5rem terms text
- Fleet home: single-column vehicle grid, bottom tab bar visible, sidebar hidden
- Vehicle detail: back arrow functional (tap returns to fleet), Edit + Delete (red outline), dashed-ghost add card button
- Alert pill shows "1 ITEM NEEDS ATTENTION" (not "ITEMS") when exactly one warning exists
- Maintenance card: progress bar visible, single sub-label in top-right, no "On track" text below bar
- Dialog: bottom sheet with visible drag-handle grabber, rounded top only
- Bottom tab bar sits above iOS home indicator safe area (check in iOS simulator if available)
- Tap a History or Profile tab — does NOT 404, shows "Coming soon"

**Tablet (900px × 1200px):**
- Icon sidebar visible (52px wide), labels BELOW icons, no absolute edge bar
- Bottom tab bar hidden
- Fleet home: 2-column vehicle grid
- Dialog: centered, fully rounded, no drag handle

**Desktop (1440px × 900px):**
- Full sidebar visible (140px wide), labels side-by-side with icons
- User display name visible at bottom of sidebar
- Fleet home: 3-column vehicle grid
- Vehicle detail: split pane — left panel shows all vehicles with status chips, right panel shows detail. Back-nav block is hidden. Selecting a vehicle in the left panel highlights it and updates the right panel.
- Maintenance card `⋮` button: 16×16px, correct border color

- [ ] **Keyboard / interaction checks:**
- Tab through the shell — focus rings visible on all buttons and nav links
- Open a dropdown via `⋮` button — screen reader announces "actions, menu, expanded"
- Open a dialog — Escape closes it

- [ ] **Close the dev server and confirm no new lint/type errors**

```bash
just lint
```

---

## Executive Notes

1. **Task 1 lands before everything else.** Tokens and typography utilities cascade. Downstream tasks consume `text-page-title`, `text-eyebrow`, `bg-primary`, `border-border-accent`, etc.
2. **Task 2 (Button) and Task 3 (helpers + chip) land next.** Later tasks reference `variant="dashed-ghost"`, `variant="secondary-destructive"`, `size="icon-xs"`, `getVehicleMetaLine`, and `<VehicleStatusChip>` — those primitives MUST exist first.
3. **`hover-pointer:` classes only work if Task 1 landed the `@custom-variant` declaration.** Task 7 (VehicleCard) and Task 11 (MaintenanceCardRow) both use `hover-pointer:bg-[#111d2b]`. That class is registered in `globals.css` via `@custom-variant hover-pointer (&:where(@media (hover: hover) and (pointer: fine)):hover)`. If hover doesn't trigger on desktop after Task 7, verify Task 1's CSS actually contains that line.
4. **Task 9 and Task 14 interlock.** The desktop back-nav is hidden on `xl:` in Task 9; Task 14 delivers the replacement (vehicle list panel). Land them in order: Task 9 first (back nav hidden on `xl:`), Task 14 second (split pane appears).
5. **Update tests before component changes.** Task 11 explicitly replaces old class-name assertions before rewriting the component. Apply the same pattern in Task 13 — update or delete class-name assertions ahead of each file touch.
6. **Three inline duplicates = time for a primitive.** If you find yourself copying the same dashed-ghost button markup or the same "ALL GOOD / N OVERDUE" chip by hand in any future task, stop — use the existing `<Button variant="dashed-ghost">` and `<VehicleStatusChip>`.
7. **Deferred items are spec'd out, not in this plan.** See `docs/superpowers/specs/2026-04-14-ui-redesign-design.md` "Deferred Items" section for the follow-up inbox: dropdown/dialog a11y, sticky mobile hover isolation, skeleton shell, animation system, progress bar extraction, empty states, Google user photo, sort preference persistence.

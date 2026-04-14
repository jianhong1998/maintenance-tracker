# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the frontend from stock shadcn/ui white to a Dark Terminal aesthetic with Electric Cyan accent, mobile-first responsive layout, and progress-bar maintenance cards.

**Architecture:** All changes are pure frontend styling — no backend, no new routes, no new data. A new `AppShell` component is added to `layout.tsx` to provide responsive navigation (bottom tab bar on mobile, icon sidebar on tablet, full sidebar on desktop). CSS design tokens in `globals.css` cascade all color changes automatically through Tailwind's token system.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, shadcn/ui components, lucide-react icons, class-variance-authority (CVA)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `frontend/src/app/globals.css` | Modify | Replace all color tokens with dark palette, remove `.dark` block |
| `frontend/src/components/ui/button.tsx` | Modify | Clean up `dark:` variant prefixes, verify tokens apply correctly |
| `frontend/src/components/layout/app-shell.tsx` | **Create** | Client component: reads auth + pathname, passes to presentation |
| `frontend/src/components/layout/app-shell-presentation.tsx` | **Create** | Renders responsive shell: bottom tab bar / icon sidebar / full sidebar |
| `frontend/src/components/layout/app-shell-presentation.spec.tsx` | **Create** | Tests for AppShell nav visibility and structure |
| `frontend/src/app/layout.tsx` | Modify | Wrap `{children}` in `<AppShell>` inside `<AuthProvider>` |
| `frontend/src/app/login/page.tsx` | Modify | Logo mark, glow, dark centered layout |
| `frontend/src/components/pages/home-page.tsx` | Modify | Header gradient, alert pill, vehicle grid layout |
| `frontend/src/components/vehicles/vehicle-card.tsx` | Modify | Dark card, status badge chips, chevron, hover state |
| `frontend/src/components/pages/vehicle-dashboard-page.tsx` | Modify | Header gradient, edit/delete button styles, sort toggle |
| `frontend/src/components/vehicles/mileage-prompt-presentation.tsx` | Modify | Dark input, cyan OK button, eyebrow label |
| `frontend/src/components/maintenance-cards/maintenance-card-row.tsx` | Modify | Progress bar per card, ⋮ action button restyle, status variants |
| `frontend/src/components/maintenance-cards/maintenance-card-row.spec.tsx` | Modify | Add tests for progress bar rendering and ⋮ button presence |
| `frontend/src/components/ui/dialog.tsx` | Modify | Dark overlay backdrop, dark surface (`bg-[#0d1117]`), cyan title accent |
| `frontend/src/app/vehicles/layout.tsx` | **Create** | Next.js segment layout — wraps `/vehicles/*` pages in `VehiclesLayout` |
| `frontend/src/components/layout/vehicles-layout.tsx` | **Create** | Desktop split pane: vehicle list panel (left) + page content (right) |
| `frontend/src/components/layout/vehicles-layout.spec.tsx` | **Create** | Tests for VehiclesLayout rendering |

---

## Task 1: CSS Design Tokens

**Files:**
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Replace the entire `globals.css` with the new dark token set**

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: 0.625rem;
  --background: #07090f;
  --foreground: #ffffff;
  --card: #0f1923;
  --card-foreground: #ffffff;
  --popover: #0d1117;
  --popover-foreground: #ffffff;
  --primary: #00e5ff;
  --primary-foreground: #07090f;
  --secondary: #0f1923;
  --secondary-foreground: #aaaaaa;
  --muted: #0d1117;
  --muted-foreground: #888888;
  --accent: #0f1923;
  --accent-foreground: #ffffff;
  --destructive: #ff4444;
  --destructive-foreground: #ffffff;
  --border: rgba(255, 255, 255, 0.06);
  --input: #0f1923;
  --ring: rgba(0, 229, 255, 0.25);
  --chart-1: #00e5ff;
  --chart-2: #0066ff;
  --chart-3: #f59e0b;
  --chart-4: #ff4444;
  --chart-5: #22c55e;
  --sidebar: #0d1117;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #00e5ff;
  --sidebar-primary-foreground: #07090f;
  --sidebar-accent: #0f1923;
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: rgba(255, 255, 255, 0.05);
  --sidebar-ring: rgba(0, 229, 255, 0.25);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "replace color tokens with dark terminal palette"
```

---

## Task 2: Button Component

**Files:**
- Modify: `frontend/src/components/ui/button.tsx`

- [ ] **Step 1: Update `buttonVariants` to remove `dark:` prefixes and use dark-compatible styles**

Replace the entire `buttonVariants` definition:

```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground font-bold tracking-wide shadow-xs hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20',
        outline:
          'border border-white/10 bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground border border-white/10 shadow-xs hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
```

- [ ] **Step 2: Run existing tests to verify no regressions**

```bash
cd frontend && pnpm exec vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/button.tsx
git commit -m "clean up button variants for dark-only theme"
```

---

## Task 3: AppShell Component

**Files:**
- Create: `frontend/src/components/layout/app-shell-presentation.tsx`
- Create: `frontend/src/components/layout/app-shell.tsx`
- Create: `frontend/src/components/layout/app-shell-presentation.spec.tsx`

- [ ] **Step 1: Write the failing test for `AppShellPresentation`**

Create `frontend/src/components/layout/app-shell-presentation.spec.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { AppShellPresentation } from './app-shell-presentation';

describe('AppShellPresentation', () => {
  it('renders children without nav when showNav is false', () => {
    render(
      <AppShellPresentation showNav={false} pathname="/login">
        <div>page content</div>
      </AppShellPresentation>,
    );
    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('renders children and nav when showNav is true', () => {
    render(
      <AppShellPresentation showNav={true} pathname="/">
        <div>page content</div>
      </AppShellPresentation>,
    );
    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('marks Fleet tab as active when pathname is /', () => {
    render(
      <AppShellPresentation showNav={true} pathname="/">
        <div>page content</div>
      </AppShellPresentation>,
    );
    const fleetLinks = screen.getAllByRole('link', { name: /fleet/i });
    expect(fleetLinks.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd frontend && pnpm exec vitest run src/components/layout/app-shell-presentation.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `AppShellPresentation` not found.

- [ ] **Step 3: Create `app-shell-presentation.tsx`**

Create `frontend/src/components/layout/app-shell-presentation.tsx`:

```typescript
import { FC } from 'react';
import Link from 'next/link';
import { Car, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type AppShellPresentationProps = {
  showNav: boolean;
  pathname: string;
  children: React.ReactNode;
};

type NavItemConfig = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const NAV_ITEMS: NavItemConfig[] = [
  { href: '/', label: 'Fleet', icon: Car },
  { href: '/history', label: 'History', icon: Clock },
];

export const AppShellPresentation: FC<AppShellPresentationProps> = ({
  showNav,
  pathname,
  children,
}) => {
  if (!showNav) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#07090f]">
      {/* Tablet + Desktop: left sidebar */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 z-40 w-[52px] lg:w-[140px] bg-[#0d1117] border-r border-white/5">
        {/* Logo */}
        <div className="flex items-center gap-2 p-3 py-4">
          <div className="w-7 h-7 flex-shrink-0 rounded-lg bg-gradient-to-br from-[#00e5ff] to-[#0066ff]" />
          <span className="hidden lg:block text-[#00e5ff] text-[0.6rem] font-bold tracking-[0.18em] font-mono">
            MTRACK
          </span>
        </div>

        {/* Nav items */}
        <nav role="navigation" className="flex flex-col gap-1 px-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-md p-2 transition-colors',
                  active
                    ? 'bg-[#00e5ff12] text-[#00e5ff]'
                    : 'text-[#444] hover:bg-[#0f1923] hover:text-[#888]',
                )}
              >
                {active && (
                  <span className="hidden md:block lg:hidden absolute left-0 w-0.5 h-5 bg-[#00e5ff] rounded-r" />
                )}
                <Icon size={16} className="flex-shrink-0" />
                <span className="hidden lg:block text-xs font-semibold">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User avatar at bottom */}
        <div className="mt-auto p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex-shrink-0 rounded-full bg-[#0f1923] border border-white/10 flex items-center justify-center">
              <User size={14} className="text-[#444]" />
            </div>
            <span className="hidden lg:block text-[#444] text-xs">Profile</span>
          </div>
        </div>
      </aside>

      {/* Page content */}
      <div className="flex-1 md:ml-[52px] lg:ml-[140px] pb-12 md:pb-0">
        {children}
      </div>

      {/* Mobile: bottom tab bar */}
      <nav
        role="navigation"
        className="md:hidden fixed bottom-0 inset-x-0 h-12 bg-[#0d1117] border-t border-white/5 flex items-center justify-around z-40 px-4"
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1 px-3 transition-colors',
                active ? 'text-[#00e5ff]' : 'text-[#444]',
              )}
            >
              {active && (
                <span className="w-1 h-1 rounded-full bg-[#00e5ff] mb-0.5" />
              )}
              <Icon size={16} />
              <span className="text-[0.55rem] font-semibold tracking-wide">{label}</span>
            </Link>
          );
        })}
        <Link
          href="#"
          className="flex flex-col items-center gap-0.5 py-1 px-3 text-[#444]"
        >
          <User size={16} />
          <span className="text-[0.55rem] font-semibold tracking-wide">Profile</span>
        </Link>
      </nav>
    </div>
  );
};
```

- [ ] **Step 4: Create `app-shell.tsx`**

Create `frontend/src/components/layout/app-shell.tsx`:

```typescript
'use client';

import { FC } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthContext } from '@/contexts/auth-context';
import { AppShellPresentation } from './app-shell-presentation';

type AppShellProps = {
  children: React.ReactNode;
};

export const AppShell: FC<AppShellProps> = ({ children }) => {
  const { user, loading } = useAuthContext();
  const pathname = usePathname();

  const showNav = !loading && !!user && pathname !== '/login';

  return (
    <AppShellPresentation showNav={showNav} pathname={pathname}>
      {children}
    </AppShellPresentation>
  );
};
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
cd frontend && pnpm exec vitest run src/components/layout/app-shell-presentation.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/
git commit -m "add responsive AppShell with bottom tab / icon sidebar / full sidebar"
```

---

## Task 4: Wire AppShell into Root Layout

**Files:**
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Add `AppShell` import and wrap children**

Replace the contents of `frontend/src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { ConfigProvider } from '@/components/providers/config-provider';
import { ReactQueryProvider } from '@/components/providers/react-query-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { AppShell } from '@/components/layout/app-shell';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Maintenance Tracker',
  description: 'Track your vehicle maintenance schedules',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const backendUrl =
    process.env.FRONTEND_BACKEND_BASE_URL ?? 'http://localhost:3001';

  return (
    <html lang="en">
      <body>
        <ConfigProvider backendUrl={backendUrl}>
          <ReactQueryProvider>
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </ReactQueryProvider>
        </ConfigProvider>
        <Toaster
          position="top-right"
          duration={5000}
          theme="dark"
        />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Run all frontend tests to check for regressions**

```bash
cd frontend && pnpm exec vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/layout.tsx
git commit -m "integrate AppShell into root layout"
```

---

## Task 5: Login Page

**Files:**
- Modify: `frontend/src/app/login/page.tsx`

- [ ] **Step 1: Replace the login page JSX**

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
    <main className="flex min-h-screen items-center justify-center bg-[#07090f] px-6">
      <div className="flex flex-col items-center gap-6 w-full max-w-xs">
        {/* Logo mark with ambient glow */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-32 h-32 rounded-full bg-[#00e5ff08] blur-2xl" />
          <div className="relative w-14 h-14 rounded-2xl border border-[#00e5ff30] bg-[#00e5ff08] flex items-center justify-center">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00e5ff] to-[#0066ff]" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <p className="text-[#00e5ff] text-[0.6rem] font-mono font-bold tracking-[0.3em] mb-1">
            MAINTENANCE
          </p>
          <h1 className="text-white text-2xl font-extrabold tracking-tight">
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
            className="w-full font-mono text-xs tracking-widest"
            onClick={() => void handleSignIn()}
            disabled={loading || isSigningIn}
          >
            {isSigningIn ? 'SIGNING IN...' : 'SIGN IN WITH GOOGLE'}
          </Button>

          {signInError && (
            <p className="text-destructive text-xs text-center">{signInError}</p>
          )}
        </div>

        <p className="text-[#333] text-[0.6rem] text-center">
          By signing in you agree to our Terms of Service
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Run the login page tests**

```bash
cd frontend && pnpm exec vitest run src/app/login/page.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass (tests check behaviour, not class names).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/login/page.tsx
git commit -m "restyle login page with dark terminal aesthetic"
```

---

## Task 6: Vehicle Card

**Files:**
- Modify: `frontend/src/components/vehicles/vehicle-card.tsx`

- [ ] **Step 1: Replace vehicle card JSX**

```typescript
'use client';

import { FC } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { IVehicleResDTO } from '@project/types';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import { countWarningCards } from '@/lib/warning';
import { getVehicleDisplayLabels } from '@/lib/vehicle-display';
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

  const { primary, secondary } = getVehicleDisplayLabels(vehicle);
  const hasWarning = warningCount > 0;

  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      className={cn(
        'block rounded-xl border p-3 transition-colors hover:bg-[#111d2b]',
        hasWarning
          ? 'bg-[#0f1923] border-[#ff444328]'
          : 'bg-[#0f1923] border-white/5',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-sm text-white truncate">{primary}</p>
          {secondary && (
            <p className="text-[#888] text-xs truncate">{secondary}</p>
          )}
          <p className="text-[#888] text-xs">
            {vehicle.mileage.toLocaleString()} {vehicle.mileageUnit}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {hasWarning ? (
            <span className="bg-[#ff444418] border border-[#ff444440] text-[#ff4444] text-[0.6rem] font-mono font-bold px-1.5 py-0.5 rounded">
              {warningCount} OVERDUE
            </span>
          ) : (
            <span className="bg-[#00e5ff10] border border-[#00e5ff25] text-[#00e5ff] text-[0.6rem] font-mono font-bold px-1.5 py-0.5 rounded">
              ALL GOOD
            </span>
          )}
          <ChevronRight size={14} className="text-[#444]" />
        </div>
      </div>
    </Link>
  );
};
```

- [ ] **Step 2: Run vehicle card tests**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-card.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/vehicles/vehicle-card.tsx
git commit -m "restyle vehicle card with dark surface and status badges"
```

---

## Task 7: Home Page

**Files:**
- Modify: `frontend/src/components/pages/home-page.tsx`

- [ ] **Step 1: Replace home page JSX**

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

const HomeContent = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: config } = useAppConfig();
  const thresholdKm = config?.mileageWarningThresholdKm ?? 0;
  const globalWarningCount = useGlobalWarningCount(vehicles, thresholdKm);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#0d1117] to-[#07090f] px-4 pt-4 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00e5ff] to-[#0066ff] md:hidden" />
          <div className="w-7 h-7 rounded-full bg-[#0f1923] border border-white/10 flex items-center justify-center ml-auto md:ml-0">
            <User size={14} className="text-[#444]" />
          </div>
        </div>
        <p className="text-[#888] text-[0.6rem] font-mono tracking-[0.2em] mb-0.5">
          FLEET OVERVIEW
        </p>
        <h1 className="text-white text-xl font-extrabold">Your Vehicles</h1>

        {!isLoading && vehicles.length > 0 && globalWarningCount > 0 && (
          <div className="inline-flex items-center gap-2 mt-3 bg-[#ff44440d] border border-[#ff444330] rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff4444] flex-shrink-0" />
            <span className="text-[#ff4444] text-[0.6rem] font-mono font-bold">
              {globalWarningCount}{' '}
              {globalWarningCount === 1 ? 'ITEM' : 'ITEMS'} NEED ATTENTION
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {isLoading ? (
          <p className="text-[#555] text-sm font-mono">Loading vehicles…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  thresholdKm={thresholdKm}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex w-full items-center justify-center rounded-xl border border-dashed border-[#00e5ff20] py-4 text-[#00e5ff] text-sm font-mono font-bold hover:bg-[#00e5ff08] transition-colors"
            >
              + ADD VEHICLE
            </button>
          </>
        )}
      </div>

      <VehicleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
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

- [ ] **Step 2: Run home page tests**

```bash
cd frontend && pnpm exec vitest run src/components/pages/home-page.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/pages/home-page.tsx
git commit -m "restyle home page with fleet header and dark vehicle grid"
```

---

## Task 8: Vehicle Dashboard Page

**Files:**
- Modify: `frontend/src/components/pages/vehicle-dashboard-page.tsx`
- Modify: `frontend/src/components/vehicles/mileage-prompt-presentation.tsx`

- [ ] **Step 1: Replace mileage prompt presentation JSX**

```typescript
import { FC } from 'react';
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
    <div className="rounded-xl border border-[#00e5ff20] bg-[#0f1923] p-3">
      <p className="text-[#00e5ff] text-[0.6rem] font-mono font-bold tracking-[0.15em] mb-2.5">
        UPDATE ODOMETER
      </p>
      {isError && (
        <p className="text-destructive mb-2 text-xs font-mono">
          Failed to update mileage. Please try again.
        </p>
      )}
      {isBelowCurrent && (
        <p className="text-destructive mb-2 text-xs font-mono">
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
          className="flex-1 rounded-lg border border-[#00e5ff20] bg-[#07090f] px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:ring-2 focus:ring-[#00e5ff30]"
        />
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={isSubmitDisabled}
          className="font-mono text-xs font-bold tracking-widest"
        >
          OK
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="text-[#555] font-mono text-xs"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Replace vehicle dashboard page JSX**

Replace the `DashboardContent` component and everything below in `vehicle-dashboard-page.tsx`. Keep all imports and the existing logic (state, hooks, handlers) — only update the JSX returned by `DashboardContent`:

```typescript
  return (
    <div className="flex flex-col min-h-screen">
      {/* Vehicle header */}
      <div className="bg-gradient-to-b from-[#0d1117] to-[#07090f] px-4 pt-4 pb-5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <p className="text-[#00e5ff] text-[0.6rem] font-mono tracking-[0.15em] mb-0.5">
              ← FLEET
            </p>
            <h1 className="text-white text-xl font-extrabold truncate">{primary}</h1>
            {secondary && (
              <p className="text-[#555] text-xs">{secondary}</p>
            )}
            <p className="text-[#555] text-xs">
              {vehicle.colour} &middot; {vehicle.mileage.toLocaleString()}{' '}
              {vehicle.mileageUnit}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0 pt-1">
            <Button
              size="sm"
              variant="secondary"
              aria-label="Edit vehicle"
              onClick={() => setEditVehicleOpen(true)}
              className="font-mono text-xs"
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              aria-label="Delete vehicle"
              onClick={() => setDeleteVehicleOpen(true)}
              className="font-mono text-xs text-destructive border-[#ff444330] hover:text-destructive"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        <MileagePrompt
          vehicleId={vehicleId}
          currentMileage={vehicle.mileage}
          mileageLastUpdatedAt={vehicle.mileageLastUpdatedAt}
        />

        {/* Sort toggle */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={sort === 'urgency' ? 'default' : 'secondary'}
            onClick={() => setSort('urgency')}
            className="font-mono text-xs tracking-widest"
          >
            URGENCY
          </Button>
          <Button
            size="sm"
            variant={sort === 'name' ? 'default' : 'secondary'}
            onClick={() => setSort('name')}
            className="font-mono text-xs tracking-widest"
          >
            NAME
          </Button>
        </div>

        {/* Card list */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-label="Add maintenance card"
            onClick={() => setCreateOpen(true)}
            className="flex w-full items-center justify-center rounded-xl border border-dashed border-[#00e5ff20] py-4 text-[#00e5ff] text-sm font-mono font-bold hover:bg-[#00e5ff08] transition-colors"
          >
            + ADD MAINTENANCE CARD
          </button>

          {cardsLoading ? (
            <p className="text-[#555] text-sm font-mono">Loading cards…</p>
          ) : cards.length === 0 ? (
            <p className="text-[#555] text-sm font-mono">No maintenance cards yet.</p>
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
          onOpenChange={(open) => { if (!open) setMarkingDoneCard(null); }}
          card={markingDoneCard}
          vehicleId={vehicleId}
          currentMileage={vehicle.mileage}
        />
      )}

      {deletingCard && (
        <DeleteConfirmDialog
          open={true}
          onOpenChange={(open) => { if (!open) setDeletingCard(null); }}
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

- [ ] **Step 3: Run dashboard and mileage prompt tests**

```bash
cd frontend && pnpm exec vitest run src/components/pages/vehicle-dashboard-page.spec.tsx src/components/vehicles/mileage-prompt.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/pages/vehicle-dashboard-page.tsx frontend/src/components/vehicles/mileage-prompt-presentation.tsx
git commit -m "restyle vehicle dashboard and mileage prompt"
```

---

## Task 9: Maintenance Card Row (Progress Bar)

**Files:**
- Modify: `frontend/src/components/maintenance-cards/maintenance-card-row.tsx`
- Modify: `frontend/src/components/maintenance-cards/maintenance-card-row.spec.tsx`

- [ ] **Step 1: Update existing tests that check old class names, and add progress bar tests**

The existing spec at lines 88–109 checks for old Tailwind class names (`bg-destructive/10`, `bg-yellow-50`, etc.) that will change. Replace those tests and add progress bar coverage.

Find this block in `maintenance-card-row.spec.tsx`:

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

Replace with:

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

  it('renders a progress bar element when nextDueMileage is set', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 51000 }}
      />,
    );
    // Progress bar track is a div with known bg class
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
```

Run to confirm the new tests fail (old class names no longer exist yet):

```bash
cd frontend && pnpm exec vitest run src/components/maintenance-cards/maintenance-card-row.spec.tsx --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 2: Replace `maintenance-card-row.tsx` with progress bar implementation**

```typescript
'use client';

import type { IMaintenanceCardResDTO, IVehicleResDTO } from '@project/types';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { getCardWarningStatus } from '@/lib/warning';
import type { CardWarningStatus } from '@/lib/warning';
import { cn } from '@/lib/utils';

const MILES_TO_KM = 1.60934;

const TYPE_LABELS: Record<IMaintenanceCardResDTO['type'], string> = {
  task: 'Task',
  part: 'Part',
  item: 'Item',
};

/** Returns fill percentage (0–100) for the progress bar. */
const getProgressFill = (
  remaining: number | null,
  thresholdNative: number,
  status: CardWarningStatus,
): number => {
  if (status === 'overdue') return 100;
  if (remaining === null) return 0;
  if (status === 'warning') {
    // Warning zone: 60–99%
    return 60 + ((thresholdNative - remaining) / thresholdNative) * 39;
  }
  // Healthy zone: 3–59% based on proximity to threshold (lookahead = 10× threshold)
  const lookahead = thresholdNative * 10;
  return Math.max(3, (1 - Math.min(remaining, lookahead) / lookahead) * 59);
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

  const progressFill = getProgressFill(remaining, thresholdNative, status);

  const mileageLabel = (() => {
    if (remaining === null) return null;
    if (remaining <= 0) return 'OVERDUE';
    return `${Math.round(remaining).toLocaleString()} ${vehicle.mileageUnit} left`;
  })();

  const statusStyles = {
    overdue: {
      card: 'bg-[#ff44440a] border-[#ff444328]',
      bar: 'bg-[#ff4444]',
      label: 'text-[#ff4444]',
    },
    warning: {
      card: 'bg-[#0f1923] border-[#f59e0b28]',
      bar: 'bg-gradient-to-r from-[#f59e0b60] to-[#f59e0b]',
      label: 'text-[#f59e0b]',
    },
    ok: {
      card: 'bg-[#0f1923] border-[#00e5ff15]',
      bar: 'bg-gradient-to-r from-[#00e5ff40] to-[#00e5ff]',
      label: 'text-[#00e5ff]',
    },
  } as const;

  const styles = statusStyles[status];

  return (
    <div className={cn('relative rounded-xl border p-3', styles.card)}>
      {/* Top row: name + type badge on left, status label + ⋮ on right */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div>
          <p className="text-white text-sm font-bold">{card.name}</p>
          <span className="inline-block bg-[#0d1117] border border-white/10 text-[#555] text-[0.55rem] font-mono px-1.5 py-0.5 rounded mt-0.5">
            {TYPE_LABELS[card.type]}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {mileageLabel && (
            <span className={cn('text-[0.65rem] font-mono font-bold', styles.label)}>
              {mileageLabel}
            </span>
          )}

          {/* ⋮ action button */}
          <div className="relative">
            <button
              type="button"
              aria-label="actions"
              onClick={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                onDropdownToggle(isDropdownOpen ? null : card.id);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-[#0d1117] text-[#555] hover:text-white hover:border-white/20 transition-colors"
            >
              ⋮
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 top-8 z-10 min-w-[140px] rounded-xl border border-white/10 bg-[#0d1117] shadow-xl">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMarkDone(card); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-[#0f1923] rounded-t-xl"
                >
                  Mark Done
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEdit(card); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-[#0f1923]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(card); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-destructive hover:bg-[#0f1923] rounded-b-xl"
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
        <div>
          <div className="h-[3px] w-full bg-[#1a1a2e] rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', styles.bar)}
              style={{ width: `${Math.min(progressFill, 100)}%` }}
            />
          </div>
          {status === 'overdue' && remaining < 0 && (
            <p className={cn('text-[0.6rem] font-mono mt-1', styles.label)}>
              {Math.abs(Math.round(remaining)).toLocaleString()} {vehicle.mileageUnit} past due
            </p>
          )}
          {status !== 'overdue' && remaining !== null && (
            <p className={cn('text-[0.6rem] font-mono mt-1', styles.label)}>
              {status === 'warning' ? 'Within warning threshold' : 'On track'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/components/maintenance-cards/maintenance-card-row.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 4: Run all tests for regression check**

```bash
cd frontend && pnpm exec vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/maintenance-cards/maintenance-card-row.tsx frontend/src/components/maintenance-cards/maintenance-card-row.spec.tsx
git commit -m "add progress bar and restyle action button in maintenance card row"
```

---

## Task 10: Dialog Restyle

**Files:**
- Modify: `frontend/src/components/ui/dialog.tsx`

- [ ] **Step 1: Restyle the Dialog base component**

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d1117] p-5 shadow-2xl',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-bold text-white font-mono tracking-wide uppercase">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run dialog tests**

```bash
cd frontend && pnpm exec vitest run src/components/ui/dialog.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Run full test suite for final regression check**

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
git add frontend/src/components/ui/dialog.tsx
git commit -m "restyle dialog to dark surface with mobile bottom sheet positioning"
```

---

---

## Task 11: Desktop Split Pane (Vehicle Detail)

On desktop (≥1280px), `/vehicles/[id]` should show the vehicle list panel on the left alongside the detail panel on the right. Implemented as a Next.js nested layout for the `/vehicles/` segment.

**Files:**
- Create: `frontend/src/app/vehicles/layout.tsx`
- Create: `frontend/src/components/layout/vehicles-layout.tsx`
- Create: `frontend/src/components/layout/vehicles-layout.spec.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/layout/vehicles-layout.spec.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@/hooks/queries/vehicles/useVehicles', () => ({
  useVehicles: vi.fn(() => ({ data: [], isLoading: false })),
}));
vi.mock('@/hooks/queries/config/useAppConfig', () => ({
  useAppConfig: vi.fn(() => ({ data: { mileageWarningThresholdKm: 500 } })),
}));
vi.mock('@/hooks/queries/maintenance-cards/useMaintenanceCards', () => ({
  useMaintenanceCards: vi.fn(() => ({ data: [] })),
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

  it('renders the vehicle list panel on desktop', () => {
    render(
      <VehiclesLayout>
        <div>detail content</div>
      </VehiclesLayout>,
    );
    // The panel containing the fleet list label is present in DOM
    // (hidden on mobile via CSS, but exists in DOM)
    expect(screen.getByText(/your vehicles/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd frontend && pnpm exec vitest run src/components/layout/vehicles-layout.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — `VehiclesLayout` not found.

- [ ] **Step 3: Create `vehicles-layout.tsx`**

Create `frontend/src/components/layout/vehicles-layout.tsx`:

```typescript
'use client';

import { FC } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useVehicles } from '@/hooks/queries/vehicles/useVehicles';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import { countWarningCards } from '@/lib/warning';
import { getVehicleDisplayLabels } from '@/lib/vehicle-display';
import { cn } from '@/lib/utils';
import type { IVehicleResDTO } from '@project/types';

type VehicleListItemProps = {
  vehicle: IVehicleResDTO;
  thresholdKm: number;
  isActive: boolean;
};

const VehicleListItem: FC<VehicleListItemProps> = ({ vehicle, thresholdKm, isActive }) => {
  const { data: cards = [] } = useMaintenanceCards(vehicle.id);
  const warningCount = countWarningCards(cards, vehicle.mileage, vehicle.mileageUnit, thresholdKm);
  const { primary } = getVehicleDisplayLabels(vehicle);

  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      className={cn(
        'block rounded-xl border px-3 py-2.5 transition-colors',
        isActive
          ? 'bg-[#0f1923] border-[#00e5ff30] text-white'
          : 'bg-transparent border-white/5 text-[#888] hover:bg-[#0f1923] hover:text-white',
      )}
    >
      <p className="text-sm font-bold truncate">{primary}</p>
      <p className="text-[#555] text-xs">
        {vehicle.mileage.toLocaleString()} {vehicle.mileageUnit}
      </p>
      {warningCount > 0 && (
        <span className="text-[#ff4444] text-[0.6rem] font-mono font-bold">
          {warningCount} overdue
        </span>
      )}
    </Link>
  );
};

type VehiclesLayoutProps = {
  children: React.ReactNode;
};

export const VehiclesLayout: FC<VehiclesLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: config } = useAppConfig();
  const thresholdKm = config?.mileageWarningThresholdKm ?? 0;

  return (
    <div className="flex min-h-screen">
      {/* Desktop-only vehicle list panel */}
      <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0 border-r border-white/5 bg-[#07090f] px-3 py-4 overflow-y-auto">
        <p className="text-[#555] text-[0.6rem] font-mono tracking-[0.2em] mb-3 px-1">
          YOUR VEHICLES
        </p>
        {isLoading ? (
          <p className="text-[#444] text-xs font-mono px-1">Loading…</p>
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

- [ ] **Step 4: Create the Next.js vehicles segment layout**

Create `frontend/src/app/vehicles/layout.tsx`:

```typescript
import { VehiclesLayout } from '@/components/layout/vehicles-layout';

export default function VehiclesSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VehiclesLayout>{children}</VehiclesLayout>;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/components/layout/vehicles-layout.spec.tsx --reporter=verbose 2>&1 | tail -20
```

Expected: 2 tests pass.

- [ ] **Step 6: Run full test suite**

```bash
cd frontend && pnpm exec vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 7: Run format and lint**

```bash
cd /Users/leejianhong/projects/personal-project/maintenance-tracker && just format && just lint
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/vehicles/layout.tsx frontend/src/components/layout/vehicles-layout.tsx frontend/src/components/layout/vehicles-layout.spec.tsx
git commit -m "add desktop split pane for vehicle detail via nested layout"
```

---

## Post-Implementation Verification

- [ ] Start the dev server: `cd frontend && pnpm dev`
- [ ] Open `http://localhost:3000` — verify dark background renders
- [ ] Login page: check logo mark, glow, cyan button
- [ ] Home page: check header gradient, fleet overview label, vehicle cards
- [ ] Vehicle detail: check dark header, mileage prompt, sort toggle, progress bars
- [ ] Mobile viewport (375px): check bottom tab bar is visible, sidebar is hidden
- [ ] Tablet viewport (768px): check icon sidebar visible, bottom tab hidden
- [ ] Desktop viewport (1280px): check full sidebar with labels visible, vehicle list panel on detail page
- [ ] Verify ⋮ action button opens dropdown on maintenance cards

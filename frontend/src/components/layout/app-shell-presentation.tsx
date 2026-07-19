import type { ComponentType, FC, ReactNode } from 'react';
import Link from 'next/link';
import { Car, Clock, User } from 'lucide-react';
import type { IFeatureFlagResDTO } from '@project/types';
import { cn } from '@/lib/utils';

type AppShellPresentationProps = {
  showNav: boolean;
  pathname: string;
  userDisplayName: string | null;
  featureFlags?: IFeatureFlagResDTO;
  version?: string;
  children: ReactNode;
};

type NavItemConfig = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  flagKey?: keyof IFeatureFlagResDTO;
};

const NAV_ITEMS: NavItemConfig[] = [
  { href: '/', label: 'Fleet', icon: Car },
  { href: '/history', label: 'History', icon: Clock, flagKey: 'enableHistory' },
  { href: '/profile', label: 'Profile', icon: User, flagKey: 'enableProfile' },
];

const isActive = (pathname: string, href: string): boolean => {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
};

export const AppShellPresentation: FC<AppShellPresentationProps> = ({
  showNav,
  pathname,
  userDisplayName,
  featureFlags,
  version,
  children,
}) => {
  if (!showNav) {
    return <>{children}</>;
  }

  const visibleNavItems = NAV_ITEMS.filter(({ flagKey }) =>
    flagKey ? (featureFlags?.[flagKey] ?? false) : true,
  );

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
        <nav
          aria-label="Primary navigation"
          className="flex flex-col gap-1 px-2"
        >
          {visibleNavItems.map(({ href, label, icon: Icon }) => {
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
                    : 'text-[#444] hover-pointer:bg-[#0f1923] hover-pointer:text-[#888]',
                )}
              >
                <Icon
                  size={16}
                  className="flex-shrink-0"
                />
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
              <User
                size={14}
                className="text-[#444]"
              />
            </div>
            {userDisplayName !== null && (
              <span className="hidden xl:block text-[#888] text-xs truncate max-w-[80px]">
                {userDisplayName}
              </span>
            )}
          </div>
          {version && (
            <div className="mt-2 pt-2 border-t border-[#ffffff0a]">
              <span className="block text-center text-[0.5rem] text-[color:var(--text-secondary)] truncate">
                {version}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Page content wrapper — leaves room for sidebar on md+ and for bottom tab bar + version strip on mobile */}
      <div className="flex-1 min-w-0 md:ml-[52px] xl:ml-[140px] pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>

      {/* Mobile: version strip pinned above the tab bar */}
      {version && (
        <div className="md:hidden fixed inset-x-0 bottom-[calc(3rem+env(safe-area-inset-bottom))] h-5 bg-[color:var(--bg-surface)] border-t border-[#00e5ff10] flex items-center justify-center z-40">
          <span className="text-[0.5rem] text-[color:var(--text-secondary)]">
            {version}
          </span>
        </div>
      )}

      {/* Mobile: bottom tab bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 h-12 bg-[color:var(--bg-surface)] border-t border-[#00e5ff15] flex items-center justify-around z-40 px-4 pb-[env(safe-area-inset-bottom)]"
      >
        {visibleNavItems.map(({ href, label, icon: Icon }) => {
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

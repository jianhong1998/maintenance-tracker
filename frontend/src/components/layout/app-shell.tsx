'use client';

import type { FC, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthContext } from '@/contexts/auth-context';
import { useFeatureFlags } from '@/hooks/queries/feature-flag/useFeatureFlags';
import { AppShellPresentation } from './app-shell-presentation';

type AppShellProps = {
  children: ReactNode;
};

export const AppShell: FC<AppShellProps> = ({ children }) => {
  const { user, loading } = useAuthContext();
  const pathname = usePathname();
  // undefined featureFlags (loading or error) intentionally hides flagged tabs;
  // the guard on flagged routes then returns null so nothing leaks through.
  const { data: featureFlags } = useFeatureFlags();

  const showNav = !loading && !!user && pathname !== '/login';
  const userDisplayName = user?.displayName ?? null;

  return (
    <AppShellPresentation
      showNav={showNav}
      pathname={pathname}
      userDisplayName={userDisplayName}
      featureFlags={featureFlags}
    >
      {children}
    </AppShellPresentation>
  );
};

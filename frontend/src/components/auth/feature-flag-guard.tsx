'use client';

import { useEffect } from 'react';
import type { FC, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { IFeatureFlagResDTO } from '@project/types';
import { useFeatureFlags } from '@/hooks/queries/feature-flag/useFeatureFlags';

type FeatureFlagGuardProps = {
  flagKey: keyof IFeatureFlagResDTO;
  children: ReactNode;
};

export const FeatureFlagGuard: FC<FeatureFlagGuardProps> = ({
  flagKey,
  children,
}) => {
  const { data: featureFlags, isLoading, isError } = useFeatureFlags();
  const router = useRouter();
  const enabled = featureFlags?.[flagKey] ?? false;

  useEffect(() => {
    if (!isLoading && !enabled) {
      router.replace('/');
    }
  }, [isLoading, enabled, router]);

  if (isLoading || isError || !enabled) {
    return null;
  }

  return <>{children}</>;
};

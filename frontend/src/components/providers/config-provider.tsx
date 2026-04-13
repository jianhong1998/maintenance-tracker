'use client';

import { FC, ReactNode } from 'react';
import { setBaseUrl } from '@/lib/api-client';

type ConfigProviderProps = {
  backendUrl: string;
  children: ReactNode;
};

export const ConfigProvider: FC<ConfigProviderProps> = ({
  backendUrl,
  children,
}) => {
  setBaseUrl(backendUrl);
  return <>{children}</>;
};

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
  // Called synchronously in render (not useEffect) so the URL is set before
  // any child component makes an API call on its first render. useEffect would
  // run after the first paint, creating a race where children call the API
  // with no base URL. backendUrl is a container env var — it never changes,
  // making repeated calls from React Strict Mode double-invocation harmless.
  setBaseUrl(backendUrl);
  return <>{children}</>;
};

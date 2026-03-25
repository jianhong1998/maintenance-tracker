import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

export const createWrapperWithClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  wrapper.displayName = 'TestQueryClientWrapper';
  return { wrapper, queryClient };
};

export const createWrapper = () => createWrapperWithClient().wrapper;

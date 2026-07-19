import { useQuery } from '@tanstack/react-query';
import type { IVersionResDTO } from '@project/types';
import { getQueryKey, QueryGroup, QueryType } from '../keys';
import { apiClient } from '@/lib/api-client';

export const useVersion = () => {
  return useQuery<IVersionResDTO>({
    queryKey: getQueryKey({
      group: QueryGroup.VERSION,
      type: QueryType.ONE,
      key: '',
    }),
    queryFn: async () => apiClient.get<IVersionResDTO>('/version'),
    staleTime: Infinity,
  });
};

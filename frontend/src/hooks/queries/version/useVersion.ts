import { useQuery } from '@tanstack/react-query';
import type { IVersionResDTO } from '@project/types';
import { QueryGroup } from '../keys';
import { apiClient } from '@/lib/api-client';

export const useVersion = () => {
  return useQuery<IVersionResDTO>({
    // Version is a singleton resource — not a list/one entity, so we use a flat key
    // instead of getQueryKey() which requires QueryType (LIST|ONE) semantics.
    queryKey: [QueryGroup.VERSION],
    queryFn: async () => apiClient.get<IVersionResDTO>('/version'),
    staleTime: Infinity,
  });
};

import { useQuery } from '@tanstack/react-query';
import { QueryGroup } from '../keys';
import { apiClient } from '@/lib/api-client';
import { IAppConfigResDTO } from '@project/types';

export const useAppConfig = () => {
  return useQuery<IAppConfigResDTO>({
    // Config is a singleton resource — not a list/one entity, so we use a flat key
    // instead of getQueryKey() which requires QueryType (LIST|ONE) semantics.
    queryKey: [QueryGroup.CONFIG],
    queryFn: async () => {
      return await apiClient.get<IAppConfigResDTO>('/config');
    },
    staleTime: Infinity,
  });
};

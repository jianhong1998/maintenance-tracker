import { useQuery } from '@tanstack/react-query';
import type { IFeatureFlagResDTO } from '@project/types';
import { QueryGroup } from '../keys';
import { apiClient } from '@/lib/api-client';

export const useFeatureFlags = () => {
  return useQuery<IFeatureFlagResDTO>({
    queryKey: [QueryGroup.FEATURE_FLAG],
    queryFn: async () =>
      apiClient.get<IFeatureFlagResDTO>('/config/feature-flag'),
    staleTime: Infinity,
  });
};

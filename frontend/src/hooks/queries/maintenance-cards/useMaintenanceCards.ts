import { useQuery } from '@tanstack/react-query';
import type { IMaintenanceCardResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '../keys';

export const useMaintenanceCards = (vehicleId: string) => {
  return useQuery<IMaintenanceCardResDTO[]>({
    queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId],
    queryFn: () =>
      apiClient.get<IMaintenanceCardResDTO[]>(
        `/vehicles/${vehicleId}/maintenance-cards`,
      ),
    enabled: !!vehicleId,
  });
};

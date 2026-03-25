import { useQuery } from '@tanstack/react-query';
import type { IMaintenanceCardResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '../keys';

export const maintenanceCardsQueryOptions = (vehicleId: string) => ({
  queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId] as const,
  queryFn: () =>
    apiClient.get<IMaintenanceCardResDTO[]>(
      `/vehicles/${vehicleId}/maintenance-cards`,
    ),
  enabled: !!vehicleId,
});

export const useMaintenanceCards = (
  vehicleId: string,
  sort?: 'urgency' | 'name',
) => {
  return useQuery<IMaintenanceCardResDTO[]>(
    sort
      ? {
          queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId, sort],
          queryFn: () =>
            apiClient.get<IMaintenanceCardResDTO[]>(
              `/vehicles/${vehicleId}/maintenance-cards?sort=${sort}`,
            ),
          enabled: !!vehicleId,
        }
      : maintenanceCardsQueryOptions(vehicleId),
  );
};

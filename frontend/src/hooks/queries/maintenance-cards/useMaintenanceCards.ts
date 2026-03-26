import { useQuery } from '@tanstack/react-query';
import type { IMaintenanceCardResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '../keys';

export const maintenanceCardsQueryOptions = (
  vehicleId: string,
  sort?: 'urgency' | 'name',
) => ({
  queryKey: sort
    ? ([QueryGroup.MAINTENANCE_CARDS, vehicleId, sort] as const)
    : ([QueryGroup.MAINTENANCE_CARDS, vehicleId] as const),
  queryFn: () =>
    apiClient.get<IMaintenanceCardResDTO[]>(
      sort
        ? `/vehicles/${vehicleId}/maintenance-cards?sort=${sort}`
        : `/vehicles/${vehicleId}/maintenance-cards`,
    ),
  enabled: !!vehicleId,
});

export const useMaintenanceCards = (
  vehicleId: string,
  sort?: 'urgency' | 'name',
) =>
  useQuery<IMaintenanceCardResDTO[]>(
    maintenanceCardsQueryOptions(vehicleId, sort),
  );

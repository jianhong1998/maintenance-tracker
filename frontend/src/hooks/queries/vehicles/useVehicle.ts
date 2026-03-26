import { useQuery } from '@tanstack/react-query';
import type { IVehicleResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '../keys';

export const vehicleQueryOptions = (vehicleId: string) => ({
  queryKey: [QueryGroup.VEHICLES, vehicleId] as const,
  queryFn: () => apiClient.get<IVehicleResDTO>(`/vehicles/${vehicleId}`),
  enabled: !!vehicleId,
});

export const useVehicle = (vehicleId: string) => {
  return useQuery<IVehicleResDTO>(vehicleQueryOptions(vehicleId));
};

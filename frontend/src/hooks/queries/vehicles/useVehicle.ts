import { useQuery } from '@tanstack/react-query';
import type { IVehicleResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '../keys';

export const useVehicle = (vehicleId: string) => {
  return useQuery<IVehicleResDTO>({
    queryKey: [QueryGroup.VEHICLES, vehicleId],
    queryFn: () => apiClient.get<IVehicleResDTO>(`/vehicles/${vehicleId}`),
    enabled: !!vehicleId,
  });
};

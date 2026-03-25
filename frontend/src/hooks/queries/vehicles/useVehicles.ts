import { useQuery } from '@tanstack/react-query';
import type { IVehicleResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '../keys';

export const useVehicles = () => {
  return useQuery<IVehicleResDTO[]>({
    queryKey: [QueryGroup.VEHICLES],
    queryFn: () => apiClient.get<IVehicleResDTO[]>('/vehicles'),
  });
};

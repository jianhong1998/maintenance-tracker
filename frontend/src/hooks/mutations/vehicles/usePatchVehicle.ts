import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { IUpdateVehicleReqDTO, IVehicleResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const usePatchVehicle = (vehicleId: string) => {
  const queryClient = useQueryClient();

  return useMutation<IVehicleResDTO, Error, IUpdateVehicleReqDTO>({
    mutationFn: (data) =>
      apiClient.patch<IVehicleResDTO>(`/vehicles/${vehicleId}`, data),
    // Two invalidations (individual + list) are intentional.
    // Using setQueryData for the individual key caused stale cache in some consumers
    // because it relied on component-captured state rather than fresh server data.
    // Dual invalidation trades one extra fetch for guaranteed consistency.
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.VEHICLES, vehicleId],
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.VEHICLES],
        exact: true,
      });
    },
  });
};

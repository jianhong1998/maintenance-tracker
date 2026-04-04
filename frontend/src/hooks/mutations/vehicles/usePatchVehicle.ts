import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { IUpdateVehicleReqDTO, IVehicleResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const usePatchVehicle = (vehicleId: string) => {
  const queryClient = useQueryClient();

  return useMutation<IVehicleResDTO, Error, IUpdateVehicleReqDTO>({
    mutationFn: (data) =>
      apiClient.patch<IVehicleResDTO>(`/vehicles/${vehicleId}`, data),
    onSuccess: (data) => {
      queryClient.setQueryData([QueryGroup.VEHICLES, vehicleId], data);
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.VEHICLES],
        exact: true,
      });
    },
  });
};

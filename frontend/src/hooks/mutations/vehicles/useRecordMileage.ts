import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { IRecordMileageReqDTO, IVehicleResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const useRecordMileage = (vehicleId: string) => {
  const queryClient = useQueryClient();

  return useMutation<IVehicleResDTO, Error, IRecordMileageReqDTO>({
    mutationFn: (data) =>
      apiClient.patch<IVehicleResDTO>(`/vehicles/${vehicleId}/mileage`, data),
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

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ICreateVehicleReqDTO, IVehicleResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const useCreateVehicle = () => {
  const queryClient = useQueryClient();

  return useMutation<IVehicleResDTO, Error, ICreateVehicleReqDTO>({
    mutationFn: (data) => apiClient.post<IVehicleResDTO>('/vehicles', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.VEHICLES],
      });
    },
  });
};

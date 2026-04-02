import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const useDeleteVehicle = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (vehicleId) => apiClient.delete<void>(`/vehicles/${vehicleId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.VEHICLES],
      });
    },
  });
};

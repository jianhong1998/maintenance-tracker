import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const useDeleteMaintenanceCard = (vehicleId: string) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (cardId) =>
      apiClient.delete<void>(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId],
      });
    },
  });
};

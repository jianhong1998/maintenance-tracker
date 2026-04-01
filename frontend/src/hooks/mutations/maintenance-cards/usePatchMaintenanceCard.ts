import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  IUpdateMaintenanceCardReqDTO,
  IMaintenanceCardResDTO,
} from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const usePatchMaintenanceCard = (vehicleId: string, cardId: string) => {
  const queryClient = useQueryClient();

  return useMutation<
    IMaintenanceCardResDTO,
    Error,
    IUpdateMaintenanceCardReqDTO
  >({
    mutationFn: (data) =>
      apiClient.patch<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
        data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId],
      });
    },
  });
};

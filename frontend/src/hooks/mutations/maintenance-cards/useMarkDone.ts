import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  IMarkDoneReqDTO,
  IMaintenanceHistoryResDTO,
} from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const useMarkDone = (vehicleId: string, cardId: string) => {
  const queryClient = useQueryClient();

  return useMutation<IMaintenanceHistoryResDTO, Error, IMarkDoneReqDTO>({
    mutationFn: (data) =>
      apiClient.post<IMaintenanceHistoryResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}/mark-done`,
        data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId],
      });
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.VEHICLES, vehicleId],
        exact: true,
      });
    },
  });
};

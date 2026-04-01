import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ICreateMaintenanceCardReqDTO,
  IMaintenanceCardResDTO,
} from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const useCreateMaintenanceCard = (vehicleId: string) => {
  const queryClient = useQueryClient();

  return useMutation<
    IMaintenanceCardResDTO,
    Error,
    ICreateMaintenanceCardReqDTO
  >({
    mutationFn: (data) =>
      apiClient.post<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards`,
        data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId],
      });
    },
  });
};

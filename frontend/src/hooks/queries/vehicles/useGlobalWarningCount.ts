import { useQueries } from '@tanstack/react-query';
import type { IVehicleResDTO } from '@project/types';
import { countWarningCards } from '@/lib/warning';
import { maintenanceCardsQueryOptions } from '../maintenance-cards/useMaintenanceCards';

/**
 * Computes the global warning count across all vehicles using useQueries.
 * useQueries is a single hook call that safely runs a dynamic number of
 * parallel queries — no hooks-in-loop violation.
 * TanStack Query deduplicates these fetches with VehicleCard's useMaintenanceCards calls.
 */
export function useGlobalWarningCount(params: {
  vehicles: IVehicleResDTO[];
  thresholdKm: number;
  notificationDaysBefore: number;
}): number {
  const { vehicles, thresholdKm, notificationDaysBefore } = params;
  const results = useQueries({
    queries: vehicles.map((vehicle) =>
      maintenanceCardsQueryOptions(vehicle.id),
    ),
  });

  return results.reduce((total, result, index) => {
    const cards = result.data ?? [];
    const vehicle = vehicles[index];
    return (
      total +
      countWarningCards({
        cards,
        vehicleMileage: vehicle.mileage,
        mileageUnit: vehicle.mileageUnit,
        mileageWarningThresholdKm: thresholdKm,
        notificationDaysBefore,
      })
    );
  }, 0);
}

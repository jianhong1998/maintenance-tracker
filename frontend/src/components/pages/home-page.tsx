'use client';

import { useQueries } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth/auth-guard';
import { VehicleCard } from '@/components/vehicles/vehicle-card';
import { useVehicles } from '@/hooks/queries/vehicles/useVehicles';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { countWarningCards } from '@/lib/warning';
import { maintenanceCardsQueryOptions } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import type { IVehicleResDTO } from '@project/types';

/**
 * Computes the global warning count across all vehicles using useQueries.
 * useQueries is a single hook call that safely runs a dynamic number of
 * parallel queries — no hooks-in-loop violation.
 * TanStack Query deduplicates these fetches with VehicleCard's useMaintenanceCards calls.
 */
function useGlobalWarningCount(
  vehicles: IVehicleResDTO[],
  thresholdKm: number,
): number {
  const results = useQueries({
    queries: vehicles.map((vehicle) =>
      maintenanceCardsQueryOptions(vehicle.id),
    ),
  });

  return results.reduce((total, result, index) => {
    const cards = result.data ?? [];
    const vehicle = vehicles[index];
    if (!vehicle) return total;
    return (
      total +
      countWarningCards(
        cards,
        vehicle.mileage,
        vehicle.mileageUnit,
        thresholdKm,
      )
    );
  }, 0);
}

function HomeContent() {
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: config } = useAppConfig();
  const thresholdKm = config?.mileageWarningThresholdKm ?? 0;
  const globalWarningCount = useGlobalWarningCount(vehicles, thresholdKm);

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading vehicles…</p>;
  }

  if (vehicles.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No vehicles yet. Add your first vehicle to get started.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {globalWarningCount === 0 ? (
        <p className="text-sm font-medium text-green-600">
          ✓ All good — no upcoming or overdue maintenance
        </p>
      ) : (
        <p className="text-sm font-medium text-destructive">
          {globalWarningCount} card
          {globalWarningCount !== 1 ? 's' : ''} need attention
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((vehicle) => (
          <VehicleCard
            key={vehicle.id}
            vehicle={vehicle}
          />
        ))}
      </div>
    </div>
  );
}

export function HomePage() {
  return (
    <AuthGuard>
      <main className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Your Vehicles</h1>
        <HomeContent />
      </main>
    </AuthGuard>
  );
}

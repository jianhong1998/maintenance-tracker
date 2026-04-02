'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { VehicleCard } from '@/components/vehicles/vehicle-card';
import { VehicleFormDialog } from '@/components/vehicles/vehicle-form-dialog';
import { Button } from '@/components/ui/button';
import { useVehicles } from '@/hooks/queries/vehicles/useVehicles';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { useGlobalWarningCount } from '@/hooks/queries/vehicles/useGlobalWarningCount';

function HomeContent() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: config } = useAppConfig();
  const thresholdKm = config?.mileageWarningThresholdKm ?? 0;
  const globalWarningCount = useGlobalWarningCount(vehicles, thresholdKm);

  const renderVehicles = () => {
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
              thresholdKm={thresholdKm}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your Vehicles</h1>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          + Add Vehicle
        </Button>
      </div>
      {renderVehicles()}
      <VehicleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}

export function HomePage() {
  return (
    <AuthGuard>
      <main className="p-6">
        <HomeContent />
      </main>
    </AuthGuard>
  );
}

'use client';

import Link from 'next/link';
import type { IVehicleResDTO } from '@project/types';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import { countWarningCards } from '@/lib/warning';

interface VehicleCardProps {
  vehicle: IVehicleResDTO;
  thresholdKm: number;
}

export function VehicleCard({ vehicle, thresholdKm }: VehicleCardProps) {
  const { data: cards = [] } = useMaintenanceCards(vehicle.id);

  const warningCount = countWarningCards(
    cards,
    vehicle.mileage,
    vehicle.mileageUnit,
    thresholdKm,
  );

  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      className="block rounded-lg border p-4 hover:bg-accent transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">
            {vehicle.brand} {vehicle.model}
          </p>
          <p className="text-muted-foreground text-sm">{vehicle.colour}</p>
          <p className="text-muted-foreground text-sm">
            {vehicle.mileage.toLocaleString()} {vehicle.mileageUnit}
          </p>
        </div>
        {warningCount > 0 && (
          <span className="rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-destructive-foreground">
            {warningCount}
          </span>
        )}
      </div>
    </Link>
  );
}

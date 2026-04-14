'use client';

import type { FC } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { IVehicleResDTO } from '@project/types';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import { countWarningCards } from '@/lib/warning';
import { getVehicleDisplayLabels } from '@/lib/vehicle-display';
import { VehicleStatusChip } from './vehicle-status-chip';
import { cn } from '@/lib/utils';

type VehicleCardProps = {
  vehicle: IVehicleResDTO;
  thresholdKm: number;
};

export const VehicleCard: FC<VehicleCardProps> = ({ vehicle, thresholdKm }) => {
  const { data: cards = [] } = useMaintenanceCards(vehicle.id);

  const warningCount = countWarningCards(
    cards,
    vehicle.mileage,
    vehicle.mileageUnit,
    thresholdKm,
  );

  const { primary } = getVehicleDisplayLabels(vehicle);
  const hasWarning = warningCount > 0;

  const metaLine = `${vehicle.colour} · ${vehicle.mileage.toLocaleString()} ${vehicle.mileageUnit}`;

  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      className={cn(
        'block rounded-[10px] border p-[11px] transition-colors hover-pointer:bg-[#111d2b]',
        hasWarning
          ? 'bg-[color:var(--bg-card)] border-[#ff444328]'
          : 'bg-[color:var(--bg-card)] border-border-accent',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-card-title truncate">{primary}</p>
          <p className="text-meta truncate">{metaLine}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <VehicleStatusChip count={warningCount} />
          <ChevronRight
            size={14}
            className="text-[#444]"
          />
        </div>
      </div>
    </Link>
  );
};

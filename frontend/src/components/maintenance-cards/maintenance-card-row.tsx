'use client';

import type { IMaintenanceCardResDTO, IVehicleResDTO } from '@project/types';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { getCardWarningStatus } from '@/lib/warning';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<IMaintenanceCardResDTO['type'], string> = {
  task: 'Task',
  part: 'Part',
  item: 'Item',
};

interface MaintenanceCardRowProps {
  card: IMaintenanceCardResDTO;
  vehicle: IVehicleResDTO;
}

export function MaintenanceCardRow({ card, vehicle }: MaintenanceCardRowProps) {
  const { data: config } = useAppConfig();
  const thresholdKm = config?.mileageWarningThresholdKm ?? 500;

  const status = getCardWarningStatus(
    card,
    vehicle.mileage,
    vehicle.mileageUnit,
    thresholdKm,
  );

  // Remaining mileage in the vehicle's native unit (null when no nextDueMileage)
  const remaining =
    card.nextDueMileage !== null ? card.nextDueMileage - vehicle.mileage : null;

  const mileageLabel = (() => {
    if (remaining === null) return null;
    if (remaining <= 0) return 'OVERDUE';
    return `${Math.round(remaining).toLocaleString()} ${vehicle.mileageUnit} left`;
  })();

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border px-4 py-3',
        status === 'overdue' && 'border-destructive/40 bg-destructive/10',
        status === 'warning' && 'border-yellow-300 bg-yellow-50',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{card.name}</span>
        <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
          {TYPE_LABELS[card.type]}
        </span>
      </div>

      {mileageLabel && (
        <span
          className={cn(
            'text-xs font-semibold',
            status === 'overdue' && 'text-destructive',
            status === 'warning' && 'text-yellow-700',
          )}
        >
          {mileageLabel}
        </span>
      )}
    </div>
  );
}

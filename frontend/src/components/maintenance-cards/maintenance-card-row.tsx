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
  isDropdownOpen: boolean;
  onDropdownToggle: (cardId: string | null) => void;
  onEdit: (card: IMaintenanceCardResDTO) => void;
  onMarkDone: (card: IMaintenanceCardResDTO) => void;
  onDelete: (card: IMaintenanceCardResDTO) => void;
}

export function MaintenanceCardRow({
  card,
  vehicle,
  isDropdownOpen,
  onDropdownToggle,
  onEdit,
  onMarkDone,
  onDelete,
}: MaintenanceCardRowProps) {
  const { data: config } = useAppConfig();
  const thresholdKm = config?.mileageWarningThresholdKm ?? 500;

  const status = getCardWarningStatus(
    card,
    vehicle.mileage,
    vehicle.mileageUnit,
    thresholdKm,
  );

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
        'relative flex items-center justify-between rounded-md border px-4 py-3',
        status === 'overdue' && 'border-destructive/40 bg-destructive/10',
        status === 'warning' &&
          'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{card.name}</span>
        <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
          {TYPE_LABELS[card.type]}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {mileageLabel && (
          <span
            className={cn(
              'text-xs font-semibold',
              status === 'overdue' && 'text-destructive',
              status === 'warning' && 'text-yellow-700 dark:text-yellow-400',
            )}
          >
            {mileageLabel}
          </span>
        )}

        <div className="relative">
          <button
            type="button"
            aria-label="actions"
            onClick={(e) => {
              e.stopPropagation();
              onDropdownToggle(isDropdownOpen ? null : card.id);
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            ⋮
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 top-7 z-10 min-w-[140px] rounded-lg border bg-background shadow-md">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkDone(card);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                Mark Done
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(card);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(card);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-accent"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

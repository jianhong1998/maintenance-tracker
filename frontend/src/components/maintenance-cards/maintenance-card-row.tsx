'use client';

import type { FC } from 'react';
import type { IMaintenanceCardResDTO, IVehicleResDTO } from '@project/types';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { getCardWarningStatus } from '@/lib/warning';
import type { CardWarningStatus } from '@/lib/warning';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DEFAULT_MILEAGE_WARNING_THRESHOLD_KM } from '@/constants';

const MILES_TO_KM = 1.60934;

const TYPE_LABELS: Record<IMaintenanceCardResDTO['type'], string> = {
  task: 'Task',
  part: 'Part',
  item: 'Item',
};

/**
 * Progress bar fill percentage (0–100).
 * Overdue: 100 (clamped — magnitude communicated via text).
 * Warning: linear 60→99 as remaining goes from threshold→0.
 * Healthy: linear 0→59 as remaining goes from (5 × threshold)→threshold. No floor.
 */
const getProgressFill = (params: {
  remaining: number | null;
  thresholdNative: number;
  status: CardWarningStatus;
}): number => {
  const { remaining, thresholdNative, status } = params;
  if (status === 'overdue') return 100;
  if (remaining === null) return 0;
  if (status === 'warning') {
    return 60 + ((thresholdNative - remaining) / thresholdNative) * 39;
  }
  // Healthy zone
  const lookahead = thresholdNative * 5;
  if (remaining >= lookahead) return 0;
  return (1 - remaining / lookahead) * 59;
};

/**
 * Healthy label color — muted when far from due, cyan when approaching warning zone.
 * Threshold: 3× warning threshold.
 */
const getHealthyLabelColor = (
  remaining: number,
  thresholdNative: number,
): 'primary' | 'muted' => {
  return remaining > 3 * thresholdNative ? 'muted' : 'primary';
};

type MaintenanceCardRowProps = {
  card: IMaintenanceCardResDTO;
  vehicle: IVehicleResDTO;
  isDropdownOpen: boolean;
  onDropdownToggle: (cardId: string | null) => void;
  onEdit: (card: IMaintenanceCardResDTO) => void;
  onMarkDone: (card: IMaintenanceCardResDTO) => void;
  onDelete: (card: IMaintenanceCardResDTO) => void;
};

export const MaintenanceCardRow: FC<MaintenanceCardRowProps> = ({
  card,
  vehicle,
  isDropdownOpen,
  onDropdownToggle,
  onEdit,
  onMarkDone,
  onDelete,
}: MaintenanceCardRowProps) => {
  const { data: config } = useAppConfig();
  const thresholdKm =
    config?.mileageWarningThresholdKm ?? DEFAULT_MILEAGE_WARNING_THRESHOLD_KM;

  const status = getCardWarningStatus(
    card,
    vehicle.mileage,
    vehicle.mileageUnit,
    thresholdKm,
  );

  const thresholdNative =
    vehicle.mileageUnit === 'mile' ? thresholdKm / MILES_TO_KM : thresholdKm;

  const remaining =
    card.nextDueMileage !== null ? card.nextDueMileage - vehicle.mileage : null;

  const progressFill = getProgressFill({
    remaining,
    thresholdNative,
    status,
  });

  // Sub-label — single source for remaining-mileage text
  const subLabel = (() => {
    if (remaining === null) return null;
    if (status === 'overdue') {
      return `${Math.abs(Math.round(remaining)).toLocaleString()} ${vehicle.mileageUnit} past due`;
    }
    return `${Math.round(remaining).toLocaleString()} ${vehicle.mileageUnit} left`;
  })();

  // Healthy label color follows the 3× rule
  const labelColorClass = (() => {
    if (status === 'overdue') return 'text-[#ff4444]';
    if (status === 'warning') return 'text-[#f59e0b]';
    if (remaining === null) return 'text-[#555]';
    return getHealthyLabelColor(remaining, thresholdNative) === 'primary'
      ? 'text-[#00e5ff]'
      : 'text-[#555]';
  })();

  const containerClass = (() => {
    if (status === 'overdue') return 'bg-[#ff44440a] border-[#ff444328]';
    if (status === 'warning') return 'bg-[#0f1923] border-[#f59e0b28]';
    return 'bg-[#0f1923] border-[#00e5ff15]';
  })();

  const barClass = (() => {
    if (status === 'overdue') return 'bg-[#ff4444]';
    if (status === 'warning')
      return 'bg-gradient-to-r from-[#f59e0b60] to-[#f59e0b]';
    return 'bg-gradient-to-r from-[#00e5ff40] to-[#00e5ff]';
  })();

  return (
    <div
      className={cn(
        'relative rounded-lg border p-[9px] hover-pointer:bg-[#111d2b]',
        containerClass,
      )}
    >
      {/* Top row: name + type badge | sub-label + ⋮ */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-card-title truncate">{card.name}</p>
          <span className="inline-block mt-0.5 bg-[color:var(--bg-card)] border border-[#333] text-[color:var(--text-disabled)] text-[0.375rem] px-[4px] py-[1px] rounded">
            {TYPE_LABELS[card.type]}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {subLabel && (
            <span className={cn('text-[0.625rem] font-bold', labelColorClass)}>
              {subLabel}
            </span>
          )}

          {/* ⋮ action button */}
          <div className="relative">
            <Button
              variant="secondary"
              size="icon-xs"
              aria-label="actions"
              aria-haspopup="menu"
              aria-expanded={isDropdownOpen}
              onClick={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                onDropdownToggle(isDropdownOpen ? null : card.id);
              }}
              className="bg-[color:var(--bg-card)] border-[#333] text-[color:var(--text-disabled)]"
            >
              ⋮
            </Button>

            {isDropdownOpen && (
              <div
                role="menu"
                className="absolute right-0 top-6 z-10 min-w-[140px] rounded-xl border border-[#ffffff10] bg-[color:var(--bg-surface)] shadow-xl"
              >
                <button
                  role="menuitem"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkDone(card);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-[color:var(--bg-card)] rounded-t-xl"
                >
                  Mark Done
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(card);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-[color:var(--bg-card)]"
                >
                  Edit
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(card);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-destructive hover:bg-[color:var(--bg-card)] rounded-b-xl"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {remaining !== null && (
        <div className="mt-[5px] mb-[2px]">
          <div
            data-testid="progress-bar-track"
            className="h-[3px] w-full bg-[#1a1a2e] rounded-full overflow-hidden"
          >
            <div
              className={cn('h-full rounded-full transition-all', barClass)}
              style={{ width: `${Math.min(progressFill, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

'use client';

import type { FC } from 'react';
import type { IMaintenanceCardResDTO, IVehicleResDTO } from '@project/types';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import {
  getCardStatus,
  daysUntilDue as computeDaysUntilDue,
  type CardAxisStatus,
  type CardStatus,
} from '@/lib/warning';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DEFAULT_MILEAGE_WARNING_THRESHOLD_KM,
  DEFAULT_NOTIFICATION_DAYS_BEFORE,
} from '@/constants';

const TYPE_LABELS: Record<IMaintenanceCardResDTO['type'], string> = {
  task: 'Task',
  part: 'Part',
  item: 'Item',
};

const getProgressFill = (remaining: number, interval: number): number => {
  const progress = 1 - remaining / interval;
  return Math.max(0, Math.min(1, progress)) * 100;
};

const pluralise = (value: number, unit: 'day') =>
  `${value} ${value === 1 ? unit : `${unit}s`}`;

type AxisLabel = { text: string; colorClass: string };

const LABEL_COLOR_BY_STATUS: Record<Exclude<CardAxisStatus, 'none'>, string> = {
  overdue: 'text-[#ff4444]',
  warning: 'text-[#f59e0b]',
  ok: 'text-[#00e5ff]',
};

const getMileageLabel = (params: {
  card: IMaintenanceCardResDTO;
  vehicle: IVehicleResDTO;
  mileageStatus: CardAxisStatus;
}): AxisLabel | null => {
  const { card, vehicle, mileageStatus } = params;
  if (card.nextDueMileage === null || mileageStatus === 'none') return null;
  const remaining = card.nextDueMileage - vehicle.mileage;
  const text =
    mileageStatus === 'overdue'
      ? `${Math.abs(Math.round(remaining)).toLocaleString()} ${vehicle.mileageUnit} past due`
      : `${Math.round(remaining).toLocaleString()} ${vehicle.mileageUnit} left`;
  return { text, colorClass: LABEL_COLOR_BY_STATUS[mileageStatus] };
};

const getDateLabel = (params: {
  card: IMaintenanceCardResDTO;
  today: Date;
  dateStatus: CardAxisStatus;
}): AxisLabel | null => {
  const { card, today, dateStatus } = params;
  if (card.nextDueDate == null || dateStatus === 'none') return null;
  const days = computeDaysUntilDue(card.nextDueDate, today);
  const text =
    days === 0
      ? 'Due today'
      : days < 0
        ? `${pluralise(Math.abs(days), 'day')} overdue`
        : `${pluralise(days, 'day')} left`;
  return { text, colorClass: LABEL_COLOR_BY_STATUS[dateStatus] };
};

const getContainerClass = (overall: CardStatus['overall']): string => {
  if (overall === 'overdue') return 'bg-[#ff44440a] border-[#ff444328]';
  if (overall === 'warning') return 'bg-[#0f1923] border-[#f59e0b28]';
  return 'bg-[#0f1923] border-[#00e5ff15]';
};

const getBarClass = (mileageStatus: CardAxisStatus): string => {
  if (mileageStatus === 'overdue') return 'bg-[#ff4444]';
  if (mileageStatus === 'warning')
    return 'bg-gradient-to-r from-[#f59e0b60] to-[#f59e0b]';
  return 'bg-gradient-to-r from-[#00e5ff40] to-[#00e5ff]';
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
}) => {
  const { data: config } = useAppConfig();
  const thresholdKm =
    config?.mileageWarningThresholdKm ?? DEFAULT_MILEAGE_WARNING_THRESHOLD_KM;
  const notificationDaysBefore =
    config?.notificationDaysBefore ?? DEFAULT_NOTIFICATION_DAYS_BEFORE;
  const today = new Date();

  const status = getCardStatus({
    card,
    vehicleMileage: vehicle.mileage,
    mileageUnit: vehicle.mileageUnit,
    mileageWarningThresholdKm: thresholdKm,
    notificationDaysBefore,
    today,
  });

  const remainingMileage =
    card.nextDueMileage !== null ? card.nextDueMileage - vehicle.mileage : null;

  const mileageLabel = getMileageLabel({
    card,
    vehicle,
    mileageStatus: status.mileage,
  });

  const dateLabel = getDateLabel({
    card,
    today,
    dateStatus: status.date,
  });

  return (
    <div
      data-testid="maintenance-card-row"
      data-status={status.overall}
      className={cn(
        'relative rounded-lg border p-[9px] hover-pointer:bg-[#111d2b]',
        getContainerClass(status.overall),
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-card-title truncate">{card.name}</p>
          <span className="inline-block mt-0.5 bg-[color:var(--bg-card)] border border-[#333] text-[color:var(--text-secondary)] text-[0.375rem] px-[4px] py-[1px] rounded">
            {TYPE_LABELS[card.type]}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex flex-col items-end">
            {mileageLabel && (
              <span
                className={cn(
                  'text-[0.625rem] font-bold',
                  mileageLabel.colorClass,
                )}
              >
                {mileageLabel.text}
              </span>
            )}
            {dateLabel && (
              <span
                className={cn(
                  'text-[0.625rem] font-bold',
                  dateLabel.colorClass,
                )}
              >
                {dateLabel.text}
              </span>
            )}
          </div>

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
              className="bg-[color:var(--bg-card)] border-[#333] text-[color:var(--text-secondary)]"
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
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover-pointer:bg-[color:var(--bg-card)] rounded-t-xl"
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
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover-pointer:bg-[color:var(--bg-card)]"
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
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-destructive hover-pointer:bg-[color:var(--bg-card)] rounded-b-xl"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {remainingMileage !== null &&
        card.intervalMileage !== null &&
        card.intervalMileage > 0 && (
          <div className="mt-[5px] mb-[2px]">
            <div
              data-testid="progress-bar-track"
              className="h-[3px] w-full bg-[#1a1a2e] rounded-full overflow-hidden"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  getBarClass(status.mileage),
                )}
                style={{
                  width: `${getProgressFill(remainingMileage, card.intervalMileage)}%`,
                }}
              />
            </div>
          </div>
        )}
    </div>
  );
};

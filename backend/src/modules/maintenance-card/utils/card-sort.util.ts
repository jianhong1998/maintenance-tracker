import type { MileageUnit } from '@project/types';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import {
  getCardStatus,
  MS_PER_DAY,
  startOfLocalDay,
  type CardStatus,
} from './card-status.util';

type SortParams = {
  vehicleMileage: number;
  mileageUnit: MileageUnit;
  mileageWarningThresholdKm: number;
  notificationDaysBefore: number;
  today: Date;
};

const TIER_ORDER = {
  overdue: 0,
  warning: 1,
  ok: 2,
} as const satisfies Record<CardStatus['overall'], number>;

const driverRank = (status: CardStatus): 0 | 1 | 2 => {
  if (status.mileage === status.overall) return 0;
  if (status.date === status.overall) return 1;
  return 2;
};

const urgencyKey = (params: {
  card: MaintenanceCardEntity;
  status: CardStatus;
  vehicleMileage: number;
  today: Date;
}): number => {
  const { card, status, vehicleMileage, today } = params;
  if (driverRank(status) === 0 && card.nextDueMileage !== null) {
    return card.nextDueMileage - vehicleMileage;
  }
  if (driverRank(status) === 1 && card.nextDueDate !== null) {
    return Math.floor(
      (startOfLocalDay(card.nextDueDate).getTime() -
        startOfLocalDay(today).getTime()) /
        MS_PER_DAY,
    );
  }
  return Number.MAX_SAFE_INTEGER;
};

export const compareCardsByUrgency =
  (params: SortParams) =>
  (a: MaintenanceCardEntity, b: MaintenanceCardEntity): number => {
    const statusA = getCardStatus({ ...params, card: a });
    const statusB = getCardStatus({ ...params, card: b });

    const tierDiff = TIER_ORDER[statusA.overall] - TIER_ORDER[statusB.overall];
    if (tierDiff !== 0) return tierDiff;

    const driverDiff = driverRank(statusA) - driverRank(statusB);
    if (driverDiff !== 0) return driverDiff;

    const urgencyDiff =
      urgencyKey({
        card: a,
        status: statusA,
        vehicleMileage: params.vehicleMileage,
        today: params.today,
      }) -
      urgencyKey({
        card: b,
        status: statusB,
        vehicleMileage: params.vehicleMileage,
        today: params.today,
      });
    if (urgencyDiff !== 0) return urgencyDiff;

    return a.name.localeCompare(b.name);
  };

import type { MileageUnit } from '@project/types';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';

export type CardAxisStatus = 'overdue' | 'warning' | 'ok' | 'none';

export type CardStatus = {
  mileage: CardAxisStatus;
  date: CardAxisStatus;
  overall: 'overdue' | 'warning' | 'ok';
};

type CardWarningStatus = CardStatus['overall'];

const MILES_TO_KM = 1.60934;

export const MS_PER_DAY = 86_400_000;

export const startOfLocalDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getMileageStatus = (params: {
  card: MaintenanceCardEntity;
  vehicleMileage: number;
  mileageUnit: MileageUnit;
  mileageWarningThresholdKm: number;
}): CardAxisStatus => {
  const { card, vehicleMileage, mileageUnit, mileageWarningThresholdKm } =
    params;
  if (card.nextDueMileage === null) return 'none';
  if (card.nextDueMileage <= vehicleMileage) return 'overdue';
  if (card.intervalMileage === null) return 'ok';
  const remainingNative = card.nextDueMileage - vehicleMileage;
  const remainingKm =
    mileageUnit === 'mile' ? remainingNative * MILES_TO_KM : remainingNative;
  if (remainingKm <= mileageWarningThresholdKm) return 'warning';
  return 'ok';
};

const getDateStatus = (params: {
  card: MaintenanceCardEntity;
  notificationDaysBefore: number;
  today: Date;
}): CardAxisStatus => {
  const { card, notificationDaysBefore, today } = params;
  if (card.nextDueDate === null) return 'none';
  const daysUntilDue = Math.floor(
    (startOfLocalDay(card.nextDueDate).getTime() -
      startOfLocalDay(today).getTime()) /
      MS_PER_DAY,
  );
  if (daysUntilDue <= 0) return 'overdue';
  if (daysUntilDue <= notificationDaysBefore) return 'warning';
  return 'ok';
};

const worst = (a: CardAxisStatus, b: CardAxisStatus): CardWarningStatus => {
  if (a === 'overdue' || b === 'overdue') return 'overdue';
  if (a === 'warning' || b === 'warning') return 'warning';
  return 'ok';
};

export const getCardStatus = (params: {
  card: MaintenanceCardEntity;
  vehicleMileage: number;
  mileageUnit: MileageUnit;
  mileageWarningThresholdKm: number;
  notificationDaysBefore: number;
  today: Date;
}): CardStatus => {
  const mileage = getMileageStatus(params);
  const date = getDateStatus(params);
  return { mileage, date, overall: worst(mileage, date) };
};

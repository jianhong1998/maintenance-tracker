import type { IMaintenanceCardResDTO, MileageUnit } from '@project/types';

export const MILES_TO_KM = 1.60934;
const MS_PER_DAY = 86_400_000;

export type CardAxisStatus = 'overdue' | 'warning' | 'ok' | 'none';

export type CardStatus = {
  mileage: CardAxisStatus;
  date: CardAxisStatus;
  overall: 'overdue' | 'warning' | 'ok';
};

export type CardWarningStatus = 'overdue' | 'warning' | 'ok';

const startOfLocalDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const daysUntilDue = (nextDueDateIso: string, today: Date): number => {
  const due = new Date(nextDueDateIso.slice(0, 10) + 'T00:00:00');
  return Math.floor(
    (startOfLocalDay(due).getTime() - startOfLocalDay(today).getTime()) /
      MS_PER_DAY,
  );
};

const getMileageStatus = (params: {
  card: IMaintenanceCardResDTO;
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
  card: IMaintenanceCardResDTO;
  notificationDaysBefore: number;
  today: Date;
}): CardAxisStatus => {
  const { card, notificationDaysBefore, today } = params;
  if (card.nextDueDate == null) return 'none';
  const d = daysUntilDue(card.nextDueDate, today);
  if (d <= 0) return 'overdue';
  if (d <= notificationDaysBefore) return 'warning';
  return 'ok';
};

const worst = (a: CardAxisStatus, b: CardAxisStatus): CardWarningStatus => {
  if (a === 'overdue' || b === 'overdue') return 'overdue';
  if (a === 'warning' || b === 'warning') return 'warning';
  return 'ok';
};

export const getCardStatus = (params: {
  card: IMaintenanceCardResDTO;
  vehicleMileage: number;
  mileageUnit: MileageUnit;
  mileageWarningThresholdKm: number;
  notificationDaysBefore: number;
  today?: Date;
}): CardStatus => {
  const today = params.today ?? new Date();
  const mileage = getMileageStatus(params);
  const date = getDateStatus({ ...params, today });
  return { mileage, date, overall: worst(mileage, date) };
};

export const getCardWarningStatus = (
  card: IMaintenanceCardResDTO,
  vehicleMileage: number,
  mileageUnit: MileageUnit,
  mileageWarningThresholdKm: number,
): CardWarningStatus =>
  getCardStatus({
    card,
    vehicleMileage,
    mileageUnit,
    mileageWarningThresholdKm,
    notificationDaysBefore: 7,
  }).overall;

export const countWarningCards = (
  cards: IMaintenanceCardResDTO[],
  vehicleMileage: number,
  mileageUnit: MileageUnit,
  mileageWarningThresholdKm: number,
): number =>
  cards.filter((card) => {
    const status = getCardWarningStatus(
      card,
      vehicleMileage,
      mileageUnit,
      mileageWarningThresholdKm,
    );
    return status === 'overdue' || status === 'warning';
  }).length;

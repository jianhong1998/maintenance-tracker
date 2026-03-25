import type { IMaintenanceCardResDTO, MileageUnit } from '@project/types';

const MILES_TO_KM = 1.60934;

export type CardWarningStatus = 'overdue' | 'warning' | 'ok';

/**
 * Computes the warning status of a single maintenance card.
 *
 * - 'overdue'  — nextDueDate < today OR nextDueMileage < vehicleMileage
 * - 'warning'  — mileage remaining (in km) <= mileageWarningThresholdKm
 *                (only when card has intervalMileage)
 * - 'ok'       — all clear
 */
export function getCardWarningStatus(
  card: IMaintenanceCardResDTO,
  vehicleMileage: number,
  mileageUnit: MileageUnit,
  mileageWarningThresholdKm: number,
): CardWarningStatus {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Date-based overdue check
  if (card.nextDueDate && card.nextDueDate.slice(0, 10) < todayStr) {
    return 'overdue';
  }

  // Mileage-based overdue check
  if (card.nextDueMileage !== null && card.nextDueMileage <= vehicleMileage) {
    return 'overdue';
  }

  // Mileage-based warning check (only when card has an interval_mileage)
  if (card.intervalMileage !== null && card.nextDueMileage !== null) {
    const remainingNative = card.nextDueMileage - vehicleMileage;
    const remainingKm =
      mileageUnit === 'mile' ? remainingNative * MILES_TO_KM : remainingNative;

    if (remainingKm <= mileageWarningThresholdKm) {
      return 'warning';
    }
  }

  return 'ok';
}

/**
 * Returns the count of cards that are either 'overdue' or 'warning'.
 */
export function countWarningCards(
  cards: IMaintenanceCardResDTO[],
  vehicleMileage: number,
  mileageUnit: MileageUnit,
  mileageWarningThresholdKm: number,
): number {
  return cards.filter((card) => {
    const status = getCardWarningStatus(
      card,
      vehicleMileage,
      mileageUnit,
      mileageWarningThresholdKm,
    );
    return status === 'overdue' || status === 'warning';
  }).length;
}

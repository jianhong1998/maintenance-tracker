import { describe, it, expect } from 'vitest';
import type { IMaintenanceCardResDTO } from '@project/types';
import { getCardWarningStatus, countWarningCards } from '@/lib/warning';

function makeCard(
  overrides: Partial<IMaintenanceCardResDTO> = {},
): IMaintenanceCardResDTO {
  return {
    id: 'card-1',
    vehicleId: 'vehicle-1',
    type: 'task',
    name: 'Oil Change',
    description: null,
    intervalMileage: 5000,
    intervalTimeMonths: 6,
    nextDueMileage: 60000,
    nextDueDate: '2099-01-01',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getCardWarningStatus', () => {
  it('returns overdue when nextDueDate is in the past', () => {
    const card = makeCard({ nextDueDate: '2020-01-01' });
    expect(getCardWarningStatus(card, 50000, 'km', 500)).toBe('overdue');
  });

  it('returns overdue when nextDueMileage < vehicleMileage', () => {
    const card = makeCard({ nextDueMileage: 40000, nextDueDate: '2099-01-01' });
    expect(getCardWarningStatus(card, 50000, 'km', 500)).toBe('overdue');
  });

  it('returns warning when remaining km <= threshold (km unit)', () => {
    // nextDueMileage=60000, vehicleMileage=59600, remaining=400, threshold=500
    const card = makeCard({ nextDueMileage: 60000 });
    expect(getCardWarningStatus(card, 59600, 'km', 500)).toBe('warning');
  });

  it('returns warning when remaining miles converted to km <= threshold (mile unit)', () => {
    // nextDueMileage=60000 miles, vehicleMileage=59700 miles
    // remaining = 300 miles * 1.60934 = 482.802 km, threshold=500
    const card = makeCard({ nextDueMileage: 60000 });
    expect(getCardWarningStatus(card, 59700, 'mile', 500)).toBe('warning');
  });

  it('returns ok when all clear', () => {
    const card = makeCard({ nextDueMileage: 60000, nextDueDate: '2099-01-01' });
    expect(getCardWarningStatus(card, 50000, 'km', 500)).toBe('ok');
  });

  it('does NOT trigger mileage warning when intervalMileage is null', () => {
    // intervalMileage=null means no mileage tracking; even if nextDueMileage is close, no warning
    const card = makeCard({
      intervalMileage: null,
      nextDueMileage: 50400,
      nextDueDate: '2099-01-01',
    });
    expect(getCardWarningStatus(card, 50000, 'km', 500)).toBe('ok');
  });

  it('returns "ok" when nextDueMileage is null and date is in the future', () => {
    const card = makeCard({
      nextDueMileage: null,
      intervalMileage: null,
      nextDueDate: '2099-01-01',
    });
    expect(getCardWarningStatus(card, 50000, 'km', 500)).toBe('ok');
  });

  it('returns overdue from date check before mileage check when both conditions exist', () => {
    // Both date overdue and mileage overdue; date check takes precedence (still overdue)
    const card = makeCard({ nextDueDate: '2020-01-01', nextDueMileage: 40000 });
    expect(getCardWarningStatus(card, 50000, 'km', 500)).toBe('overdue');
  });

  it('returns overdue when nextDueMileage === vehicleMileage (service is due now)', () => {
    // Exactly at service mileage — should be overdue, not warning
    const card = makeCard({ nextDueMileage: 50000, nextDueDate: '2099-01-01' });
    expect(getCardWarningStatus(card, 50000, 'km', 500)).toBe('overdue');
  });
});

describe('countWarningCards', () => {
  it('returns count of cards that are overdue or warning', () => {
    const cards: IMaintenanceCardResDTO[] = [
      makeCard({ id: '1', nextDueDate: '2020-01-01' }), // overdue
      makeCard({ id: '2', nextDueMileage: 40000 }), // overdue (mileage)
      makeCard({ id: '3', nextDueMileage: 60000 }), // ok
    ];
    expect(countWarningCards(cards, 50000, 'km', 500)).toBe(2);
  });

  it('returns 0 when all cards are ok', () => {
    const cards: IMaintenanceCardResDTO[] = [
      makeCard({ id: '1' }),
      makeCard({ id: '2' }),
    ];
    expect(countWarningCards(cards, 50000, 'km', 500)).toBe(0);
  });

  it('returns correct count with mixed statuses', () => {
    const cards: IMaintenanceCardResDTO[] = [
      makeCard({ id: '1', nextDueDate: '2020-01-01' }), // overdue
      makeCard({ id: '2', nextDueMileage: 59600 }), // warning (remaining 400km <= 500)
      makeCard({ id: '3', nextDueMileage: 60000, nextDueDate: '2099-01-01' }), // ok
    ];
    expect(countWarningCards(cards, 59200, 'km', 500)).toBe(2);
  });
});

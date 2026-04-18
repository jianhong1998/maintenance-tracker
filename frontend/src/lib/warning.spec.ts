import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  type IMaintenanceCardResDTO,
  MAINTENANCE_CARD_TYPES,
} from '@project/types';
import {
  getCardStatus,
  getCardWarningStatus,
  countWarningCards,
} from '@/lib/warning';

const FIXED_TODAY = new Date('2026-04-18T12:00:00');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

const makeCard = (
  overrides: Partial<IMaintenanceCardResDTO> = {},
): IMaintenanceCardResDTO => ({
  id: 'card-1',
  vehicleId: 'vehicle-1',
  type: MAINTENANCE_CARD_TYPES.TASK,
  name: 'Oil Change',
  description: null,
  intervalMileage: 5000,
  intervalTimeMonths: 6,
  nextDueMileage: 60000,
  nextDueDate: '2099-01-01',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const baseParams = {
  vehicleMileage: 50000,
  mileageUnit: 'km' as const,
  mileageWarningThresholdKm: 500,
  notificationDaysBefore: 7,
};

describe('getCardStatus — mileage axis', () => {
  it('returns "none" when nextDueMileage is null', () => {
    const card = makeCard({
      nextDueMileage: null,
      intervalMileage: null,
      nextDueDate: null,
    });
    expect(getCardStatus({ ...baseParams, card }).mileage).toBe('none');
  });

  it('returns "overdue" when nextDueMileage <= vehicleMileage', () => {
    const card = makeCard({ nextDueMileage: 50000, nextDueDate: null });
    expect(getCardStatus({ ...baseParams, card }).mileage).toBe('overdue');
  });

  it('returns "warning" when remaining km <= threshold', () => {
    const card = makeCard({ nextDueMileage: 50400, nextDueDate: null });
    expect(getCardStatus({ ...baseParams, card }).mileage).toBe('warning');
  });

  it('returns "ok" when remaining km > threshold', () => {
    const card = makeCard({ nextDueMileage: 60000, nextDueDate: null });
    expect(getCardStatus({ ...baseParams, card }).mileage).toBe('ok');
  });

  it('does NOT trigger mileage warning when intervalMileage is null', () => {
    const card = makeCard({
      intervalMileage: null,
      nextDueMileage: 50400,
      nextDueDate: null,
    });
    expect(getCardStatus({ ...baseParams, card }).mileage).toBe('ok');
  });
});

describe('getCardStatus — date axis', () => {
  it('returns "none" when nextDueDate is null', () => {
    const card = makeCard({ nextDueDate: null, nextDueMileage: null });
    expect(getCardStatus({ ...baseParams, card }).date).toBe('none');
  });

  it('returns "overdue" when daysUntilDue is -1', () => {
    const card = makeCard({ nextDueDate: '2026-04-17', nextDueMileage: null });
    expect(getCardStatus({ ...baseParams, card }).date).toBe('overdue');
  });

  it('returns "overdue" when daysUntilDue is 0 (due today)', () => {
    const card = makeCard({ nextDueDate: '2026-04-18', nextDueMileage: null });
    expect(getCardStatus({ ...baseParams, card }).date).toBe('overdue');
  });

  it('returns "warning" when 0 < daysUntilDue <= notificationDaysBefore', () => {
    const card = makeCard({ nextDueDate: '2026-04-25', nextDueMileage: null });
    expect(getCardStatus({ ...baseParams, card }).date).toBe('warning');
  });

  it('returns "ok" when daysUntilDue > notificationDaysBefore', () => {
    const card = makeCard({ nextDueDate: '2026-04-26', nextDueMileage: null });
    expect(getCardStatus({ ...baseParams, card }).date).toBe('ok');
  });
});

describe('getCardStatus — overall', () => {
  it('returns "overdue" when either axis is overdue', () => {
    const card = makeCard({ nextDueMileage: 60000, nextDueDate: '2020-01-01' });
    expect(getCardStatus({ ...baseParams, card }).overall).toBe('overdue');
  });

  it('returns "warning" when either axis is warning and neither is overdue', () => {
    const card = makeCard({ nextDueMileage: 50400, nextDueDate: '2099-01-01' });
    expect(getCardStatus({ ...baseParams, card }).overall).toBe('warning');
  });

  it('returns "ok" when both axes are ok', () => {
    const card = makeCard({ nextDueMileage: 60000, nextDueDate: '2099-01-01' });
    expect(getCardStatus({ ...baseParams, card }).overall).toBe('ok');
  });

  it('returns "ok" when both axes are none', () => {
    const card = makeCard({
      nextDueMileage: null,
      intervalMileage: null,
      nextDueDate: null,
    });
    expect(getCardStatus({ ...baseParams, card }).overall).toBe('ok');
  });
});

describe('getCardWarningStatus (back-compat wrapper)', () => {
  it('returns overall tier', () => {
    const card = makeCard({ nextDueDate: '2020-01-01' });
    expect(getCardWarningStatus(card, 50000, 'km', 500)).toBe('overdue');
  });

  it('does NOT trigger mileage warning when intervalMileage is null', () => {
    const card = makeCard({
      intervalMileage: null,
      nextDueMileage: 50400,
      nextDueDate: '2099-01-01',
    });
    expect(getCardWarningStatus(card, 50000, 'km', 500)).toBe('ok');
  });
});

describe('countWarningCards', () => {
  it('returns count of cards that are overdue or warning', () => {
    const cards: IMaintenanceCardResDTO[] = [
      makeCard({ id: '1', nextDueDate: '2020-01-01' }),
      makeCard({ id: '2', nextDueMileage: 40000 }),
      makeCard({ id: '3', nextDueMileage: 60000 }),
    ];
    expect(countWarningCards(cards, 50000, 'km', 500)).toBe(2);
  });
});

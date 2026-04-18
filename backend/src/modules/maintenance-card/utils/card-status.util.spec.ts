import { describe, it, expect } from 'vitest';
import type { MileageUnit } from '@project/types';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { getCardStatus } from './card-status.util';

const makeCard = (overrides: Partial<MaintenanceCardEntity> = {}) => {
  const card = new MaintenanceCardEntity();
  Object.assign(card, {
    id: 'card-1',
    vehicleId: 'vehicle-1',
    type: 'task',
    name: 'Oil Change',
    description: null,
    intervalMileage: 5000,
    intervalTimeMonths: 6,
    nextDueMileage: 60000,
    nextDueDate: new Date('2099-01-01'),
    ...overrides,
  });
  return card;
};

const baseParams = {
  vehicleMileage: 50000,
  mileageUnit: 'km' as MileageUnit,
  mileageWarningThresholdKm: 500,
  notificationDaysBefore: 7,
  today: new Date('2026-04-18T00:00:00'),
};

describe('getCardStatus — mileage axis', () => {
  it('returns "none" when nextDueMileage is null', () => {
    const card = makeCard({
      nextDueMileage: null,
      intervalMileage: null,
      nextDueDate: null,
    });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.mileage).toBe('none');
  });

  it('returns "overdue" when nextDueMileage <= vehicleMileage', () => {
    const card = makeCard({ nextDueMileage: 49999, nextDueDate: null });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.mileage).toBe('overdue');
  });

  it('returns "overdue" at exact equality (service is due now)', () => {
    const card = makeCard({ nextDueMileage: 50000, nextDueDate: null });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.mileage).toBe('overdue');
  });

  it('returns "warning" when remaining km <= threshold', () => {
    const card = makeCard({ nextDueMileage: 50400, nextDueDate: null });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.mileage).toBe('warning');
  });

  it('returns "ok" when remaining km > threshold', () => {
    const card = makeCard({ nextDueMileage: 60000, nextDueDate: null });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.mileage).toBe('ok');
  });

  it('does NOT trigger mileage warning when intervalMileage is null', () => {
    const card = makeCard({
      intervalMileage: null,
      nextDueMileage: 50400,
      nextDueDate: null,
    });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.mileage).toBe('ok');
  });

  it('converts miles to km for mile-unit vehicles', () => {
    const card = makeCard({ nextDueMileage: 60000, nextDueDate: null });
    const status = getCardStatus({
      ...baseParams,
      card,
      vehicleMileage: 59700,
      mileageUnit: 'mile',
    });
    expect(status.mileage).toBe('warning');
  });
});

describe('getCardStatus — date axis', () => {
  it('returns "none" when nextDueDate is null', () => {
    const card = makeCard({ nextDueDate: null, nextDueMileage: null });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.date).toBe('none');
  });

  it('returns "overdue" when daysUntilDue is -1', () => {
    const card = makeCard({
      nextDueDate: new Date('2026-04-17T00:00:00'),
      nextDueMileage: null,
    });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.date).toBe('overdue');
  });

  it('returns "overdue" when daysUntilDue is 0 (due today)', () => {
    const card = makeCard({
      nextDueDate: new Date('2026-04-18T00:00:00'),
      nextDueMileage: null,
    });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.date).toBe('overdue');
  });

  it('returns "warning" when 0 < daysUntilDue <= notificationDaysBefore', () => {
    const card = makeCard({
      nextDueDate: new Date('2026-04-25T00:00:00'),
      nextDueMileage: null,
    });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.date).toBe('warning');
  });

  it('returns "ok" when daysUntilDue > notificationDaysBefore', () => {
    const card = makeCard({
      nextDueDate: new Date('2026-04-26T00:00:00'),
      nextDueMileage: null,
    });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.date).toBe('ok');
  });
});

describe('getCardStatus — overall', () => {
  it('returns "overdue" when either axis is overdue', () => {
    const card = makeCard({
      nextDueMileage: 60000,
      nextDueDate: new Date('2020-01-01'),
    });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.overall).toBe('overdue');
  });

  it('returns "warning" when either axis is warning and neither is overdue', () => {
    const card = makeCard({
      nextDueMileage: 50400,
      nextDueDate: new Date('2099-01-01'),
    });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.overall).toBe('warning');
  });

  it('returns "ok" when both axes are ok or none', () => {
    const card = makeCard({
      nextDueMileage: 60000,
      nextDueDate: new Date('2099-01-01'),
    });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.overall).toBe('ok');
  });

  it('returns "ok" when both axes are none', () => {
    const card = makeCard({
      nextDueMileage: null,
      intervalMileage: null,
      nextDueDate: null,
    });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.overall).toBe('ok');
  });
});

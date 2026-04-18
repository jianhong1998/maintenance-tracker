import { describe, it, expect } from 'vitest';
import type { MileageUnit } from '@project/types';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { compareCardsByUrgency } from './card-sort.util';

const makeCard = (overrides: Partial<MaintenanceCardEntity> = {}) => {
  const card = new MaintenanceCardEntity();
  Object.assign(card, {
    id: 'card-id',
    vehicleId: 'vehicle-1',
    type: 'task',
    name: 'card',
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

describe('compareCardsByUrgency', () => {
  it('places overdue before warning before ok', () => {
    const overdue = makeCard({
      id: 'overdue',
      name: 'c',
      nextDueMileage: 40000,
      nextDueDate: null,
    });
    const warning = makeCard({
      id: 'warning',
      name: 'a',
      nextDueMileage: 50400,
      nextDueDate: null,
    });
    const ok = makeCard({
      id: 'ok',
      name: 'b',
      nextDueMileage: 60000,
      nextDueDate: null,
    });

    const sorted = [ok, warning, overdue].sort(
      compareCardsByUrgency(baseParams),
    );

    expect(sorted.map((c) => c.id)).toEqual(['overdue', 'warning', 'ok']);
  });

  it('within a tier, mileage-driven before date-driven', () => {
    const mileageDriven = makeCard({
      id: 'mileage',
      name: 'z',
      nextDueMileage: 40000,
      nextDueDate: new Date('2099-01-01'),
    });
    const dateDriven = makeCard({
      id: 'date',
      name: 'a',
      nextDueMileage: 60000,
      nextDueDate: new Date('2020-01-01'),
    });

    const sorted = [dateDriven, mileageDriven].sort(
      compareCardsByUrgency(baseParams),
    );

    expect(sorted.map((c) => c.id)).toEqual(['mileage', 'date']);
  });

  it('both-axes-in-tier cards sort as mileage-driven (Option A)', () => {
    const bothOverdue = makeCard({
      id: 'both',
      nextDueMileage: 40000,
      nextDueDate: new Date('2020-01-01'),
    });
    const dateOnly = makeCard({
      id: 'date-only',
      nextDueMileage: 60000,
      nextDueDate: new Date('2020-01-01'),
    });

    const sorted = [dateOnly, bothOverdue].sort(
      compareCardsByUrgency(baseParams),
    );

    expect(sorted.map((c) => c.id)).toEqual(['both', 'date-only']);
  });

  it('inert ok cards (no axes) land last within ok', () => {
    const ok = makeCard({
      id: 'ok',
      nextDueMileage: 60000,
      nextDueDate: null,
    });
    const inert = makeCard({
      id: 'inert',
      intervalMileage: null,
      nextDueMileage: null,
      nextDueDate: null,
    });

    const sorted = [inert, ok].sort(compareCardsByUrgency(baseParams));

    expect(sorted.map((c) => c.id)).toEqual(['ok', 'inert']);
  });

  it('mileage-driven cards sort by ascending remaining mileage', () => {
    const remaining1000 = makeCard({
      id: 'r1000',
      nextDueMileage: 51000,
      nextDueDate: null,
    });
    const remaining300 = makeCard({
      id: 'r300',
      nextDueMileage: 50300,
      nextDueDate: null,
    });

    const sorted = [remaining1000, remaining300].sort(
      compareCardsByUrgency(baseParams),
    );

    expect(sorted.map((c) => c.id)).toEqual(['r300', 'r1000']);
  });

  it('date-driven cards sort by ascending daysUntilDue', () => {
    const in5Days = makeCard({
      id: 'd5',
      nextDueMileage: null,
      intervalMileage: null,
      nextDueDate: new Date('2026-04-23T00:00:00'),
    });
    const in1Day = makeCard({
      id: 'd1',
      nextDueMileage: null,
      intervalMileage: null,
      nextDueDate: new Date('2026-04-19T00:00:00'),
    });

    const sorted = [in5Days, in1Day].sort(compareCardsByUrgency(baseParams));

    expect(sorted.map((c) => c.id)).toEqual(['d1', 'd5']);
  });

  it('two inert cards fall back to name tiebreaker (urgencyKey must not produce NaN)', () => {
    const zebra = makeCard({
      id: 'z-id',
      name: 'Zebra',
      intervalMileage: null,
      nextDueMileage: null,
      nextDueDate: null,
    });
    const alpha = makeCard({
      id: 'a-id',
      name: 'Alpha',
      intervalMileage: null,
      nextDueMileage: null,
      nextDueDate: null,
    });

    const sorted = [zebra, alpha].sort(compareCardsByUrgency(baseParams));

    expect(sorted.map((c) => c.id)).toEqual(['a-id', 'z-id']);
  });

  it('falls back to name tiebreaker when tier + driver + urgency are equal', () => {
    const alpha = makeCard({
      id: 'a-id',
      name: 'Alpha',
      nextDueMileage: 51000,
      nextDueDate: null,
    });
    const bravo = makeCard({
      id: 'b-id',
      name: 'Bravo',
      nextDueMileage: 51000,
      nextDueDate: null,
    });

    const sorted = [bravo, alpha].sort(compareCardsByUrgency(baseParams));

    expect(sorted.map((c) => c.id)).toEqual(['a-id', 'b-id']);
  });
});

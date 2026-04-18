# Expiry Date Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show per-card date-based expiry status (days left / due today / days overdue) on `MaintenanceCardRow`, mirroring the existing mileage display; extend `/config` with `notificationDaysBefore`; rewrite backend urgency sort to use per-axis tier + driver ordering.

**Architecture:** Pure helper functions for per-axis status (backend + frontend — each owns a copy). Backend sort is a pure comparator composed with `Array.sort`. Frontend row renders two right-aligned labels with independent per-axis colours and the 3× muted rule for ok cards. `/config` endpoint gains one field, consumed by the existing `useAppConfig` hook.

**Tech Stack:** TurboRepo (`packages/types`, `backend`, `frontend`, `api-test`). NestJS + TypeORM + `@nestjs/config`. Next.js 15 + TanStack Query. Vitest everywhere.

**Source spec:** `docs/superpowers/specs/2026-04-18-expiry-date-display-design.md`.

**Global commands** (run from repo root):

- `just format` — format all workspaces
- `just lint` — lint all workspaces
- `cd packages/types && pnpm build` — required after editing `packages/types`
- `cd backend && pnpm exec vitest run <path>` — run a single backend test
- `cd frontend && pnpm exec vitest run <path>` — run a single frontend test

**Branch:** `plan/000/plan-for-progress-bar-for-expiry-date` (current). Husky rewrites commit messages to `plan: 000 - <bare message>` — pass only the bare description.

---

## Task 1: Extend shared DTO with `notificationDaysBefore`

**Files:**
- Modify: `packages/types/src/dtos/config.dto.ts`

- [ ] **Step 1: Update the DTO**

Full new contents of `packages/types/src/dtos/config.dto.ts`:

```ts
export interface IAppConfigResDTO {
  mileageWarningThresholdKm: number;
  notificationDaysBefore: number;
}
```

- [ ] **Step 2: Rebuild the types package**

Run: `cd packages/types && pnpm build`
Expected: exits 0, `dist/` contains the updated `.d.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/dtos/config.dto.ts
git commit -m "add notificationDaysBefore to IAppConfigResDTO"
```

---

## Task 2: Backend `/config` returns `notificationDaysBefore`

**Files:**
- Modify: `backend/src/modules/config/config.controller.ts`
- Modify: `backend/src/modules/config/config.controller.spec.ts`

- [ ] **Step 1: Add the failing test cases**

Open `backend/src/modules/config/config.controller.spec.ts` and replace the existing `describe('#getConfig', …)` block with this (preserves the two original cases and adds two new ones):

```ts
describe('#getConfig', () => {
  it('returns mileageWarningThresholdKm and notificationDaysBefore from env', () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'MILEAGE_WARNING_THRESHOLD_KM') return 500;
      if (key === 'NOTIFICATION_DAYS_BEFORE') return 7;
      return undefined;
    });

    const result = controller.getConfig();

    expect(result).toEqual({
      mileageWarningThresholdKm: 500,
      notificationDaysBefore: 7,
    });
  });

  it('falls back to default 500 when MILEAGE_WARNING_THRESHOLD_KM is not set', () => {
    mockConfigService.get.mockReturnValue(undefined);

    const result = controller.getConfig();

    expect(result.mileageWarningThresholdKm).toBe(500);
  });

  it('falls back to default 7 when NOTIFICATION_DAYS_BEFORE is not set', () => {
    mockConfigService.get.mockReturnValue(undefined);

    const result = controller.getConfig();

    expect(result.notificationDaysBefore).toBe(7);
  });
});
```

- [ ] **Step 2: Run the spec and verify the new cases fail**

Run: `cd backend && pnpm exec vitest run src/modules/config/config.controller.spec.ts`
Expected: the two new cases fail — the first expects `notificationDaysBefore: 7` but the controller returns an object without that key; the third expects `notificationDaysBefore` to be `7` but it's `undefined`.

- [ ] **Step 3: Implement**

Replace the contents of `backend/src/modules/config/config.controller.ts` with:

```ts
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IAppConfigResDTO, IFeatureFlagResDTO } from '@project/types';
import { Public } from '../auth/decorators/public.decorator';
import { EnvironmentVariableUtil } from '../common/utils/environment-variable.util';

const DEFAULT_MILEAGE_WARNING_THRESHOLD_KM = 500;
const DEFAULT_NOTIFICATION_DAYS_BEFORE = 7;

@Controller('config')
export class ConfigController {
  constructor(
    private readonly configService: ConfigService,
    private readonly environmentVariableUtil: EnvironmentVariableUtil,
  ) {}

  @Public()
  @Get()
  getConfig(): IAppConfigResDTO {
    return {
      mileageWarningThresholdKm:
        this.configService.get<number>('MILEAGE_WARNING_THRESHOLD_KM') ??
        DEFAULT_MILEAGE_WARNING_THRESHOLD_KM,
      notificationDaysBefore:
        this.configService.get<number>('NOTIFICATION_DAYS_BEFORE') ??
        DEFAULT_NOTIFICATION_DAYS_BEFORE,
    };
  }

  @Public()
  @Get('feature-flag')
  getFeatureFlag(): IFeatureFlagResDTO {
    const { enableHistory, enableProfile } =
      this.environmentVariableUtil.getFeatureFlags();
    return { enableHistory, enableProfile };
  }
}
```

- [ ] **Step 4: Run the spec and verify green**

Run: `cd backend && pnpm exec vitest run src/modules/config/config.controller.spec.ts`
Expected: all cases pass.

- [ ] **Step 5: Format, lint, commit**

```bash
just format
just lint
git add backend/src/modules/config/config.controller.ts backend/src/modules/config/config.controller.spec.ts
git commit -m "return notificationDaysBefore from /config"
```

---

## Task 3: Backend — per-axis card status helper

**Files:**
- Create: `backend/src/modules/maintenance-card/utils/card-status.util.ts`
- Create: `backend/src/modules/maintenance-card/utils/card-status.util.spec.ts`

- [ ] **Step 1: Write the failing test**

Full contents of `backend/src/modules/maintenance-card/utils/card-status.util.spec.ts`:

```ts
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
    // nextDueMileage=50400, vehicleMileage=50000, remaining=400, threshold=500
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
    // remaining=300 miles * 1.60934 = 482.8 km, threshold=500 → warning
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
      nextDueDate: new Date('2026-04-25T00:00:00'), // +7 days
      nextDueMileage: null,
    });
    const status = getCardStatus({ ...baseParams, card });
    expect(status.date).toBe('warning');
  });

  it('returns "ok" when daysUntilDue > notificationDaysBefore', () => {
    const card = makeCard({
      nextDueDate: new Date('2026-04-26T00:00:00'), // +8 days
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
```

- [ ] **Step 2: Run the spec and verify it fails to import**

Run: `cd backend && pnpm exec vitest run src/modules/maintenance-card/utils/card-status.util.spec.ts`
Expected: FAIL — module `./card-status.util` not found.

- [ ] **Step 3: Implement the helper**

Full contents of `backend/src/modules/maintenance-card/utils/card-status.util.ts`:

```ts
import type { MileageUnit } from '@project/types';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';

export type CardAxisStatus = 'overdue' | 'warning' | 'ok' | 'none';

export type CardStatus = {
  mileage: CardAxisStatus;
  date: CardAxisStatus;
  overall: 'overdue' | 'warning' | 'ok';
};

const MILES_TO_KM = 1.60934;
const MS_PER_DAY = 86_400_000;

const startOfLocalDay = (date: Date): Date => {
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

const worst = (
  a: CardAxisStatus,
  b: CardAxisStatus,
): 'overdue' | 'warning' | 'ok' => {
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
```

- [ ] **Step 4: Run the spec and verify green**

Run: `cd backend && pnpm exec vitest run src/modules/maintenance-card/utils/card-status.util.spec.ts`
Expected: all cases pass.

- [ ] **Step 5: Format, lint, commit**

```bash
just format
just lint
git add backend/src/modules/maintenance-card/utils/card-status.util.ts backend/src/modules/maintenance-card/utils/card-status.util.spec.ts
git commit -m "add backend getCardStatus helper"
```

---

## Task 4: Backend — urgency comparator

**Files:**
- Create: `backend/src/modules/maintenance-card/utils/card-sort.util.ts`
- Create: `backend/src/modules/maintenance-card/utils/card-sort.util.spec.ts`

- [ ] **Step 1: Write the failing test**

Full contents of `backend/src/modules/maintenance-card/utils/card-sort.util.spec.ts`:

```ts
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
    // Both overdue, but first is mileage-driven, second is date-driven.
    const mileageDriven = makeCard({
      id: 'mileage',
      name: 'z',
      nextDueMileage: 40000, // mileage overdue
      nextDueDate: new Date('2099-01-01'), // date ok
    });
    const dateDriven = makeCard({
      id: 'date',
      name: 'a',
      nextDueMileage: 60000, // mileage ok
      nextDueDate: new Date('2020-01-01'), // date overdue
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
```

- [ ] **Step 2: Run and verify the test fails to import**

Run: `cd backend && pnpm exec vitest run src/modules/maintenance-card/utils/card-sort.util.spec.ts`
Expected: FAIL — module `./card-sort.util` not found.

- [ ] **Step 3: Implement the comparator**

Full contents of `backend/src/modules/maintenance-card/utils/card-sort.util.ts`:

```ts
import type { MileageUnit } from '@project/types';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { getCardStatus, type CardStatus } from './card-status.util';

type SortParams = {
  vehicleMileage: number;
  mileageUnit: MileageUnit;
  mileageWarningThresholdKm: number;
  notificationDaysBefore: number;
  today: Date;
};

const TIER_ORDER = { overdue: 0, warning: 1, ok: 2 } as const;

const driverRank = (status: CardStatus): 0 | 1 | 2 => {
  if (status.mileage === status.overall) return 0; // mileage-driven
  if (status.date === status.overall) return 1; // date-driven
  return 2; // inert (only reachable for overall=ok with both axes 'none')
};

const MS_PER_DAY = 86_400_000;

const startOfLocalDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
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
  return Number.POSITIVE_INFINITY;
};

export const compareCardsByUrgency =
  (params: SortParams) =>
  (a: MaintenanceCardEntity, b: MaintenanceCardEntity): number => {
    const statusA = getCardStatus({ ...params, card: a });
    const statusB = getCardStatus({ ...params, card: b });

    const tierDiff =
      TIER_ORDER[statusA.overall] - TIER_ORDER[statusB.overall];
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
```

- [ ] **Step 4: Run and verify green**

Run: `cd backend && pnpm exec vitest run src/modules/maintenance-card/utils/card-sort.util.spec.ts`
Expected: all cases pass.

- [ ] **Step 5: Format, lint, commit**

```bash
just format
just lint
git add backend/src/modules/maintenance-card/utils/card-sort.util.ts backend/src/modules/maintenance-card/utils/card-sort.util.spec.ts
git commit -m "add backend compareCardsByUrgency"
```

---

## Task 5: Wire the comparator into `MaintenanceCardService.listCards`

**Files:**
- Modify: `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`
- Modify: `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts`

- [ ] **Step 1: Read the existing service test to understand the current mocking pattern**

Run: `cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts --reporter=verbose 2>&1 | head -80`
(Just to confirm the current tests pass before changing anything.)
Expected: existing tests PASS.

- [ ] **Step 2: Add the failing test for the new sort**

Open `backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts` and add, inside the top-level `describe('MaintenanceCardService', …)` block, a new nested describe. If `ConfigService` is not already in the providers list, add it to the mock providers the same way `VehicleService` is mocked. Appended block (adjust imports at top of file accordingly):

```ts
describe('#listCards — urgency sort (tier + driver)', () => {
  it('orders cards by (overdue → warning → ok), mileage-driven before date-driven, then ascending remaining', async () => {
    const vehicle = { id: 'v1', mileage: 50000, mileageUnit: 'km' } as any;
    const cards = [
      // ok, mileage-driven, remaining 10000
      { id: 'ok-far', name: 'ok-far', nextDueMileage: 60000, nextDueDate: new Date('2099-01-01'), intervalMileage: 5000, type: 'task' },
      // overdue date-driven
      { id: 'overdue-date', name: 'overdue-date', nextDueMileage: 60000, nextDueDate: new Date('2020-01-01'), intervalMileage: 5000, type: 'task' },
      // overdue mileage-driven
      { id: 'overdue-mile', name: 'overdue-mile', nextDueMileage: 40000, nextDueDate: new Date('2099-01-01'), intervalMileage: 5000, type: 'task' },
      // warning mileage-driven
      { id: 'warn-mile', name: 'warn-mile', nextDueMileage: 50400, nextDueDate: new Date('2099-01-01'), intervalMileage: 5000, type: 'task' },
    ] as any[];

    mockVehicleService.getVehicle.mockResolvedValue(vehicle);
    mockCardRepository.getAll.mockResolvedValue(cards);
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'MILEAGE_WARNING_THRESHOLD_KM') return 500;
      if (key === 'NOTIFICATION_DAYS_BEFORE') return 7;
      return undefined;
    });

    const result = await service.listCards('v1', 'u1', 'urgency');

    expect(result.map((c) => c.id)).toEqual([
      'overdue-mile',
      'overdue-date',
      'warn-mile',
      'ok-far',
    ]);
  });
});
```

Also add (or confirm) at the top of the spec file, alongside the other mocks:

```ts
const mockConfigService = { get: vi.fn() };
```

and in the `Test.createTestingModule(...)` providers array:

```ts
{ provide: ConfigService, useValue: mockConfigService },
```

Import `ConfigService` from `@nestjs/config` at the top.

- [ ] **Step 3: Run and verify the new test fails**

Run: `cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts -t "urgency sort"`
Expected: FAIL — either `ConfigService` is undefined on the service, or sort order does not match.

- [ ] **Step 4: Update the service**

In `backend/src/modules/maintenance-card/services/maintenance-card.service.ts`:

a) At the top, add imports:

```ts
import { ConfigService } from '@nestjs/config';
import { compareCardsByUrgency } from '../utils/card-sort.util';
```

b) Delete the existing `sortByUrgency` function (lines ~48–96) entirely.

c) Update the constructor to inject `ConfigService`:

```ts
constructor(
  private readonly cardRepository: MaintenanceCardRepository,
  private readonly historyRepository: MaintenanceHistoryRepository,
  private readonly vehicleService: VehicleService,
  @InjectDataSource() private readonly dataSource: DataSource,
  private readonly backgroundJobRepository: BackgroundJobRepository,
  private readonly configService: ConfigService,
) {}
```

d) Replace the body of `listCards` with:

```ts
async listCards(
  vehicleId: string,
  userId: string,
  sort: 'urgency' | 'name',
): Promise<MaintenanceCardEntity[]> {
  const [vehicle, cards] = await Promise.all([
    this.vehicleService.getVehicle(vehicleId, userId),
    this.cardRepository.getAll({ criteria: { vehicleId } }),
  ]);

  if (sort === 'name') {
    return [...cards].sort((a, b) => a.name.localeCompare(b.name));
  }

  const mileageWarningThresholdKm =
    this.configService.get<number>('MILEAGE_WARNING_THRESHOLD_KM') ?? 500;
  const notificationDaysBefore =
    this.configService.get<number>('NOTIFICATION_DAYS_BEFORE') ?? 7;

  return [...cards].sort(
    compareCardsByUrgency({
      vehicleMileage: vehicle.mileage,
      mileageUnit: vehicle.mileageUnit,
      mileageWarningThresholdKm,
      notificationDaysBefore,
      today: new Date(),
    }),
  );
}
```

- [ ] **Step 5: Run the service spec**

Run: `cd backend && pnpm exec vitest run src/modules/maintenance-card/services/maintenance-card.service.spec.ts`
Expected: all cases (existing + new) PASS.

- [ ] **Step 6: Run the full backend test suite to catch regressions**

Run: `cd backend && pnpm test`
Expected: all PASS.

- [ ] **Step 7: Format, lint, commit**

```bash
just format
just lint
git add backend/src/modules/maintenance-card/services/maintenance-card.service.ts backend/src/modules/maintenance-card/services/maintenance-card.service.spec.ts
git commit -m "rewrite urgency sort to use tier+driver comparator"
```

---

## Task 6: Frontend — per-axis `getCardStatus` with back-compat wrapper

**Files:**
- Modify: `frontend/src/lib/warning.ts`
- Modify: `frontend/src/lib/warning.spec.ts`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `frontend/src/lib/warning.spec.ts` with:

```ts
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
```

- [ ] **Step 2: Run the spec and verify it fails**

Run: `cd frontend && pnpm exec vitest run src/lib/warning.spec.ts`
Expected: FAIL — `getCardStatus` not exported.

- [ ] **Step 3: Replace `warning.ts` with per-axis implementation**

Full contents of `frontend/src/lib/warning.ts`:

```ts
import type { IMaintenanceCardResDTO, MileageUnit } from '@project/types';

export const MILES_TO_KM = 1.60934;
const MS_PER_DAY = 86_400_000;

export type CardAxisStatus = 'overdue' | 'warning' | 'ok' | 'none';

export type CardStatus = {
  mileage: CardAxisStatus;
  date: CardAxisStatus;
  overall: 'overdue' | 'warning' | 'ok';
};

/**
 * Backwards-compatible three-value tier, for callers that only need the worst-of-both axes.
 */
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

/**
 * Back-compat wrapper — returns the worst-of-both tier. Prefer `getCardStatus` for new code.
 */
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
```

Note: the back-compat wrapper hardcodes `notificationDaysBefore: 7` because the existing callers (`countWarningCards`, `vehicles-layout`) don't pass it. This intentionally preserves pre-feature behaviour — they only looked at mileage warning and date-overdue before, and neither of those depends on `notificationDaysBefore`. Once the frontend fully migrates to `getCardStatus`, this wrapper can be deleted.

- [ ] **Step 4: Run the spec and verify green**

Run: `cd frontend && pnpm exec vitest run src/lib/warning.spec.ts`
Expected: all cases PASS.

- [ ] **Step 5: Format, lint, commit**

```bash
just format
just lint
git add frontend/src/lib/warning.ts frontend/src/lib/warning.spec.ts
git commit -m "add per-axis getCardStatus with backwards-compatible wrapper"
```

---

## Task 7: Frontend — `DEFAULT_NOTIFICATION_DAYS_BEFORE` constant

**Files:**
- Create: `frontend/src/constants/notification.ts`
- Modify: `frontend/src/constants/index.ts`

- [ ] **Step 1: Create the constant**

Full contents of `frontend/src/constants/notification.ts`:

```ts
/** Fallback days-before-expiry threshold when app config is unavailable. */
export const DEFAULT_NOTIFICATION_DAYS_BEFORE = 7;
```

- [ ] **Step 2: Re-export from the barrel**

Full contents of `frontend/src/constants/index.ts`:

```ts
export * from './error-message';
export * from './mileage';
export * from './notification';
```

- [ ] **Step 3: Commit**

```bash
just format
just lint
git add frontend/src/constants/notification.ts frontend/src/constants/index.ts
git commit -m "add DEFAULT_NOTIFICATION_DAYS_BEFORE constant"
```

---

## Task 8: Frontend — row renders dual label stack + per-axis colour + updated bar colour

**Files:**
- Modify: `frontend/src/components/maintenance-cards/maintenance-card-row.tsx`
- Modify: `frontend/src/components/maintenance-cards/maintenance-card-row.spec.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `frontend/src/components/maintenance-cards/maintenance-card-row.spec.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { IMaintenanceCardResDTO, IVehicleResDTO } from '@project/types';

vi.mock('@/hooks/queries/config/useAppConfig', () => ({
  useAppConfig: vi.fn(),
}));

import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { MaintenanceCardRow } from './maintenance-card-row';

const FIXED_TODAY = new Date('2026-04-18T12:00:00');

const mockVehicle: IVehicleResDTO = {
  id: 'vehicle-1',
  brand: 'Toyota',
  model: 'Camry',
  colour: 'Silver',
  mileage: 50000,
  mileageUnit: 'km',
  mileageLastUpdatedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockCard: IMaintenanceCardResDTO = {
  id: 'card-1',
  vehicleId: 'vehicle-1',
  name: 'Oil Change',
  type: 'task',
  description: null,
  intervalMileage: 5000,
  intervalTimeMonths: null,
  nextDueMileage: 51000,
  nextDueDate: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const defaultProps = {
  card: mockCard,
  vehicle: mockVehicle,
  isDropdownOpen: false,
  onDropdownToggle: vi.fn(),
  onEdit: vi.fn(),
  onMarkDone: vi.fn(),
  onDelete: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_TODAY);
  vi.mocked(useAppConfig).mockReturnValue({
    data: { mileageWarningThresholdKm: 500, notificationDaysBefore: 7 },
  } as ReturnType<typeof useAppConfig>);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MaintenanceCardRow — card chrome', () => {
  it('renders card name and type badge', () => {
    render(<MaintenanceCardRow {...defaultProps} />);
    expect(screen.getByText('Oil Change')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
  });

  it('applies overdue container classes when either axis is overdue', () => {
    const { container } = render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 49000 }}
      />,
    );
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('bg-[#ff44440a]');
    expect(row.className).toContain('border-[#ff444328]');
  });

  it('applies warning container classes when overall tier is warning', () => {
    const { container } = render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 50400 }}
      />,
    );
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('border-[#f59e0b28]');
  });

  it('applies healthy container classes when overall tier is ok', () => {
    const { container } = render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 60000 }}
      />,
    );
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('border-[#00e5ff15]');
  });
});

describe('MaintenanceCardRow — mileage label', () => {
  it('shows "N unit left" when mileage is ok/warning', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 51000 }}
      />,
    );
    expect(screen.getByText('1,000 km left')).toBeInTheDocument();
  });

  it('shows "N unit past due" when mileage is overdue', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 49000 }}
      />,
    );
    expect(screen.getByText('1,000 km past due')).toBeInTheDocument();
  });

  it('omits mileage label when nextDueMileage is null', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null }}
      />,
    );
    expect(screen.queryByText(/km left/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/km past due/i)).not.toBeInTheDocument();
  });

  it('uses mile unit for mile-unit vehicles', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        vehicle={{ ...mockVehicle, mileageUnit: 'mile', mileage: 31000 }}
        card={{ ...mockCard, nextDueMileage: 32000 }}
      />,
    );
    expect(screen.getByText('1,000 mile left')).toBeInTheDocument();
  });
});

describe('MaintenanceCardRow — date label', () => {
  it('shows "5 days left" when daysUntilDue is 5', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-23' }}
      />,
    );
    expect(screen.getByText('5 days left')).toBeInTheDocument();
  });

  it('shows "1 day left" (singular) when daysUntilDue is 1', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-19' }}
      />,
    );
    expect(screen.getByText('1 day left')).toBeInTheDocument();
  });

  it('shows "Due today" when daysUntilDue is 0', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-18' }}
      />,
    );
    expect(screen.getByText('Due today')).toBeInTheDocument();
  });

  it('shows "3 days overdue" when daysUntilDue is -3', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-15' }}
      />,
    );
    expect(screen.getByText('3 days overdue')).toBeInTheDocument();
  });

  it('shows "1 day overdue" (singular) when daysUntilDue is -1', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-17' }}
      />,
    );
    expect(screen.getByText('1 day overdue')).toBeInTheDocument();
  });

  it('omits date label when nextDueDate is null', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueDate: null }}
      />,
    );
    expect(screen.queryByText(/days left/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/due today/i)).not.toBeInTheDocument();
  });
});

describe('MaintenanceCardRow — per-axis label colours', () => {
  it('uses cyan for date label when daysUntilDue is within 3× threshold but > threshold', () => {
    // threshold=7, 3×=21. daysUntilDue=14 → cyan (within 3×, above warning)
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-05-02' }}
      />,
    );
    const label = screen.getByText('14 days left');
    expect(label.className).toContain('text-[#00e5ff]');
  });

  it('uses muted grey for date label when daysUntilDue > 3× threshold', () => {
    // threshold=7, 3×=21. daysUntilDue=22 → muted
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-05-10' }}
      />,
    );
    const label = screen.getByText('22 days left');
    expect(label.className).toContain('text-[#555]');
  });

  it('uses destructive red for overdue date label', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-10' }}
      />,
    );
    const label = screen.getByText('8 days overdue');
    expect(label.className).toContain('text-[#ff4444]');
  });

  it('uses amber for warning date label', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-22' }}
      />,
    );
    const label = screen.getByText('4 days left');
    expect(label.className).toContain('text-[#f59e0b]');
  });

  it('colours the two labels independently when one axis is ok and the other is overdue', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{
          ...mockCard,
          nextDueMileage: 60000, // ok, remaining 10000
          nextDueDate: '2020-01-01', // overdue
        }}
      />,
    );
    const mileageLabel = screen.getByText('10,000 km left');
    const dateLabel = screen.getByText(/days overdue/i);
    // Mileage far from due (10k > 3×500=1500) → muted
    expect(mileageLabel.className).toContain('text-[#555]');
    expect(dateLabel.className).toContain('text-[#ff4444]');
  });
});

describe('MaintenanceCardRow — progress bar', () => {
  it('renders a progress bar track when nextDueMileage is set', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 51000 }}
      />,
    );
    expect(screen.getByTestId('progress-bar-track')).toBeInTheDocument();
  });

  it('does not render a progress bar when nextDueMileage is null', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-05-01' }}
      />,
    );
    expect(screen.queryByTestId('progress-bar-track')).not.toBeInTheDocument();
  });

  it('bar colour follows the mileage axis even when overall is overdue due to date', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{
          ...mockCard,
          nextDueMileage: 60000, // mileage ok
          nextDueDate: '2020-01-01', // date overdue → overall overdue
        }}
      />,
    );
    const fill = document.querySelector(
      '[data-testid="progress-bar-track"] > div',
    ) as HTMLElement;
    // Healthy gradient (cyan), not red
    expect(fill.className).toContain('from-[#00e5ff40]');
    expect(fill.className).not.toContain('bg-[#ff4444]');
  });
});

describe('MaintenanceCardRow — no-axis card', () => {
  it('renders neither label stack nor progress bar when both axes are null', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: null }}
      />,
    );
    expect(screen.queryByText(/left|overdue|today|past due/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('progress-bar-track')).not.toBeInTheDocument();
  });
});

describe('MaintenanceCardRow — config fallbacks', () => {
  it('falls back to 500 km threshold when config is undefined', () => {
    vi.mocked(useAppConfig).mockReturnValue({
      data: undefined,
    } as ReturnType<typeof useAppConfig>);
    // remaining=400 km → warning at default threshold 500
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 50400 }}
      />,
    );
    const label = screen.getByText('400 km left');
    expect(label.className).toContain('text-[#f59e0b]');
  });

  it('falls back to 7-day threshold when config is undefined', () => {
    vi.mocked(useAppConfig).mockReturnValue({
      data: undefined,
    } as ReturnType<typeof useAppConfig>);
    // daysUntilDue=7 → warning at default threshold 7
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-25' }}
      />,
    );
    const label = screen.getByText('7 days left');
    expect(label.className).toContain('text-[#f59e0b]');
  });
});

describe('MaintenanceCardRow — dropdown', () => {
  it('renders the ⋮ menu button', () => {
    render(<MaintenanceCardRow {...defaultProps} />);
    expect(screen.getByRole('button', { name: /actions/i })).toBeInTheDocument();
  });

  it('shows Mark Done, Edit, Delete when isDropdownOpen is true', () => {
    render(<MaintenanceCardRow {...defaultProps} isDropdownOpen={true} />);
    expect(screen.getByRole('menuitem', { name: /mark done/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
  });

  it('calls onDropdownToggle with cardId when ⋮ clicked and closed', () => {
    const onDropdownToggle = vi.fn();
    render(
      <MaintenanceCardRow
        {...defaultProps}
        isDropdownOpen={false}
        onDropdownToggle={onDropdownToggle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    expect(onDropdownToggle).toHaveBeenCalledWith('card-1');
  });

  it('calls onMarkDone when Mark Done is clicked', () => {
    const onMarkDone = vi.fn();
    render(
      <MaintenanceCardRow
        {...defaultProps}
        isDropdownOpen={true}
        onMarkDone={onMarkDone}
      />,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: /mark done/i }));
    expect(onMarkDone).toHaveBeenCalledWith(mockCard);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd frontend && pnpm exec vitest run src/components/maintenance-cards/maintenance-card-row.spec.tsx`
Expected: FAIL — multiple cases fail (no date label renders, colour classes wrong, fallback for `notificationDaysBefore` missing).

- [ ] **Step 3: Rewrite the row component**

Full contents of `frontend/src/components/maintenance-cards/maintenance-card-row.tsx`:

```tsx
'use client';

import type { FC } from 'react';
import type { IMaintenanceCardResDTO, IVehicleResDTO } from '@project/types';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import {
  getCardStatus,
  daysUntilDue as computeDaysUntilDue,
  MILES_TO_KM,
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

/**
 * Mileage progress bar fill (0–100).
 * Overdue: 100. Warning: 60→99 linearly as remaining goes threshold→0.
 * Healthy: 0→59 as remaining goes (5×threshold)→threshold.
 */
const getProgressFill = (params: {
  remaining: number | null;
  thresholdNative: number;
  mileageStatus: CardAxisStatus;
}): number => {
  const { remaining, thresholdNative, mileageStatus } = params;
  if (mileageStatus === 'overdue') return 100;
  if (remaining === null) return 0;
  if (mileageStatus === 'warning') {
    return 60 + ((thresholdNative - remaining) / thresholdNative) * 39;
  }
  const lookahead = thresholdNative * 5;
  if (remaining >= lookahead) return 0;
  return (1 - remaining / lookahead) * 59;
};

const pluralise = (value: number, unit: 'day') =>
  `${value} ${value === 1 ? unit : `${unit}s`}`;

const getMileageLabel = (params: {
  card: IMaintenanceCardResDTO;
  vehicle: IVehicleResDTO;
  mileageStatus: CardAxisStatus;
}): string | null => {
  const { card, vehicle, mileageStatus } = params;
  if (card.nextDueMileage === null || mileageStatus === 'none') return null;
  const remaining = card.nextDueMileage - vehicle.mileage;
  if (mileageStatus === 'overdue') {
    return `${Math.abs(Math.round(remaining)).toLocaleString()} ${vehicle.mileageUnit} past due`;
  }
  return `${Math.round(remaining).toLocaleString()} ${vehicle.mileageUnit} left`;
};

const getDateLabel = (params: {
  card: IMaintenanceCardResDTO;
  today: Date;
  dateStatus: CardAxisStatus;
}): string | null => {
  const { card, today, dateStatus } = params;
  if (card.nextDueDate == null || dateStatus === 'none') return null;
  const days = computeDaysUntilDue(card.nextDueDate, today);
  if (days === 0) return 'Due today';
  if (days < 0) return `${pluralise(Math.abs(days), 'day')} overdue`;
  return `${pluralise(days, 'day')} left`;
};

/**
 * Per-axis label colour. 3× rule applies to both mileage and date when status is ok.
 */
const getAxisLabelColor = (params: {
  status: CardAxisStatus;
  remaining: number;
  threshold: number;
}): string => {
  const { status, remaining, threshold } = params;
  if (status === 'overdue') return 'text-[#ff4444]';
  if (status === 'warning') return 'text-[#f59e0b]';
  if (status === 'ok') {
    return remaining > 3 * threshold ? 'text-[#555]' : 'text-[#00e5ff]';
  }
  return 'text-[#555]';
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

  const thresholdNative =
    vehicle.mileageUnit === 'mile' ? thresholdKm / MILES_TO_KM : thresholdKm;

  const remainingMileage =
    card.nextDueMileage !== null ? card.nextDueMileage - vehicle.mileage : null;

  const progressFill = getProgressFill({
    remaining: remainingMileage,
    thresholdNative,
    mileageStatus: status.mileage,
  });

  const mileageLabel = getMileageLabel({
    card,
    vehicle,
    mileageStatus: status.mileage,
  });
  const mileageLabelColor =
    remainingMileage !== null
      ? getAxisLabelColor({
          status: status.mileage,
          remaining: remainingMileage,
          threshold: thresholdNative,
        })
      : 'text-[#555]';

  const dateLabel = getDateLabel({
    card,
    today,
    dateStatus: status.date,
  });
  const daysUntilDue =
    card.nextDueDate != null ? computeDaysUntilDue(card.nextDueDate, today) : 0;
  const dateLabelColor = getAxisLabelColor({
    status: status.date,
    remaining: daysUntilDue,
    threshold: notificationDaysBefore,
  });

  return (
    <div
      className={cn(
        'relative rounded-lg border p-[9px] hover-pointer:bg-[#111d2b]',
        getContainerClass(status.overall),
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-card-title truncate">{card.name}</p>
          <span className="inline-block mt-0.5 bg-[color:var(--bg-card)] border border-[#333] text-[color:var(--text-disabled)] text-[0.375rem] px-[4px] py-[1px] rounded">
            {TYPE_LABELS[card.type]}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex flex-col items-end">
            {mileageLabel && (
              <span
                className={cn('text-[0.625rem] font-bold', mileageLabelColor)}
              >
                {mileageLabel}
              </span>
            )}
            {dateLabel && (
              <span
                className={cn('text-[0.625rem] font-bold', dateLabelColor)}
              >
                {dateLabel}
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

      {remainingMileage !== null && (
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
              style={{ width: `${Math.min(progressFill, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run and verify green**

Run: `cd frontend && pnpm exec vitest run src/components/maintenance-cards/maintenance-card-row.spec.tsx`
Expected: all cases PASS.

- [ ] **Step 5: Run the full frontend test suite to catch regressions**

Run: `cd frontend && pnpm exec vitest run`
Expected: all PASS.

- [ ] **Step 6: Format, lint, commit**

```bash
just format
just lint
git add frontend/src/components/maintenance-cards/maintenance-card-row.tsx frontend/src/components/maintenance-cards/maintenance-card-row.spec.tsx
git commit -m "render per-card expiry date label with per-axis colours"
```

---

## Task 9: API integration tests for `/config` and sorted cards

**Files:**
- Modify: `api-test/src/tests/health-check.spec.ts`
- Modify: `api-test/src/tests/maintenance-cards.spec.ts`

- [ ] **Step 1: Inspect current `/config` coverage**

Run: `cd api-test && grep -n "/config" src/tests/*.spec.ts`
Expected: zero or one hit. If zero, the new test is additive; if one, extend it.

- [ ] **Step 2: Add the `/config` integration test**

If no existing `/config` test is found, append this `describe` block to `api-test/src/tests/health-check.spec.ts`:

```ts
describe('GET /config', () => {
  it('returns mileageWarningThresholdKm and notificationDaysBefore as numbers', async () => {
    const { data, status } = await axiosInstance.get('/config');
    expect(status).toBe(200);
    expect(typeof data.mileageWarningThresholdKm).toBe('number');
    expect(typeof data.notificationDaysBefore).toBe('number');
  });
});
```

If a `/config` test already exists, add the two `typeof` assertions to it.

- [ ] **Step 3: Add the urgency-sort integration test**

Append to `api-test/src/tests/maintenance-cards.spec.ts`, inside the existing `describe('#MaintenanceCards', …)` block (so the `vehicleId` setup/teardown applies):

```ts
describe('GET /vehicles/:vehicleId/maintenance-cards?sort=urgency (tier + driver)', () => {
  it('orders cards by tier (overdue → warning → ok) and driver (mileage → date) within tier', async () => {
    // Bring the vehicle to 50_000 km.
    await axiosInstance.post(
      `/vehicles/${vehicleId}/record-mileage`,
      { mileage: 50000 },
      authHeaders(),
    );

    const post = (payload: Partial<IMaintenanceCardResDTO> & { name: string }) =>
      axiosInstance.post<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards`,
        { type: 'task', intervalMileage: 5000, ...payload },
        authHeaders(),
      );

    const okFar = await post({
      name: 'ok-far',
      nextDueMileage: 60000,
      nextDueDate: '2099-01-01',
    });
    const overdueDate = await post({
      name: 'overdue-date',
      nextDueMileage: 60000,
      nextDueDate: '2020-01-01',
    });
    const overdueMile = await post({
      name: 'overdue-mile',
      nextDueMileage: 40000,
      nextDueDate: '2099-01-01',
    });
    const warnMile = await post({
      name: 'warn-mile',
      nextDueMileage: 50400,
      nextDueDate: '2099-01-01',
    });

    const res = await axiosInstance.get<IMaintenanceCardResDTO[]>(
      `/vehicles/${vehicleId}/maintenance-cards?sort=urgency`,
      authHeaders(),
    );

    const orderedIds = res.data.map((c) => c.id);
    expect(orderedIds).toEqual([
      overdueMile.data.id,
      overdueDate.data.id,
      warnMile.data.id,
      okFar.data.id,
    ]);
  });
});
```

If `/vehicles/:id/record-mileage` is not the correct endpoint name in this codebase, check `backend/src/modules/vehicle/controllers/vehicle.controller.ts` for the right route and adjust. The rest of the test does not depend on which helper updates mileage.

- [ ] **Step 4: Start services and run the API tests**

The API tests require the backend + db to be running.

```bash
just up-build
just test-api
```

Expected: the two new tests PASS along with the existing ones.

- [ ] **Step 5: Commit**

```bash
just format
just lint
git add api-test/src/tests/health-check.spec.ts api-test/src/tests/maintenance-cards.spec.ts
git commit -m "api-test coverage for /config and urgency sort"
```

---

## Task 10: Manual UI verification

- [ ] **Step 1: Start the full stack**

```bash
just up-build
```

Wait for the frontend to be reachable at `http://localhost:3000`.

- [ ] **Step 2: Seed / create test data**

Log in and, on any vehicle, create four cards to exercise the matrix:
1. Mileage-only card with `nextDueMileage` just below current mileage (overdue).
2. Date-only card with `nextDueDate` = yesterday (overdue).
3. Date-only card with `nextDueDate` = today (due today — should show `Due today` in red).
4. Date-only card with `nextDueDate` = in 5 days (warning — amber).
5. Date-only card with `nextDueDate` = in 22 days (ok, muted — should be grey if 3× rule works).
6. Card with both `nextDueMileage` and `nextDueDate` set — verify two labels stack (mileage top, date below).

- [ ] **Step 3: Visually verify**

Check for each card:
- Container colour matches the worst-of-both tier.
- Mileage label colour is independent of date label colour.
- Progress bar colour follows the mileage axis (cyan when mileage is ok, even if date is overdue).
- Sort toggled to `URGENCY` orders cards: overdue-mileage → overdue-date → warning-mileage → warning-date → ok.

- [ ] **Step 4: Record findings in the PR description**

No commit step — this is the manual sign-off gate.

---

## Task 11: Push and open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin plan/000/plan-for-progress-bar-for-expiry-date
```

- [ ] **Step 2: Open PR**

Use the branch's commits as the PR body summary. Title suggestion: `feat: expiry date display on maintenance cards`. The Husky hook handles the branch-prefixed subject on commits; the PR title itself is not rewritten.

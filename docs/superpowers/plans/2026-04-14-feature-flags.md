# Feature Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the History and Profile nav tabs (and their routes) behind backend-controlled feature flags exposed via `GET /feature-flag`.

**Architecture:** The backend reads `BACKEND_ENABLE_HISTORY` / `BACKEND_ENABLE_PROFILE` env vars via the existing `EnvironmentVariableUtil.getFeatureFlags()` and returns them from a new public `GET /feature-flag` endpoint. The frontend fetches this with a `useFeatureFlags` TanStack Query hook (`staleTime: Infinity`), passes the flags as props into `AppShellPresentation` to filter nav items, and uses a `FeatureFlagGuard` component (mirrors `AuthGuard`) to redirect disabled routes to `/`.

**Tech Stack:** NestJS (`@nestjs/config`, `ConfigService`), `@project/types` (shared DTOs), Next.js 15 App Router, TanStack Query v5, `next/navigation` (`useRouter`).

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `.env.template` | Add two new feature flag env vars |
| Modify | `packages/types/src/dtos/feature-flag.dto.ts` | **Create** — `IFeatureFlagResDTO` |
| Modify | `packages/types/src/dtos/index.ts` | Re-export new DTO |
| Modify | `backend/src/modules/common/utils/environment-variable.util.ts` | Add `enableHistory`, `enableProfile` to `IFeatureFlagList` and `getFeatureFlags()` |
| Modify | `backend/src/modules/config/config.controller.ts` | Add `GET /feature-flag` action, inject `EnvironmentVariableUtil` |
| Modify | `backend/src/modules/config/config.controller.spec.ts` | Test new endpoint |
| Modify | `frontend/src/hooks/queries/keys/key.ts` | Add `FEATURE_FLAG` to `QueryGroup` |
| Create | `frontend/src/hooks/queries/feature-flag/useFeatureFlags.ts` | TanStack Query hook |
| Create | `frontend/src/hooks/queries/feature-flag/useFeatureFlags.spec.ts` | Hook unit tests |
| Modify | `frontend/src/components/layout/app-shell-presentation.tsx` | Accept flag props, filter `NAV_ITEMS` |
| Modify | `frontend/src/components/layout/app-shell-presentation.spec.tsx` | Test nav filtering |
| Modify | `frontend/src/components/layout/app-shell.tsx` | Call `useFeatureFlags`, pass props |
| Create | `frontend/src/components/auth/feature-flag-guard.tsx` | Route guard component |
| Create | `frontend/src/components/auth/feature-flag-guard.spec.tsx` | Guard unit tests |
| Modify | `frontend/src/app/history/page.tsx` | Wrap with `FeatureFlagGuard` |
| Modify | `frontend/src/app/profile/page.tsx` | Wrap with `FeatureFlagGuard` |

---

## Task 1: Add env vars to `.env.template`

**Files:**
- Modify: `.env.template`

- [ ] **Step 1: Add the two new vars under the "Backend feature flag" section**

Open `.env.template`. The current feature flag block looks like:

```
# Backend feature flag
BACKEND_ENABLE_API_TEST_MODE=false # Set to 'true' when running API test
```

Replace it with:

```
# Backend feature flag
BACKEND_ENABLE_API_TEST_MODE=false # Set to 'true' when running API test
BACKEND_ENABLE_HISTORY=false
BACKEND_ENABLE_PROFILE=false
```

- [ ] **Step 2: Mirror the change in your local `.env`**

Add the same two lines to your local `.env` (not committed, but needed for the dev server to pick them up):

```
BACKEND_ENABLE_HISTORY=false
BACKEND_ENABLE_PROFILE=false
```

- [ ] **Step 3: Commit**

```bash
git add .env.template
git commit -m "add BACKEND_ENABLE_HISTORY and BACKEND_ENABLE_PROFILE to env template"
```

---

## Task 2: Add `IFeatureFlagResDTO` to shared types

**Files:**
- Create: `packages/types/src/dtos/feature-flag.dto.ts`
- Modify: `packages/types/src/dtos/index.ts`

- [ ] **Step 1: Create the DTO file**

Create `packages/types/src/dtos/feature-flag.dto.ts`:

```typescript
export interface IFeatureFlagResDTO {
  enableHistory: boolean;
  enableProfile: boolean;
}
```

- [ ] **Step 2: Re-export from the DTOs index**

Open `packages/types/src/dtos/index.ts`. Current content:

```typescript
export * from './auth.dto';
export * from './health-check.dto';
export * from './vehicle.dto';
export * from './maintenance-card.dto';
export * from './maintenance-history.dto';
export * from './config.dto';
```

Add:

```typescript
export * from './auth.dto';
export * from './health-check.dto';
export * from './vehicle.dto';
export * from './maintenance-card.dto';
export * from './maintenance-history.dto';
export * from './config.dto';
export * from './feature-flag.dto';
```

- [ ] **Step 3: Build the types package so backend and frontend can consume it**

```bash
cd packages/types && pnpm build
```

Expected: `dist/` updated with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/dtos/feature-flag.dto.ts packages/types/src/dtos/index.ts
git commit -m "add IFeatureFlagResDTO to shared types"
```

---

## Task 3: Extend `EnvironmentVariableUtil` with history and profile flags

**Files:**
- Modify: `backend/src/modules/common/utils/environment-variable.util.ts`

- [ ] **Step 1: Write the failing test first**

Open `backend/src/modules/common/utils/environment-variable.util.ts`. There is no spec file for this util yet. Check with:

```bash
ls backend/src/modules/common/utils/
```

If `environment-variable.util.spec.ts` does not exist, create it. If it does exist, add the cases below to it.

Create/update `backend/src/modules/common/utils/environment-variable.util.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EnvironmentVariableUtil } from './environment-variable.util';

const mockConfigService = {
  get: vi.fn(),
};

describe('EnvironmentVariableUtil', () => {
  let util: EnvironmentVariableUtil;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvironmentVariableUtil,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    util = module.get<EnvironmentVariableUtil>(EnvironmentVariableUtil);
  });

  describe('#getFeatureFlags', () => {
    it('returns enableHistory=true when BACKEND_ENABLE_HISTORY is "true"', () => {
      mockConfigService.get.mockImplementation((key: string, def: string) => {
        if (key === 'BACKEND_ENABLE_HISTORY') return 'true';
        return def ?? 'false';
      });

      expect(util.getFeatureFlags().enableHistory).toBe(true);
    });

    it('returns enableHistory=false when BACKEND_ENABLE_HISTORY is "false"', () => {
      mockConfigService.get.mockImplementation((_key: string, def: string) => def ?? 'false');

      expect(util.getFeatureFlags().enableHistory).toBe(false);
    });

    it('returns enableHistory=false when BACKEND_ENABLE_HISTORY is not set', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(util.getFeatureFlags().enableHistory).toBe(false);
    });

    it('returns enableProfile=true when BACKEND_ENABLE_PROFILE is "true"', () => {
      mockConfigService.get.mockImplementation((key: string, def: string) => {
        if (key === 'BACKEND_ENABLE_PROFILE') return 'true';
        return def ?? 'false';
      });

      expect(util.getFeatureFlags().enableProfile).toBe(true);
    });

    it('returns enableProfile=false when BACKEND_ENABLE_PROFILE is not set', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(util.getFeatureFlags().enableProfile).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend && pnpm exec vitest run src/modules/common/utils/environment-variable.util.spec.ts
```

Expected: FAIL — `enableHistory` and `enableProfile` are not yet on `IFeatureFlagList`.

- [ ] **Step 3: Extend `IFeatureFlagList` and `getFeatureFlags()`**

Open `backend/src/modules/common/utils/environment-variable.util.ts`. Find the `IFeatureFlagList` type and `getFeatureFlags()` method.

Current:

```typescript
type IFeatureFlagList = {
  // Feature Flag Related
  enableApiTestMode: boolean;
};
```

And current `getFeatureFlags()`:

```typescript
public getFeatureFlags(): IFeatureFlagList {
  if (!this.featureFlagList) {
    this.featureFlagList = {
      enableApiTestMode:
        this.configService.get<string>(
          'BACKEND_ENABLE_API_TEST_MODE',
          'false',
        ) === 'true',
    };
  }

  return this.featureFlagList;
}
```

Replace both with:

```typescript
type IFeatureFlagList = {
  // Feature Flag Related
  enableApiTestMode: boolean;
  enableHistory: boolean;
  enableProfile: boolean;
};
```

```typescript
public getFeatureFlags(): IFeatureFlagList {
  if (!this.featureFlagList) {
    this.featureFlagList = {
      enableApiTestMode:
        this.configService.get<string>(
          'BACKEND_ENABLE_API_TEST_MODE',
          'false',
        ) === 'true',
      enableHistory:
        this.configService.get<string>(
          'BACKEND_ENABLE_HISTORY',
          'false',
        ) === 'true',
      enableProfile:
        this.configService.get<string>(
          'BACKEND_ENABLE_PROFILE',
          'false',
        ) === 'true',
    };
  }

  return this.featureFlagList;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && pnpm exec vitest run src/modules/common/utils/environment-variable.util.spec.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/common/utils/environment-variable.util.ts backend/src/modules/common/utils/environment-variable.util.spec.ts
git commit -m "extend EnvironmentVariableUtil with enableHistory and enableProfile flags"
```

---

## Task 4: Add `GET /feature-flag` endpoint to `ConfigController`

**Files:**
- Modify: `backend/src/modules/config/config.controller.ts`
- Modify: `backend/src/modules/config/config.controller.spec.ts`

> **Context:** `CommonModule` is `@Global()`, so `EnvironmentVariableUtil` is available for injection in any module without importing `CommonModule` explicitly. `ConfigController` only needs to declare it as a constructor parameter.

- [ ] **Step 1: Write the failing tests**

Open `backend/src/modules/config/config.controller.spec.ts`. The existing file mocks `ConfigService` and tests `getConfig()`. Add a `mockEnvironmentVariableUtil` and tests for the new endpoint.

Replace the full content of the spec file with:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ConfigController } from './config.controller';
import { EnvironmentVariableUtil } from '../common/utils/environment-variable.util';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

const mockConfigService = {
  get: vi.fn(),
};

const mockEnvironmentVariableUtil = {
  getFeatureFlags: vi.fn(),
};

describe('ConfigController', () => {
  let controller: ConfigController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigController],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EnvironmentVariableUtil, useValue: mockEnvironmentVariableUtil },
      ],
    }).compile();

    controller = module.get<ConfigController>(ConfigController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getConfig is decorated with @Public()', () => {
    const method = Object.getOwnPropertyDescriptor(
      ConfigController.prototype,
      'getConfig',
    )?.value as object;
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, method) as boolean;
    expect(isPublic).toBe(true);
  });

  describe('#getConfig', () => {
    it('returns mileageWarningThresholdKm from env', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MILEAGE_WARNING_THRESHOLD_KM') return 500;
        return undefined;
      });

      const result = controller.getConfig();

      expect(result).toEqual({ mileageWarningThresholdKm: 500 });
    });

    it('falls back to default 500 when MILEAGE_WARNING_THRESHOLD_KM is not set', () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = controller.getConfig();

      expect(result.mileageWarningThresholdKm).toBe(500);
    });
  });

  it('getFeatureFlag is decorated with @Public()', () => {
    const method = Object.getOwnPropertyDescriptor(
      ConfigController.prototype,
      'getFeatureFlag',
    )?.value as object;
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, method) as boolean;
    expect(isPublic).toBe(true);
  });

  describe('#getFeatureFlag', () => {
    it('returns enableHistory and enableProfile from EnvironmentVariableUtil', () => {
      mockEnvironmentVariableUtil.getFeatureFlags.mockReturnValue({
        enableApiTestMode: false,
        enableHistory: true,
        enableProfile: false,
      });

      const result = controller.getFeatureFlag();

      expect(result).toEqual({ enableHistory: true, enableProfile: false });
    });

    it('returns false for both when flags are disabled', () => {
      mockEnvironmentVariableUtil.getFeatureFlags.mockReturnValue({
        enableApiTestMode: false,
        enableHistory: false,
        enableProfile: false,
      });

      const result = controller.getFeatureFlag();

      expect(result).toEqual({ enableHistory: false, enableProfile: false });
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend && pnpm exec vitest run src/modules/config/config.controller.spec.ts
```

Expected: FAIL — `getFeatureFlag` method does not exist yet.

- [ ] **Step 3: Implement the new endpoint**

Open `backend/src/modules/config/config.controller.ts`. Replace the full content with:

```typescript
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IAppConfigResDTO, IFeatureFlagResDTO } from '@project/types';
import { Public } from '../auth/decorators/public.decorator';
import { EnvironmentVariableUtil } from '../common/utils/environment-variable.util';

const DEFAULT_MILEAGE_WARNING_THRESHOLD_KM = 500;

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

> **Note on routing:** `@Controller('config')` + `@Get('feature-flag')` resolves to `GET /config/feature-flag`, not `GET /feature-flag`. The spec said `/feature-flag` but the controller is mounted at `/config`. To get `/feature-flag` you would need a separate controller. Confirm with the user if `/config/feature-flag` is acceptable. If `/feature-flag` is strictly required, create a new `FeatureFlagController` at `@Controller('feature-flag')` in its own module. For now, the plan uses `/config/feature-flag` to reuse the existing controller and module.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && pnpm exec vitest run src/modules/config/config.controller.spec.ts
```

Expected: all PASS.

- [ ] **Step 5: Run the full backend test suite to check for regressions**

```bash
cd backend && pnpm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/config/config.controller.ts backend/src/modules/config/config.controller.spec.ts
git commit -m "add GET /config/feature-flag endpoint to ConfigController"
```

---

## Task 5: Add `FEATURE_FLAG` to `QueryGroup`

**Files:**
- Modify: `frontend/src/hooks/queries/keys/key.ts`

- [ ] **Step 1: Write the failing test**

Open `frontend/src/hooks/queries/keys/key.spec.ts`. Current content:

```typescript
import { describe, it, expect } from 'vitest';
import { QueryGroup } from './key';

describe('QueryGroup', () => {
  it('should be frozen (immutable)', () => {
    expect(Object.isFrozen(QueryGroup)).toBe(true);
  });
});
```

Add a test that `FEATURE_FLAG` key exists:

```typescript
import { describe, it, expect } from 'vitest';
import { QueryGroup } from './key';

describe('QueryGroup', () => {
  it('should be frozen (immutable)', () => {
    expect(Object.isFrozen(QueryGroup)).toBe(true);
  });

  it('should contain FEATURE_FLAG key', () => {
    expect(QueryGroup.FEATURE_FLAG).toBe('feature-flag');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && pnpm exec vitest run src/hooks/queries/keys/key.spec.ts
```

Expected: FAIL — `QueryGroup.FEATURE_FLAG` is `undefined`.

- [ ] **Step 3: Add `FEATURE_FLAG` to `QueryGroup`**

Open `frontend/src/hooks/queries/keys/key.ts`. Replace the `QueryGroup` block:

```typescript
export const QueryGroup = Object.freeze({
  HEALTH_CHECK: 'health-check',
  CONFIG: 'config',
  VEHICLES: 'vehicles',
  MAINTENANCE_CARDS: 'maintenance-cards',
  FEATURE_FLAG: 'feature-flag',
} as const);
export type QueryGroup = (typeof QueryGroup)[keyof typeof QueryGroup];
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd frontend && pnpm exec vitest run src/hooks/queries/keys/key.spec.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/queries/keys/key.ts frontend/src/hooks/queries/keys/key.spec.ts
git commit -m "add FEATURE_FLAG to QueryGroup"
```

---

## Task 6: Create `useFeatureFlags` hook

**Files:**
- Create: `frontend/src/hooks/queries/feature-flag/useFeatureFlags.ts`
- Create: `frontend/src/hooks/queries/feature-flag/useFeatureFlags.spec.ts`

> **Context:** The backend endpoint is at `GET /config/feature-flag` (see Task 4 note). Update the path below if the final URL differs.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/hooks/queries/feature-flag/useFeatureFlags.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFeatureFlags } from './useFeatureFlags';
import { QueryGroup } from '../keys';
import { createWrapper, createWrapperWithClient } from '../test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

const mockFlags = { enableHistory: true, enableProfile: false };

describe('useFeatureFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses queryKey [QueryGroup.FEATURE_FLAG]', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockFlags);

    const { wrapper, queryClient } = createWrapperWithClient();
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient
      .getQueryCache()
      .findAll({ queryKey: [QueryGroup.FEATURE_FLAG] });
    expect(cached).toHaveLength(1);
  });

  it('calls apiClient.get("/config/feature-flag")', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockFlags);

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith('/config/feature-flag');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('returns the feature flags data', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockFlags);

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockFlags);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd frontend && pnpm exec vitest run src/hooks/queries/feature-flag/useFeatureFlags.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the hook**

Create `frontend/src/hooks/queries/feature-flag/useFeatureFlags.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import type { IFeatureFlagResDTO } from '@project/types';
import { QueryGroup } from '../keys';
import { apiClient } from '@/lib/api-client';

export const useFeatureFlags = () => {
  return useQuery<IFeatureFlagResDTO>({
    queryKey: [QueryGroup.FEATURE_FLAG],
    queryFn: async () => apiClient.get<IFeatureFlagResDTO>('/config/feature-flag'),
    staleTime: Infinity,
  });
};
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/hooks/queries/feature-flag/useFeatureFlags.spec.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/queries/feature-flag/useFeatureFlags.ts frontend/src/hooks/queries/feature-flag/useFeatureFlags.spec.ts
git commit -m "add useFeatureFlags query hook"
```

---

## Task 7: Update `AppShellPresentation` to filter nav items by flags

**Files:**
- Modify: `frontend/src/components/layout/app-shell-presentation.tsx`
- Modify: `frontend/src/components/layout/app-shell-presentation.spec.tsx`

- [ ] **Step 1: Write the failing tests**

Open `frontend/src/components/layout/app-shell-presentation.spec.tsx`. Add four new test cases at the end of the `describe` block (before the closing `}`):

```typescript
  it('hides History tab when enableHistory is false', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/"
        userDisplayName={null}
        enableHistory={false}
        enableProfile={true}
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    expect(screen.queryByText(/history/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/profile/i).length).toBeGreaterThan(0);
  });

  it('hides Profile tab when enableProfile is false', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/"
        userDisplayName={null}
        enableHistory={true}
        enableProfile={false}
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    expect(screen.getAllByText(/history/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/profile/i)).not.toBeInTheDocument();
  });

  it('shows both tabs when both flags are true', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/"
        userDisplayName={null}
        enableHistory={true}
        enableProfile={true}
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    expect(screen.getAllByText(/history/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/profile/i).length).toBeGreaterThan(0);
  });

  it('hides both tabs when both flags are false', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/"
        userDisplayName={null}
        enableHistory={false}
        enableProfile={false}
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    expect(screen.queryByText(/history/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/profile/i)).not.toBeInTheDocument();
  });
```

Also update the existing test `'renders nav with three peer items (Fleet, History, Profile) when showNav is true'` to pass the new props (it should still show all three when both are true):

```typescript
  it('renders nav with three peer items (Fleet, History, Profile) when showNav is true', () => {
    render(
      <AppShellPresentation
        showNav={true}
        pathname="/"
        userDisplayName="Jane Smith"
        enableHistory={true}
        enableProfile={true}
      >
        <div>page content</div>
      </AppShellPresentation>,
    );
    const navs = screen.getAllByRole('navigation');
    expect(navs.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/fleet/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/history/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/profile/i).length).toBeGreaterThan(0);
  });
```

Also update the remaining existing tests that render `AppShellPresentation` with `showNav={true}` to pass `enableHistory={true}` and `enableProfile={true}` so they don't accidentally hide tabs and break the `aria-current` assertions. Specifically:
- `'marks Fleet link as aria-current="page" when pathname is /'`
- `'marks History as active on /history (segment match)'`
- `'does not mark History as active on /history-foo (segment boundary)'`
- `'renders the user display name in the desktop sidebar'`

Add `enableHistory={true} enableProfile={true}` to each of these renders.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd frontend && pnpm exec vitest run src/components/layout/app-shell-presentation.spec.tsx
```

Expected: FAIL — `enableHistory` and `enableProfile` props don't exist yet (TypeScript will also error).

- [ ] **Step 3: Update `AppShellPresentation`**

Open `frontend/src/components/layout/app-shell-presentation.tsx`. Replace the full content with:

```typescript
import type { FC, ReactNode } from 'react';
import Link from 'next/link';
import { Car, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type AppShellPresentationProps = {
  showNav: boolean;
  pathname: string;
  userDisplayName: string | null;
  enableHistory: boolean;
  enableProfile: boolean;
  children: ReactNode;
};

type NavItemConfig = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const NAV_ITEMS: NavItemConfig[] = [
  { href: '/', label: 'Fleet', icon: Car },
  { href: '/history', label: 'History', icon: Clock },
  { href: '/profile', label: 'Profile', icon: User },
];

const isActive = (pathname: string, href: string): boolean => {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
};

export const AppShellPresentation: FC<AppShellPresentationProps> = ({
  showNav,
  pathname,
  userDisplayName,
  enableHistory,
  enableProfile,
  children,
}) => {
  if (!showNav) {
    return <>{children}</>;
  }

  const visibleNavItems = NAV_ITEMS.filter(({ href }) => {
    if (href === '/history') return enableHistory;
    if (href === '/profile') return enableProfile;
    return true;
  });

  return (
    <div className="flex min-h-screen bg-background">
      {/* Tablet + Desktop: left sidebar */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 z-40 w-[52px] xl:w-[140px] bg-[color:var(--bg-surface)] border-r border-[#00e5ff12]">
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-4">
          <div className="w-7 h-7 flex-shrink-0 rounded-lg bg-gradient-to-br from-[#00e5ff] to-[#0066ff]" />
          <span className="hidden xl:block text-eyebrow-primary">MTRACK</span>
        </div>

        {/* Nav items */}
        <nav
          aria-label="Primary"
          className="flex flex-col gap-1 px-2"
        >
          {visibleNavItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-md p-2 transition-colors',
                  'xl:flex-row xl:items-center xl:gap-2',
                  active
                    ? 'bg-[#00e5ff12] text-primary'
                    : 'text-[#444] hover:bg-[#0f1923] hover:text-[#888]',
                )}
              >
                <Icon
                  size={16}
                  className="flex-shrink-0"
                />
                <span className="text-[0.55rem] xl:text-xs font-semibold tracking-wide">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User avatar at bottom */}
        <div className="mt-auto p-3">
          <div className="flex flex-col xl:flex-row items-center gap-1 xl:gap-2">
            <div className="w-7 h-7 flex-shrink-0 rounded-full bg-[color:var(--bg-card)] border border-[#ffffff10] flex items-center justify-center">
              <User
                size={14}
                className="text-[#444]"
              />
            </div>
            <span className="hidden xl:block text-[#888] text-xs truncate max-w-[80px]">
              {userDisplayName ?? 'Profile'}
            </span>
          </div>
        </div>
      </aside>

      {/* Page content wrapper */}
      <div className="flex-1 min-w-0 md:ml-[52px] xl:ml-[140px] pb-[calc(3rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>

      {/* Mobile: bottom tab bar */}
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 inset-x-0 h-12 bg-[color:var(--bg-surface)] border-t border-[#00e5ff15] flex items-center justify-around z-40 px-4 pb-[env(safe-area-inset-bottom)]"
      >
        {visibleNavItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1 px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e5ff40] rounded',
                active ? 'text-primary' : 'text-[#444]',
              )}
            >
              {active && (
                <span className="w-1 h-1 rounded-full bg-primary mb-0.5" />
              )}
              <Icon size={16} />
              <span className="text-[0.55rem] font-semibold tracking-wide">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/components/layout/app-shell-presentation.spec.tsx
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/app-shell-presentation.tsx frontend/src/components/layout/app-shell-presentation.spec.tsx
git commit -m "filter nav items by feature flags in AppShellPresentation"
```

---

## Task 8: Update `AppShell` to fetch and pass feature flags

**Files:**
- Modify: `frontend/src/components/layout/app-shell.tsx`

> There is no spec file for `AppShell` — it is a thin container whose logic is covered by the presentation spec. No new tests needed here.

- [ ] **Step 1: Update `AppShell`**

Open `frontend/src/components/layout/app-shell.tsx`. Replace the full content with:

```typescript
'use client';

import type { FC, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthContext } from '@/contexts/auth-context';
import { useFeatureFlags } from '@/hooks/queries/feature-flag/useFeatureFlags';
import { AppShellPresentation } from './app-shell-presentation';

type AppShellProps = {
  children: ReactNode;
};

export const AppShell: FC<AppShellProps> = ({ children }) => {
  const { user, loading } = useAuthContext();
  const pathname = usePathname();
  const { data: featureFlags } = useFeatureFlags();

  const showNav = !loading && !!user && pathname !== '/login';
  const userDisplayName = user?.displayName ?? null;

  return (
    <AppShellPresentation
      showNav={showNav}
      pathname={pathname}
      userDisplayName={userDisplayName}
      enableHistory={featureFlags?.enableHistory ?? false}
      enableProfile={featureFlags?.enableProfile ?? false}
    >
      {children}
    </AppShellPresentation>
  );
};
```

- [ ] **Step 2: Run lint and format**

```bash
just format && just lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/app-shell.tsx
git commit -m "wire useFeatureFlags into AppShell and pass flags to AppShellPresentation"
```

---

## Task 9: Create `FeatureFlagGuard`

**Files:**
- Create: `frontend/src/components/auth/feature-flag-guard.tsx`
- Create: `frontend/src/components/auth/feature-flag-guard.spec.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/auth/feature-flag-guard.spec.tsx`:

```typescript
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeatureFlagGuard } from './feature-flag-guard';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  wrapper.displayName = 'TestQueryClientWrapper';
  return wrapper;
};

describe('FeatureFlagGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null while feature flags are loading', () => {
    // Never resolves — simulates loading state
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));

    const { container } = render(
      <FeatureFlagGuard flagKey="enableHistory">
        <div>Protected</div>
      </FeatureFlagGuard>,
      { wrapper: createWrapper() },
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders children when the flag is true', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      enableHistory: true,
      enableProfile: false,
    });

    render(
      <FeatureFlagGuard flagKey="enableHistory">
        <div>Protected Content</div>
      </FeatureFlagGuard>,
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(screen.getByText('Protected Content')).toBeInTheDocument(),
    );
  });

  it('redirects to / when the flag is false', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      enableHistory: false,
      enableProfile: false,
    });

    render(
      <FeatureFlagGuard flagKey="enableHistory">
        <div>Protected Content</div>
      </FeatureFlagGuard>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('renders null (no flash) when flag is false and redirect is in progress', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      enableHistory: false,
      enableProfile: false,
    });

    const { container } = render(
      <FeatureFlagGuard flagKey="enableHistory">
        <div>Protected Content</div>
      </FeatureFlagGuard>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(container.firstChild).toBeNull();
  });

  it('works for enableProfile flag key', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      enableHistory: false,
      enableProfile: true,
    });

    render(
      <FeatureFlagGuard flagKey="enableProfile">
        <div>Profile Content</div>
      </FeatureFlagGuard>,
      { wrapper: createWrapper() },
    );

    await waitFor(() =>
      expect(screen.getByText('Profile Content')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd frontend && pnpm exec vitest run src/components/auth/feature-flag-guard.spec.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `FeatureFlagGuard`**

Create `frontend/src/components/auth/feature-flag-guard.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import type { FC, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { IFeatureFlagResDTO } from '@project/types';
import { useFeatureFlags } from '@/hooks/queries/feature-flag/useFeatureFlags';

type FeatureFlagGuardProps = {
  flagKey: keyof IFeatureFlagResDTO;
  children: ReactNode;
};

export const FeatureFlagGuard: FC<FeatureFlagGuardProps> = ({
  flagKey,
  children,
}) => {
  const { data: featureFlags, isLoading } = useFeatureFlags();
  const router = useRouter();
  const enabled = featureFlags?.[flagKey] ?? false;

  useEffect(() => {
    if (!isLoading && !enabled) {
      router.replace('/');
    }
  }, [isLoading, enabled, router]);

  if (isLoading) {
    return null;
  }

  if (!enabled) {
    return null;
  }

  return <>{children}</>;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/components/auth/feature-flag-guard.spec.tsx
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/auth/feature-flag-guard.tsx frontend/src/components/auth/feature-flag-guard.spec.tsx
git commit -m "add FeatureFlagGuard component"
```

---

## Task 10: Gate History and Profile pages

**Files:**
- Modify: `frontend/src/app/history/page.tsx`
- Modify: `frontend/src/app/profile/page.tsx`

- [ ] **Step 1: Update History page**

Open `frontend/src/app/history/page.tsx`. Replace the full content with:

```typescript
'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { FeatureFlagGuard } from '@/components/auth/feature-flag-guard';

const HistoryContent = () => (
  <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
    <p className="text-eyebrow mb-2">HISTORY</p>
    <p className="text-[color:var(--text-muted)] text-sm">Coming soon.</p>
  </main>
);

export default function HistoryPage() {
  return (
    <AuthGuard>
      <FeatureFlagGuard flagKey="enableHistory">
        <HistoryContent />
      </FeatureFlagGuard>
    </AuthGuard>
  );
}
```

- [ ] **Step 2: Update Profile page**

Open `frontend/src/app/profile/page.tsx`. Replace the full content with:

```typescript
'use client';

import { AuthGuard } from '@/components/auth/auth-guard';
import { FeatureFlagGuard } from '@/components/auth/feature-flag-guard';

const ProfileContent = () => (
  <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
    <p className="text-eyebrow mb-2">PROFILE</p>
    <p className="text-[color:var(--text-muted)] text-sm">Coming soon.</p>
  </main>
);

export default function ProfilePage() {
  return (
    <AuthGuard>
      <FeatureFlagGuard flagKey="enableProfile">
        <ProfileContent />
      </FeatureFlagGuard>
    </AuthGuard>
  );
}
```

- [ ] **Step 3: Run the full frontend test suite**

```bash
cd frontend && pnpm exec vitest run
```

Expected: all PASS.

- [ ] **Step 4: Run lint and format across the repo**

```bash
just format && just lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/history/page.tsx frontend/src/app/profile/page.tsx
git commit -m "gate history and profile routes with FeatureFlagGuard"
```

---

## Verification

After all tasks are complete, do a manual smoke test:

1. Start the stack: `just up-build`
2. With `BACKEND_ENABLE_HISTORY=false` and `BACKEND_ENABLE_PROFILE=false` (default):
   - Nav shows only Fleet tab
   - Navigating to `/history` redirects to `/`
   - Navigating to `/profile` redirects to `/`
3. Set `BACKEND_ENABLE_HISTORY=true` in `.env`, restart backend:
   - History tab appears in nav
   - `/history` loads the "Coming soon" page
   - `/profile` still redirects to `/`
4. Set both to `true`:
   - Both tabs visible, both routes accessible

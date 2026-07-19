# App Version Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bake a build-time version string into the backend image, expose it at `GET /version`, and display it as persistent chrome (sidebar footer on md+, pinned strip above the tab bar on mobile).

**Architecture:** CI computes `APP_VERSION=${CIRCLE_TAG:-$CIRCLE_SHA1_SHORT}` and passes it as a Docker build-arg → `Dockerfile.backend` bakes it to `ENV BACKEND_APP_VERSION` → `AppService.getVersion()` reads `process.env` (fallback `'unreleased'`) → public `GET /version` → `useVersion()` TanStack Query hook → rendered in `AppShellPresentation`.

**Tech Stack:** NestJS (backend), Next.js 15 + TanStack Query (frontend), shared `@project/types`, Docker, CircleCI, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-19-app-version-display-design.md`
**Branch:** `feat/000/app-version-display` (already created)

## Global Constraints

- **Env var naming:** backend env vars MUST be prefixed `BACKEND_` → the baked var is `BACKEND_APP_VERSION`. The Docker build-arg is `APP_VERSION`.
- **Value rule:** tag build → git tag (`1.1.2`); commit build → short SHA (`730606c`); local → `unreleased`.
- **No TypeScript enums** — use `const` object / `as const` (query keys already follow this).
- **`@project/types` must be built before backend/frontend** — `turbo`'s `^build` enforces this; rebuild types after editing them.
- **Frontend:** arrow-function components with `FC` type; dark-only theme (never add `dark:` prefixes; use design tokens); strict equality (`===`/`!==`).
- **Commit messages are BARE** — the Husky `prepare-commit-msg` hook prepends `feat: 000 - `. Never add a type prefix yourself.
- **After editing code:** run `just format` then `just lint` before committing.
- **Display verbatim:** the UI shows exactly what the API returns — no conditional `v`-prefix, no per-trigger branching in app code.

---

### Task 1: Shared version type in `@project/types`

**Files:**
- Create: `packages/types/src/dtos/version.dto.ts`
- Modify: `packages/types/src/dtos/index.ts`

**Interfaces:**
- Produces: `type IVersionResDTO = { version: string }` (consumed by Tasks 2 and 4).

- [ ] **Step 1: Create the type**

`packages/types/src/dtos/version.dto.ts`:
```ts
export type IVersionResDTO = {
  version: string;
};
```

- [ ] **Step 2: Export it from the dtos barrel**

Add to `packages/types/src/dtos/index.ts` (append after the existing exports):
```ts
export * from './version.dto';
```

- [ ] **Step 3: Build the types package**

Run: `cd packages/types && pnpm build`
Expected: build succeeds; `packages/types/dist` contains the new declaration.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/dtos/version.dto.ts packages/types/src/dtos/index.ts
git commit -m "add IVersionResDTO shared type"
```

---

### Task 2: Backend `GET /version` endpoint

**Files:**
- Create: `backend/src/modules/app/dtos/version.dto.ts`
- Create: `backend/src/modules/app/controllers/app.controller.spec.ts`
- Modify: `backend/src/modules/app/services/app.service.ts`
- Modify: `backend/src/modules/app/services/app.service.spec.ts`
- Modify: `backend/src/modules/app/controllers/app.controller.ts`

**Interfaces:**
- Consumes: `IVersionResDTO` from `@project/types` (Task 1).
- Produces: `AppService.getVersion(): { version: string }`; `AppController.getVersion()` returning `VersionResDTO`; HTTP `GET /version` → `{ version: string }`.

- [ ] **Step 1: Write the failing service test**

Append to `backend/src/modules/app/services/app.service.spec.ts`:
```ts
describe('#getVersion', () => {
  const original = process.env.BACKEND_APP_VERSION;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.BACKEND_APP_VERSION;
    } else {
      process.env.BACKEND_APP_VERSION = original;
    }
  });

  it('returns the version from BACKEND_APP_VERSION when set', () => {
    process.env.BACKEND_APP_VERSION = '1.2.3';
    expect(new AppService().getVersion()).toEqual({ version: '1.2.3' });
  });

  it("falls back to 'unreleased' when BACKEND_APP_VERSION is unset", () => {
    delete process.env.BACKEND_APP_VERSION;
    expect(new AppService().getVersion()).toEqual({ version: 'unreleased' });
  });
});
```

- [ ] **Step 2: Run the service test to verify it fails**

Run: `cd backend && pnpm exec vitest run src/modules/app/services/app.service.spec.ts`
Expected: FAIL — `getVersion is not a function`.

- [ ] **Step 3: Implement `getVersion` in the service**

Modify `backend/src/modules/app/services/app.service.ts`:
```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  healthCheck(): { isHealthy: boolean } {
    return { isHealthy: true };
  }

  getVersion(): { version: string } {
    return { version: process.env.BACKEND_APP_VERSION ?? 'unreleased' };
  }
}
```

- [ ] **Step 4: Run the service test to verify it passes**

Run: `cd backend && pnpm exec vitest run src/modules/app/services/app.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Create the response DTO**

`backend/src/modules/app/dtos/version.dto.ts`:
```ts
import { IVersionResDTO } from '@project/types';

export class VersionResDTO implements IVersionResDTO {
  public version: string;

  constructor(params: { version: string }) {
    this.version = params.version;
  }
}
```

- [ ] **Step 6: Write the failing controller test**

Create `backend/src/modules/app/controllers/app.controller.spec.ts`:
```ts
import { AppController } from './app.controller';
import { AppService } from '../services/app.service';

describe('AppController', () => {
  describe('#getVersion', () => {
    it('wraps the service version in a VersionResDTO', () => {
      const appService = {
        getVersion: () => ({ version: '9.9.9' }),
      } as unknown as AppService;

      const controller = new AppController(appService);

      expect(controller.getVersion()).toEqual({ version: '9.9.9' });
    });
  });
});
```

- [ ] **Step 7: Run the controller test to verify it fails**

Run: `cd backend && pnpm exec vitest run src/modules/app/controllers/app.controller.spec.ts`
Expected: FAIL — `getVersion is not a function` on the controller.

- [ ] **Step 8: Add the endpoint to the controller**

Modify `backend/src/modules/app/controllers/app.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
import { AppService } from '../services/app.service';
import { HealthCheckResDTO } from '../dtos/health-check.dto';
import { VersionResDTO } from '../dtos/version.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello() {
    const result = this.appService.healthCheck();
    return new HealthCheckResDTO(result);
  }

  @Public()
  @Get('version')
  getVersion() {
    return new VersionResDTO(this.appService.getVersion());
  }
}
```

- [ ] **Step 9: Run both app specs to verify they pass**

Run: `cd backend && pnpm exec vitest run src/modules/app`
Expected: PASS (service + controller).

- [ ] **Step 10: Manually verify the running endpoint**

Ensure services are up (`just up-build` if needed), then:
Run: `curl -s http://localhost:3001/version`
Expected: `{"version":"unreleased"}` (no build-arg locally).

- [ ] **Step 11: Format, lint, commit**

```bash
just format && just lint
git add backend/src/modules/app packages/types
git commit -m "add GET /version endpoint returning baked app version"
```

---

### Task 3: Bake the version into the image (Docker + CI)

**Files:**
- Modify: `docker/deployment/Dockerfile.backend`
- Modify: `.circleci/config.yml`

**Interfaces:**
- Consumes: nothing from app code.
- Produces: `ENV BACKEND_APP_VERSION` inside the backend image (read by Task 2's service at runtime).

- [ ] **Step 1: Add ARG/ENV to the backend Dockerfile**

In `docker/deployment/Dockerfile.backend`, in the **production stage**, immediately after the existing `NODE_ENTRYPOINT` block and before `USER node`, add:
```dockerfile
# APP_VERSION is build-time artifact identity (NOT a runtime gate — the same
# value ships to prod and to pipeline-E2E because it is the same image).
# CI passes --build-arg APP_VERSION=${CIRCLE_TAG:-$CIRCLE_SHA1_SHORT}.
# Kept in this late layer so per-commit version changes don't bust build cache.
ARG APP_VERSION=unreleased
ENV BACKEND_APP_VERSION=${APP_VERSION}
```

- [ ] **Step 2: Verify the default (no build-arg) bakes `unreleased`**

Run:
```bash
docker build -f docker/deployment/Dockerfile.backend -t mt-backend-vertest .
docker run --rm --entrypoint node mt-backend-vertest -e "console.log(process.env.BACKEND_APP_VERSION)"
```
Expected: prints `unreleased`.

- [ ] **Step 3: Verify a passed build-arg bakes through**

Run:
```bash
docker build -f docker/deployment/Dockerfile.backend --build-arg APP_VERSION=1.2.3-test -t mt-backend-vertest .
docker run --rm --entrypoint node mt-backend-vertest -e "console.log(process.env.BACKEND_APP_VERSION)"
```
Expected: prints `1.2.3-test`.

- [ ] **Step 4: Pass the computed version in the CI build step**

In `.circleci/config.yml`, in the `docker-build-and-push` command, add the `APP_VERSION` computation and build-arg. The `run` block's `command` becomes:
```bash
CACHE_REPO="$AWS_ECR_REGISTRY/maintenance-tracker/cache/<< parameters.service >>"
IMAGE_REPO="$AWS_ECR_REGISTRY/maintenance-tracker/<< parameters.service >>"
BUILD_ARGS_FLAG=""
if [ -n "<< parameters.build_args >>" ]; then
  BUILD_ARGS_FLAG="--build-arg << parameters.build_args >>"
fi
# Tag builds → semver git tag; commit builds → short SHA. Empty tag falls back.
APP_VERSION="${CIRCLE_TAG:-$CIRCLE_SHA1_SHORT}"
docker buildx build \
  --platform linux/arm64 \
  $BUILD_ARGS_FLAG \
  --build-arg APP_VERSION="$APP_VERSION" \
  --cache-from "type=registry,ref=$CACHE_REPO" \
  --cache-to "type=registry,ref=$CACHE_REPO,mode=max" \
  --tag "$IMAGE_REPO:$CIRCLE_SHA1_SHORT" \
  --file "docker/deployment/<< parameters.dockerfile >>" \
  --push \
  .
```
Note: this build-arg is passed to every service build; only `Dockerfile.backend` declares/consumes it. The frontend build emits a harmless "unused build-arg" warning — acceptable.

- [ ] **Step 5: Validate the CI config (if the CLI is available)**

Run: `circleci config validate .circleci/config.yml`
Expected: `Config file at .circleci/config.yml is valid.`
(If the `circleci` CLI is not installed, skip — the edit is a localized string change.)

- [ ] **Step 6: Clean up the throwaway image and commit**

```bash
docker rmi mt-backend-vertest || true
git add docker/deployment/Dockerfile.backend .circleci/config.yml
git commit -m "bake APP_VERSION build-arg into backend image via CI"
```

---

### Task 4: Frontend `useVersion` query hook

**Files:**
- Modify: `frontend/src/hooks/queries/keys/key.ts`
- Create: `frontend/src/hooks/queries/version/useVersion.ts`
- Create: `frontend/src/hooks/queries/version/useVersion.spec.ts`

**Interfaces:**
- Consumes: `IVersionResDTO` from `@project/types` (Task 1); `apiClient.get<T>(endpoint)`; `getQueryKey`, `QueryGroup`, `QueryType` from `../keys`.
- Produces: `useVersion()` returning a TanStack Query result of `IVersionResDTO`; new `QueryGroup.VERSION = 'version'`.

- [ ] **Step 1: Add the VERSION query group**

In `frontend/src/hooks/queries/keys/key.ts`, add `VERSION: 'version',` to the `QueryGroup` object:
```ts
export const QueryGroup = Object.freeze({
  HEALTH_CHECK: 'health-check',
  CONFIG: 'config',
  VEHICLES: 'vehicles',
  MAINTENANCE_CARDS: 'maintenance-cards',
  FEATURE_FLAG: 'feature-flag',
  VERSION: 'version',
} as const);
```

- [ ] **Step 2: Write the failing hook test**

Create `frontend/src/hooks/queries/version/useVersion.spec.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useVersion } from './useVersion';
import { createWrapper } from '../test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';

describe('useVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls apiClient.get("/version")', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ version: '1.1.2' });

    const { result } = renderHook(() => useVersion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith('/version');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('returns the version data', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ version: '1.1.2' });

    const { result } = renderHook(() => useVersion(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ version: '1.1.2' });
  });
});
```

- [ ] **Step 3: Run the hook test to verify it fails**

Run: `cd frontend && pnpm exec vitest run src/hooks/queries/version/useVersion.spec.ts`
Expected: FAIL — cannot resolve `./useVersion`.

- [ ] **Step 4: Implement the hook**

Create `frontend/src/hooks/queries/version/useVersion.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import type { IVersionResDTO } from '@project/types';
import { getQueryKey, QueryGroup, QueryType } from '../keys';
import { apiClient } from '@/lib/api-client';

export const useVersion = () => {
  return useQuery<IVersionResDTO>({
    queryKey: getQueryKey({
      group: QueryGroup.VERSION,
      type: QueryType.ONE,
      key: '',
    }),
    queryFn: async () => apiClient.get<IVersionResDTO>('/version'),
    staleTime: Infinity,
  });
};
```

- [ ] **Step 5: Run the hook test to verify it passes**

Run: `cd frontend && pnpm exec vitest run src/hooks/queries/version/useVersion.spec.ts`
Expected: PASS.

- [ ] **Step 6: Format, lint, commit**

```bash
just format && just lint
git add frontend/src/hooks/queries/keys/key.ts frontend/src/hooks/queries/version
git commit -m "add useVersion query hook"
```

---

### Task 5: Display the version in AppShell (sidebar footer + mobile strip)

**Files:**
- Modify: `frontend/src/components/layout/app-shell.tsx`
- Modify: `frontend/src/components/layout/app-shell-presentation.tsx`
- Modify: `frontend/src/components/layout/app-shell-presentation.spec.tsx`

**Interfaces:**
- Consumes: `useVersion()` (Task 4); `AppShellPresentation` gains an optional `version?: string` prop.
- Produces: version rendered in the sidebar footer (md+, truncating on the 52px tablet rail) and in a fixed strip above the mobile tab bar.

- [ ] **Step 1: Write the failing presentation test**

Append to `frontend/src/components/layout/app-shell-presentation.spec.tsx`:
```ts
it('renders the version string when version is provided', () => {
  render(
    <AppShellPresentation
      showNav={true}
      pathname="/"
      userDisplayName="Jane Smith"
      featureFlags={allFlagsEnabled}
      version="1.1.2"
    >
      <div>page content</div>
    </AppShellPresentation>,
  );
  // Appears in both the sidebar footer and the mobile strip.
  expect(screen.getAllByText('1.1.2').length).toBeGreaterThan(0);
});

it('renders no version text when version is undefined', () => {
  render(
    <AppShellPresentation
      showNav={true}
      pathname="/"
      userDisplayName="Jane Smith"
      featureFlags={allFlagsEnabled}
    >
      <div>page content</div>
    </AppShellPresentation>,
  );
  expect(screen.queryByText('1.1.2')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the presentation test to verify it fails**

Run: `cd frontend && pnpm exec vitest run src/components/layout/app-shell-presentation.spec.tsx`
Expected: FAIL — `version` prop not accepted / text not found.

- [ ] **Step 3: Add the `version` prop to the presentation type**

In `frontend/src/components/layout/app-shell-presentation.tsx`, extend the props:
```ts
type AppShellPresentationProps = {
  showNav: boolean;
  pathname: string;
  userDisplayName: string | null;
  featureFlags?: IFeatureFlagResDTO;
  version?: string;
  children: ReactNode;
};
```
And destructure `version` in the component signature alongside the other props.

- [ ] **Step 4: Render the version in the sidebar footer**

In the same file, inside the sidebar `{/* User avatar at bottom */}` block, after the user-avatar `<div className="flex flex-col xl:flex-row ...">`, add a version line (truncates on the 52px rail, shows full on xl):
```tsx
{version && (
  <div className="mt-2 pt-2 border-t border-[#ffffff0a]">
    <span className="block text-center text-[0.5rem] text-[color:var(--text-secondary)] truncate">
      {version}
    </span>
  </div>
)}
```

- [ ] **Step 5: Render the mobile strip above the tab bar**

In the same file, immediately BEFORE the `{/* Mobile: bottom tab bar */}` `<nav>`, add a fixed strip sitting directly above the tab bar (mobile only). The strip's `bottom` offset equals the tab bar's full height (`3rem` + safe-area):
```tsx
{/* Mobile: version strip pinned above the tab bar */}
{version && (
  <div className="md:hidden fixed inset-x-0 bottom-[calc(3rem+env(safe-area-inset-bottom))] h-5 bg-[color:var(--bg-surface)] border-t border-[#00e5ff10] flex items-center justify-center z-40">
    <span className="text-[0.5rem] text-[color:var(--text-secondary)]">
      {version}
    </span>
  </div>
)}
```

- [ ] **Step 6: Grow the mobile content padding so nothing hides behind the strip**

In the same file, update the page content wrapper's mobile bottom padding to clear tab bar (`3rem`) + strip (`1.25rem`):
```tsx
{/* Page content wrapper */}
<div className="flex-1 min-w-0 md:ml-[52px] xl:ml-[140px] pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
  {children}
</div>
```

- [ ] **Step 7: Run the presentation test to verify it passes**

Run: `cd frontend && pnpm exec vitest run src/components/layout/app-shell-presentation.spec.tsx`
Expected: PASS.

- [ ] **Step 8: Wire `useVersion` through the container**

Modify `frontend/src/components/layout/app-shell.tsx`:
```tsx
'use client';

import type { FC, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthContext } from '@/contexts/auth-context';
import { useFeatureFlags } from '@/hooks/queries/feature-flag/useFeatureFlags';
import { useVersion } from '@/hooks/queries/version/useVersion';
import { AppShellPresentation } from './app-shell-presentation';

type AppShellProps = {
  children: ReactNode;
};

export const AppShell: FC<AppShellProps> = ({ children }) => {
  const { user, loading } = useAuthContext();
  const pathname = usePathname();
  const { data: featureFlags } = useFeatureFlags();
  const { data: versionData } = useVersion();

  const showNav = !loading && !!user && pathname !== '/login';
  const userDisplayName = user?.displayName ?? null;

  return (
    <AppShellPresentation
      showNav={showNav}
      pathname={pathname}
      userDisplayName={userDisplayName}
      featureFlags={featureFlags}
      version={versionData?.version}
    >
      {children}
    </AppShellPresentation>
  );
};
```

- [ ] **Step 9: Run the full layout test suite**

Run: `cd frontend && pnpm exec vitest run src/components/layout`
Expected: PASS (existing tests + the two new ones).

- [ ] **Step 10: Manually verify in the browser**

With services up and signed in:
- Desktop (≥1280px): version appears at the bottom of the left sidebar, below the avatar → shows `unreleased` locally.
- Mobile (<768px, e.g. 390px): version strip visible just above the bottom tab bar; scroll a long vehicle list and confirm the last card is not hidden behind the strip.

- [ ] **Step 11: Format, lint, commit**

```bash
just format && just lint
git add frontend/src/components/layout
git commit -m "display app version in sidebar footer and mobile strip"
```

---

## Verification Summary

- Backend unit tests: `cd backend && pnpm exec vitest run src/modules/app`
- Frontend unit tests: `cd frontend && pnpm exec vitest run src/hooks/queries/version src/components/layout`
- Endpoint: `curl -s http://localhost:3001/version` → `{"version":"unreleased"}`
- Bake path: `docker build --build-arg APP_VERSION=1.2.3-test ...` → container env reports `1.2.3-test`
- UI: version visible in sidebar footer (md+) and mobile strip, at all breakpoints, no content occluded.

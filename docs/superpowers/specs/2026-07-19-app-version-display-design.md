# App Version Display — Design

**Date:** 2026-07-19
**Status:** Approved (brainstorm + grill), ready for implementation plan
**Branch (proposed):** `feat/000/app-version-display`

---

## 1. Problem

There is currently no way to tell which version of the app is running on a
server. The deployed container does not know its own identity:

- `backend/package.json` = `0.0.1`, `frontend/package.json` = `0.1.0` — both
  stale and meaningless (real releases are on git tag `1.1.2`).
- Docker images are tagged in ECR by short git SHA (`CIRCLE_SHA1_SHORT`).
- **Nothing bakes any version into the image.** The `docker-build-and-push`
  step passes no version build-arg. The running app literally cannot report
  what it is.

## 2. Solution (one sentence)

Bake a single version string into the backend image at build time, expose it
via a public `GET /version` endpoint, and display it as persistent chrome in a
corner of the frontend.

## 3. Goals / Non-goals

**Goals**
- One version value that identifies exactly what is deployed.
- Visible in the UI on every breakpoint, always (persistent chrome).
- Correct value derived automatically from the build trigger — nothing to
  hand-bump.

**Non-goals (YAGNI)**
- No worker/background-job version reporting.
- No build timestamp or build-date field.
- No per-service (separate frontend vs backend) versioning — frontend and
  backend deploy in lockstep from the same commit/tag, so one value suffices.
- No fixing/aligning the stale `package.json` versions (out of scope; they are
  not the source of truth).

---

## 4. Decision log (from the grilling session)

### Q1 — What *is* "the version"?
**Answer / Decision:** A single value chosen by build trigger:

| Build trigger              | Value shown         | Source                 |
|----------------------------|---------------------|------------------------|
| Tag push → prod deploy     | `1.1.2`             | `$CIRCLE_TAG`          |
| Commit push → dev deploy   | `730606c`           | `$CIRCLE_SHA1_SHORT`   |
| Local development          | `unreleased`        | ENV default            |

**Reason:** The git tag is the human-meaningful release identifier; for
untagged dev builds the short SHA uniquely pins the exact commit. Local has
neither, so a literal `unreleased` is honest.

### Q2 — Control the version via a committed file?
**Decision:** **No.** Inject via Docker build-arg → ENV instead.
**Reason:** The discriminator "built from a tag or a plain commit?" exists only
in CI (`$CIRCLE_TAG` vs `$CIRCLE_SHA1_SHORT`). A committed file is a static
string; it cannot become the short SHA for untagged builds, and would drift —
exactly how `package.json` ended up stale at `0.0.1`. A CI-generated file would
work but adds generate → copy → read → parse for zero benefit over a build-arg.

### Q3 — Injection mechanism.
**Decision:** CI computes `APP_VERSION=${CIRCLE_TAG:-$CIRCLE_SHA1_SHORT}` in the
shared `docker-build-and-push` step (covers both the commit and tag workflows)
and passes `--build-arg APP_VERSION`. `Dockerfile.backend` declares `ARG`/`ENV`
**late** in the production stage (cache-safe). Backend reads
`process.env.BACKEND_APP_VERSION ?? 'unreleased'`.
**Reason:** Fewest moving parts; one computation covers all three cases; zero
branching in app code; nothing to hand-bump.

> **Not a runtime-gate pitfall.** Version is *build-time artifact identity* —
> the same value in real prod and in pipeline-E2E because it is the same image.
> This is the opposite of `FRONTEND_BACKEND_BASE_URL` (which must vary per
> deployment env). Baking at build time is correct here and does **not**
> conflict with `docs/code-review-related/002-build-time-vs-runtime-gates.md`.

### Q4 — Frontend placement.
**Decision:** Persistent chrome owned by `AppShellPresentation`:
- **md+ (≥768px):** sidebar footer, below the user avatar (sidebar is always
  visible).
- **mobile (<768px):** a fixed strip stacked directly above the bottom tab bar.

**Reason:** User wants the version shown across the app at all times (Option A2
from the mockup). Both spots are permanent chrome → glanceable everywhere.
Rejected: in-flow mobile footer (scrolls off with long vehicle lists) and
hide-on-mobile (can't check the deployed version from a phone).

---

## 5. Design

### 5.1 Version value in CI

`.circleci/config.yml` → `docker-build-and-push` command. Compute once and pass
as a build-arg:

```bash
APP_VERSION="${CIRCLE_TAG:-$CIRCLE_SHA1_SHORT}"
docker buildx build \
  ... \
  --build-arg APP_VERSION="$APP_VERSION" \
  ...
```

- Tag workflow: `$CIRCLE_TAG` is set (e.g. `1.1.2`) → used.
- Commit workflow: `$CIRCLE_TAG` empty → falls back to `$CIRCLE_SHA1_SHORT`
  (already computed by the `set-short-sha` step).
- The frontend image (`Dockerfile.frontend`) does not declare this ARG; passing
  it there produces only a harmless buildx "unused build-arg" warning. (Optional
  cleanup: declare a no-op `ARG APP_VERSION` in `Dockerfile.frontend` to silence
  it.) Only `Dockerfile.backend` consumes it.

### 5.2 Dockerfile.backend

Add next to the existing `ARG NODE_ENTRYPOINT` block in the **production
stage** (late layer → per-commit version changes don't bust the build cache):

```dockerfile
ARG APP_VERSION=unreleased
ENV BACKEND_APP_VERSION=${APP_VERSION}
```

Env var name carries the mandatory `BACKEND_` prefix. The worker image shares
this Dockerfile and will carry the same env harmlessly (it serves no HTTP).

### 5.3 Shared type — `@project/types`

New DTO, mirroring `health-check.dto.ts`:

```ts
// packages/types/src/dtos/version.dto.ts
export type IVersionResDTO = {
  version: string;
};
```

Export from `packages/types/src/index.ts` barrel. **Must be rebuilt before
backend/frontend** (`turbo` `^build` already enforces this).

### 5.4 Backend endpoint

Mirror the health-check pattern on the existing `AppController`:

```ts
// app.service.ts
getVersion(): { version: string } {
  return { version: process.env.BACKEND_APP_VERSION ?? 'unreleased' };
}

// version.dto.ts (backend)
export class VersionResDTO implements IVersionResDTO {
  public version: string;
  constructor(params: { version: string }) {
    this.version = params.version;
  }
}

// app.controller.ts
@Public()
@Get('version')
getVersion() {
  return new VersionResDTO(this.appService.getVersion());
}
```

- **Public** (no auth) — version is not sensitive and must be reachable for a
  simple health/version probe.
- No global API prefix exists (health check is served at `/`), so the path is
  `/version`.

### 5.5 Frontend

**Query key** — add `VERSION: 'version'` to `QueryGroup` in
`src/hooks/queries/keys/key.ts`.

**Hook** — `src/hooks/queries/version/useVersion.ts`, mirroring `useHealthCheck`:

```ts
export const useVersion = () =>
  useQuery<IVersionResDTO>({
    queryKey: getQueryKey({ group: QueryGroup.VERSION, type: QueryType.ONE, key: '' }),
    queryFn: async () => apiClient.get<IVersionResDTO>('/version'),
    staleTime: Infinity, // version cannot change within a session
  });
```

**Display** — the version string is passed into `AppShellPresentation` (the
container `app-shell.tsx` calls `useVersion` and threads `version` down, keeping
the presentation component pure). Rendered verbatim from the API — no
conditional `v`-prefix branch (no special cases).

Two render spots inside `AppShellPresentation`:

1. **Sidebar footer (md+):** a small line below the user-avatar block. Uses
   `.text-meta` / `--text-secondary` styling; on the collapsed 52px tablet rail
   the value is set vertically (or truncated) since `unreleased` won't fit
   horizontally.
2. **Mobile strip (<768px):** a thin, centered strip rendered as part of the
   fixed bottom stack, directly above the tab bar.

**Layout / safe-area detail (must-not-miss):** the mobile content wrapper
currently pads `pb-[calc(3rem+env(safe-area-inset-bottom))]` to clear the
`h-12` tab bar. Adding the version strip above the tab bar increases the
occupied bottom height, so **that bottom padding must grow by the strip
height**, otherwise the last vehicle card hides behind the strip. Cleanest
implementation: wrap version-strip + tab-bar in one fixed bottom container so
they share the safe-area inset and move together, and derive the content
padding from that combined height.

### 5.6 Data flow

```
CI (git tag OR commit)
  → APP_VERSION = ${CIRCLE_TAG:-$CIRCLE_SHA1_SHORT}
  → docker --build-arg APP_VERSION
    → Dockerfile.backend: ENV BACKEND_APP_VERSION
      → AppService.getVersion() reads process.env (?? 'unreleased')
        → GET /version → { version }
          → useVersion() (TanStack Query, staleTime Infinity)
            → AppShellPresentation renders in sidebar footer (md+)
              and pinned strip above tab bar (mobile)
```

---

## 6. Testing (TDD)

**Backend (Vitest):**
- `app.service.spec.ts` — `getVersion` returns `process.env.BACKEND_APP_VERSION`
  when set; returns `'unreleased'` when unset (set/restore env in the test).
- `app.controller.spec.ts` — `GET /version` returns a `VersionResDTO` wrapping
  the service value.

**Frontend (Vitest):**
- `useVersion` hook — calls `apiClient.get('/version')`, returns the DTO.
- `app-shell-presentation.spec.tsx` — renders the version string in the sidebar
  footer and the mobile strip.

**Integration (optional):** `api-test` assertion that `/version` responds `200`
with a `version` string.

**Manual end-to-end verification:**
- Local: `/version` returns `{ "version": "unreleased" }`; string renders in
  both the desktop sidebar footer and the mobile strip (verify last card is not
  hidden behind the strip, incl. iOS safe-area).
- Build image with `--build-arg APP_VERSION=1.2.3` and confirm the container
  reports `1.2.3` (proves the bake path without needing a real CI tag).

---

## 7. Files touched

**New**
- `packages/types/src/dtos/version.dto.ts`
- `backend/src/modules/app/dtos/version.dto.ts`
- `frontend/src/hooks/queries/version/useVersion.ts`
- `frontend/src/hooks/queries/version/useVersion.spec.ts`

**Modified**
- `.circleci/config.yml` — compute + pass `APP_VERSION` build-arg
- `docker/deployment/Dockerfile.backend` — `ARG APP_VERSION` / `ENV BACKEND_APP_VERSION`
- `packages/types/src/index.ts` — export `IVersionResDTO`
- `backend/src/modules/app/services/app.service.ts` — `getVersion`
- `backend/src/modules/app/controllers/app.controller.ts` — `GET /version`
- `backend/src/modules/app/services/app.service.spec.ts` — tests
- `frontend/src/hooks/queries/keys/key.ts` — `QueryGroup.VERSION`
- `frontend/src/components/layout/app-shell.tsx` — call `useVersion`, thread value
- `frontend/src/components/layout/app-shell-presentation.tsx` — render both spots + layout padding
- `frontend/src/components/layout/app-shell-presentation.spec.tsx` — tests
- `.env.template` — document `BACKEND_APP_VERSION` (optional; defaults to `unreleased`)

---

## 8. Edge cases

- **No tag, no build-arg (local):** ENV unset → `'unreleased'`. Covered by
  service fallback + test.
- **Long vehicle list on mobile:** strip is fixed above the tab bar (chosen
  A2), so it stays visible regardless of list length; content padding accounts
  for it so nothing is occluded.
- **Tablet 52px rail:** `unreleased` (10 chars) exceeds the rail width — render
  vertically or truncate; do not let it overflow the rail.
- **Build cache:** `ARG APP_VERSION` must stay in a late layer so a changing
  version per commit does not invalidate expensive earlier layers.

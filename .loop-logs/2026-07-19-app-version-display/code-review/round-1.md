# Code Review — Round 1

**Timestamp:** 2026-07-19T07:47:00Z
**Loop iteration:** 1 of ≤5

## Raw findings

### Reviewer A — enhanced-review

## Review: App Version Display — Code (enhanced-review, Linus + five-why)

### 【Taste Rating】 🟢 Good Taste — with one 🟡 layout finding.
Small, faithful to a well-reasoned spec, TDD-covered, eliminates special cases (single optional `version` prop rendered verbatim; graceful degradation when the query fails). Evidence: backend `pnpm exec vitest run src/modules/app` → PASS (4); frontend version+layout specs → PASS (19).

### 【Three Questions】
1. Real problem? Yes — containers genuinely couldn't report their identity (package.json stale at 0.0.1, nothing baked).
2. Simpler way? No, except the mobile layout (Finding 1, where the spec's own approach was simpler than what shipped).
3. Breaks anything? No functional break; one notched-device cosmetic risk (Finding 1).

### 【Findings】

**1. Mobile strip geometry — three coupled magic numbers + safe-area gap on notched devices — 🟡**
`app-shell-presentation.tsx:119,125,135` encode the same bottom-stack geometry three times: content `pb-[calc(4.25rem+safe-area)]`, strip `bottom-[calc(3rem+safe-area)]`, tab bar `h-12` + `pb-[safe-area]`. Under Tailwind `border-box` the tab bar footprint is exactly **3rem** (safe-area padding is *inside* the 3rem). But the strip is offset by `3rem + safe-area`, so on a 34px-inset iPhone the strip's bottom edge (82px) floats ~34px above the tab bar's top edge (48px) → transparent band showing page bg. Flush only when inset=0. Content padding coincidentally clears the strip, so nothing is occluded — the defect is purely the gap.
Root cause: the plan (lines 502–524) silently overrode the spec §5.5 recommendation to wrap strip+tab-bar in ONE fixed container sharing the safe-area inset.
Closing change: adopt the spec's single-container approach (one bottom wrapper, `pb-[safe-area]` applied once; tab-bar height in one place; content padding derived from combined height).

**2. Presentation test asserts ≥1 where it means "both spots" — 🟡 (test strength)**
`app-shell-presentation.spec.tsx` uses `getAllByText('1.1.2').length).toBeGreaterThan(0)`; both render sites are in the DOM (`md:hidden` is CSS-only). Should assert `toHaveLength(2)`.

**3. `VersionResDTO` is pure ceremony — 🟢 accepted.** Leave as-is (repo convention).

**4. `GET /version` public — 🟢 design-accepted** (spec §5.4).

**Positive:** `Dockerfile.backend:62-67` explicitly documents APP_VERSION as build-time artifact identity, NOT a runtime gate — correctly pre-empting the 002-build-time-vs-runtime-gates pitfall.

### 【Final Verdict】 ✅ SHIP IT — recommend fixing Findings 1 and 2 before merge.

### Reviewer B — ponytail
skipped — plugin not installed

### Reviewer C — simplify (code-simplifier agent)

## Verdict: 🟢 Clean. Ship it. No blocking simplifications.

Small, well-tested, consistently mirrors the existing `health-check` pattern across all 5 pieces. No cross-task duplication. No unnecessary abstraction from siloed implementation.

**1. `useVersion` vs `useAppConfig` — inconsistent singleton-resource key**
`frontend/src/hooks/queries/version/useVersion.ts:8-12`. Version is a singleton (like `config`), but borrows health-check's entity key: `getQueryKey({ type: QueryType.ONE, key: '' })`. `useAppConfig` handles the identical singleton case with a flat `[QueryGroup.CONFIG]` key plus a comment explaining why. Simpler: `queryKey: [QueryGroup.VERSION]`, matching `useAppConfig`. Caveat: `useBackendHealthCheck` already uses the `ONE/''` form, so both patterns pre-exist — this PR copied the wrong sibling. Low priority.

**2. `VersionResDTO` is a pure pass-through (leave as-is)** — flagged only, not a fix I'd insist on. Convention consistency worth more than shaving one class.

**3. `'unreleased'` default duplicated across two layers**
`docker/deployment/Dockerfile.backend` (`ARG APP_VERSION=unreleased`) + `backend/src/modules/app/services/app.service.ts:9` (`?? 'unreleased'`). Two independent defaults; `??` is nullish-only so an empty-string build-arg would bypass both defaults. Correctness edge, outside simplification scope. Low priority.

## Consolidated issues

| ID | Severity | Summary | Evidence (file:line) |
|----|----------|---------|----------------------|
| A1 | important | Mobile version strip sits `env(safe-area-inset-bottom)` above the tab bar on notched devices, opening a cosmetic gap (three uncoupled calc() geometry values instead of one shared source). Content padding still clears everything — purely cosmetic, notched-only. | `app-shell-presentation.tsx:119,125,135` |
| A2 | important | Test assertion `toBeGreaterThan(0)` should be `toHaveLength(2)` — both render sites are in the DOM simultaneously (CSS-only `md:hidden`), so the test would still pass if one site regressed away. | `app-shell-presentation.spec.tsx:264`; render sites `.tsx:108-114`, `:124-129` |
| C1 | important | `useVersion` uses `getQueryKey({ type: ONE, key: '' })` for a singleton resource instead of mirroring `useAppConfig`'s documented flat `[QueryGroup.VERSION]` singleton-key pattern. Functionally correct, but a genuine deviation from an established, documented convention. | `useVersion.ts:8-12`; `useAppConfig.ts:8-10` |
| C2 | minor | `'unreleased'` default duplicated between Dockerfile ARG and service `??` fallback; nullish-coalescing wouldn't catch an empty-string build-arg. Confirmed unreachable — CI's `APP_VERSION="${CIRCLE_TAG:-$CIRCLE_SHA1_SHORT}"` can never produce an empty string. | `Dockerfile.backend:66`, `app.service.ts:10`, `.circleci/config.yml:84,88` |

## Disposition

- Actionable (blocking + important) — to fix this iteration: A1, A2, C1
- Deferred (minor — NOT handled yet): C2 — duplicated 'unreleased' default is theoretically non-equivalent (empty-string edge) but unreachable via the actual CI pipeline; no fix warranted.

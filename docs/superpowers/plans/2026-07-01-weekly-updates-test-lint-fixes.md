# Weekly-Updates Lint & UI-Test Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `just lint` and `just test-ui` pass — deterministically — on the `chore/000/weekly-updates` branch, fixing failures introduced by Renovate dependency bumps.

**Architecture:** Three isolated changes. (1) Remove 9 redundant type assertions in two backend spec files that `typescript-eslint@8.62` now flags. (2) Add `dependsOn: ["^build"]` to turbo's `lint`/`lint:fix` so type-aware lint is deterministic (kills the `@project/types` build race). (3) Correct a stale Radix dialog overlay-dismiss test whose synthetic event no longer matches Radix's new deferred-dismiss timing. **No production application source changes.**

**Tech Stack:** Vitest, @testing-library/react, @radix-ui/react-dialog 1.1.17, typescript-eslint 8.62, NestJS, TurboRepo/pnpm via `just`.

## Global Constraints

- No changes to `frontend/src/components/ui/dialog.tsx` or any production source.
- No Radix version pins/reverts; keep `@radix-ui/react-dialog` at `^1.1.17`.
- No edits to `api-test` (canonically clean once lint is deterministic).
- Do not touch the `} as unknown as MaintenanceCardEntity` double-assertions or the
  inline `as { expiresAt: Date; jobType: string }` in the backend specs — the rule
  correctly does NOT flag them; they are necessary.
- Commit messages: bare description only — the Husky `prepare-commit-msg` hook prepends
  `chore: 000 - `. **Do not add the prefix yourself.** (`core.hooksPath = .husky`.)
- A Husky `pre-commit` hook runs `just format` + `just lint`. It will **block commits
  until Change 1 and Change 2 land.** Sequence the tasks so the first commit already
  carries a green lint (Task 1 + Task 2 are committed together).

---

### Task 1: Remove 9 redundant assertions in backend specs (auto-fix)

**Files:**
- Modify: `backend/src/modules/notification/notification.service.spec.ts` (lines 80, 81, 100, 111, 112, 125)
- Modify: `backend/src/modules/scheduler/scheduler.service.spec.ts` (lines 161, 204, 233)
- Test: lint is the verification; backend unit suite confirms no breakage.

**Interfaces:**
- Consumes: nothing.
- Produces: a lint-clean backend (Task 3's `just lint` depends on it).

**Context:** All 9 are `@typescript-eslint/no-unnecessary-type-assertion`, all
auto-fixable. They are compile-time-only casts (`as never`, `as BackgroundJobEntity`)
that Vitest+SWC strips, so removal cannot change runtime behavior.

- [ ] **Step 1: Confirm the failure (red), with types built to avoid the race**

Run:
```bash
pnpm turbo run build --filter=@project/types
cd backend && pnpm exec eslint "src/**/*.ts"
```
Expected: FAIL — `✖ 9 problems (9 errors, 0 warnings)`, all
`no-unnecessary-type-assertion`, in `notification.service.spec.ts` (6) and
`scheduler.service.spec.ts` (3).

- [ ] **Step 2: Apply the auto-fix**

Run:
```bash
cd backend && pnpm lint:fix
```
This removes exactly the 9 redundant assertions:
- `card as never` → `card`
- `undefined as never` → `undefined`
- `null as never` → `null`
- `{ id: 'job-1' } as BackgroundJobEntity` → `{ id: 'job-1' }`

- [ ] **Step 3: Verify the diff contains ONLY assertion removals**

Run:
```bash
git diff backend/src/modules/notification/notification.service.spec.ts backend/src/modules/scheduler/scheduler.service.spec.ts
```
Expected: only the removals above. Confirm these were NOT touched:
- `} as unknown as MaintenanceCardEntity;` (scheduler 157/200/229)
- `as { expiresAt: Date; jobType: string };` (scheduler ~209)
If anything else changed, revert and hand-edit only the 9 sites instead.

- [ ] **Step 4: Verify backend lint passes (green)**

Run:
```bash
cd backend && pnpm exec eslint "src/**/*.ts"
```
Expected: PASS, no errors.

- [ ] **Step 5: Verify the backend unit suite still passes**

Run:
```bash
just test-unit
```
Expected: PASS — no failures in `notification.service.spec.ts` or
`scheduler.service.spec.ts` (removals were type-only).

- [ ] **Step 6: Stage (do NOT commit yet — commit with Task 2 so the pre-commit gate is green)**

Run:
```bash
git add backend/src/modules/notification/notification.service.spec.ts backend/src/modules/scheduler/scheduler.service.spec.ts
```

---

### Task 2: Make turbo lint deterministic, then commit Tasks 1+2

**Files:**
- Modify: `turbo.json:16-21` (the `lint` and `lint:fix` task entries)

**Interfaces:**
- Consumes: Task 1's staged backend fix.
- Produces: deterministic `just lint`; the first green commit on this work.

**Context:** Type-aware lint races the `@project/types` build because `lint` has no
`dependsOn`. Adding `^build` mirrors the existing `build`/`test` tasks.

- [ ] **Step 1: Edit turbo.json**

Change:
```json
    "lint": {
      "outputs": []
    },
    "lint:fix": {
      "outputs": []
    },
```
to:
```json
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint:fix": {
      "dependsOn": ["^build"],
      "outputs": []
    },
```

- [ ] **Step 2: Verify full lint passes deterministically**

Run twice (the second run proves no flip):
```bash
just lint && just lint
```
Expected: PASS both times for all 5 packages. No
`no-unnecessary-type-assertion` errors, no `api-test` flip.

- [ ] **Step 3: Commit Tasks 1 + 2 together**

The pre-commit hook runs `just format` + `just lint`; both are now green, so the
commit proceeds. Provide a BARE message (the hook adds the `chore: 000 - ` prefix):
```bash
git add turbo.json
git commit -m "fix backend redundant assertions and make turbo lint deterministic"
```
Expected: commit succeeds; resulting message is
`chore: 000 - fix backend redundant assertions and make turbo lint deterministic`.

---

### Task 3: Fix stale Radix overlay-dismiss test

**Files:**
- Modify: `frontend/src/components/ui/dialog.spec.tsx:49-72` (the
  `calls onOpenChange(false) when the overlay is clicked` test)

**Interfaces:**
- Consumes: nothing from other tasks (independent).
- Produces: green `just test-ui`.

**Context:** `@radix-ui/react-dialog@1.1.17` sets `deferPointerDownOutside: true`; in
`@radix-ui/react-dismissable-layer@1.1.13` the dismiss now dispatches on `click`
(after `pointerdown`), not on `pointerdown` alone. `act` and `fireEvent` are already
imported (dialog.spec.tsx lines 1-2).

- [ ] **Step 1: Confirm the failure (red)**

Run:
```bash
cd frontend && pnpm exec vitest run src/components/ui/dialog.spec.tsx
```
Expected: FAIL —
```
× Dialog > calls onOpenChange(false) when the overlay is clicked
  → expected "spy" to be called with arguments: [ false ]
  Number of calls: 0
```

- [ ] **Step 2: Replace the test body to drive the full pointerdown→click interaction**

Replace the entire test (current lines 49-72):
```ts
  it('calls onOpenChange(false) when the overlay is clicked', () => {
    // Radix DismissableLayer registers its pointerdown listener after a setTimeout(0).
    // Use fake timers so we can advance the clock and activate the listener before dispatching.
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    render(
      <Dialog
        open={true}
        onOpenChange={onOpenChange}
        title="Test"
      >
        <p>content</p>
      </Dialog>,
    );
    // Advance fake timers to trigger Radix's deferred listener registration.
    act(() => {
      vi.runAllTimers();
    });
    const overlay = document.querySelector('[data-radix-dialog-overlay]');
    expect(overlay).not.toBeNull();
    fireEvent.pointerDown(overlay!);
    vi.useRealTimers();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
```
with:
```ts
  it('calls onOpenChange(false) when the overlay is clicked', () => {
    // Radix DismissableLayer (deferPointerDownOutside: true) registers its pointerdown
    // listener after a setTimeout(0), then defers the actual dismiss to the following
    // click. Use fake timers to activate the listener, then simulate the full
    // pointerdown -> click sequence a real user produces on the overlay.
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    render(
      <Dialog
        open={true}
        onOpenChange={onOpenChange}
        title="Test"
      >
        <p>content</p>
      </Dialog>,
    );
    // Advance fake timers to trigger Radix's deferred listener registration.
    act(() => {
      vi.runAllTimers();
    });
    const overlay = document.querySelector('[data-radix-dialog-overlay]');
    expect(overlay).not.toBeNull();
    fireEvent.pointerDown(overlay!);
    fireEvent.click(overlay!);
    act(() => {
      vi.runAllTimers();
    });
    vi.useRealTimers();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
```

- [ ] **Step 3: Verify this test passes (green)**

Run:
```bash
cd frontend && pnpm exec vitest run src/components/ui/dialog.spec.tsx
```
Expected: PASS — `5 passed (5)`.

If still 0 calls: add an `act(() => { vi.runAllTimers(); })` between the
`fireEvent.pointerDown` and `fireEvent.click` to flush the deferred listener
registration, then re-run. Do NOT change `dialog.tsx`.

- [ ] **Step 4: Commit**

Bare message (hook adds prefix):
```bash
git add frontend/src/components/ui/dialog.spec.tsx
git commit -m "fix overlay-dismiss test for radix-dialog 1.1.17 deferred pointer-down"
```

---

### Task 4: Full-suite verification

**Files:** none modified.

**Interfaces:**
- Consumes: green states from Tasks 1-3.
- Produces: final confirmation both gates pass deterministically.

- [ ] **Step 1: Lint, twice, to prove determinism**

Run:
```bash
just lint && just lint
```
Expected: PASS both runs, all 5 packages.

- [ ] **Step 2: UI test suite**

Run:
```bash
just test-ui
```
Expected: PASS — `Test Files 45 passed (45)`, `Tests 391 passed (391)`.

- [ ] **Step 3: Backend unit suite (regression guard for Task 1)**

Run:
```bash
just test-unit
```
Expected: PASS.

- [ ] **Step 4: Confirm no unintended changes**

Run:
```bash
git diff --stat origin/main...HEAD
```
Expected changed files limited to: `turbo.json`,
`backend/src/modules/notification/notification.service.spec.ts`,
`backend/src/modules/scheduler/scheduler.service.spec.ts`,
`frontend/src/components/ui/dialog.spec.tsx`, and the spec/plan docs. **No** change to
`dialog.tsx`, any `package.json`, or `api-test`.

---

## Self-Review

**Spec coverage:**
- Change 1 (backend 9 assertions) → Task 1. ✓
- Change 2 (turbo lint determinism) → Task 2. ✓
- Change 3 (dialog deferred-dismiss test) → Task 3. ✓
- Validation (`just lint` ×2, `just test-ui`, `just test-unit`) → Task 4. ✓
- Out-of-scope guards (no dialog.tsx, no api-test, no double-assertion edits) →
  Global Constraints + Task 1 Step 3 + Task 4 Step 4. ✓

**Placeholder scan:** No TBD/TODO/vague steps. Full before/after shown for every edit. ✓

**Type consistency:** `BackgroundJobEntity`, `MaintenanceCardEntity`, `onOpenChange`,
`fireEvent.pointerDown/click`, `act`, `vi.runAllTimers` all match existing code. The
pre-commit-gate ordering (Tasks 1+2 commit together) is consistent with the Husky
constraint. ✓

No gaps found.

# Task 5 Log: Display the version in AppShell (sidebar footer + mobile strip)

## Task Context

### Plan Section
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
- [ ] **Step 3: Add the `version` prop to the presentation type**
- [ ] **Step 4: Render the version in the sidebar footer**
- [ ] **Step 5: Render the mobile strip above the tab bar**
- [ ] **Step 6: Grow the mobile content padding so nothing hides behind the strip**
- [ ] **Step 7: Run the presentation test to verify it passes**
- [ ] **Step 8: Wire `useVersion` through the container**
- [ ] **Step 9: Run the full layout test suite**
- [ ] **Step 10: Manually verify in the browser** (delegated to separate verification stage — skipped here)
- [ ] **Step 11: Format, lint, commit**

### Acceptance Criteria
- AC-1: version renders in both sidebar footer and mobile strip when provided
- AC-2: renders nothing when `version` is undefined
- AC-3: mobile content padding grows to clear the strip + tab bar
- AC-4: version prop threaded from `useVersion()` through the container

---

## Attempt 1 — 2026-07-19T07:27:27Z

### Implementation Plan
- Build `@project/types`, install worktree deps (fresh worktree had no node_modules)
- Append two failing presentation tests (version provided / version undefined)
- Add `version?: string` prop; render sidebar-footer line + mobile strip; grow mobile content padding to `4.25rem`
- Wire `useVersion` through `app-shell.tsx` container
- Run full layout suite, format, lint

### Files Changed
- modified `frontend/src/components/layout/app-shell-presentation.spec.tsx` — 2 new version tests
- modified `frontend/src/components/layout/app-shell-presentation.tsx` — version prop, sidebar footer render, mobile strip, padding bump
- modified `frontend/src/components/layout/app-shell.tsx` — call useVersion, thread version prop

### New Tests
- `renders the version string when version is provided`
- `renders no version text when version is undefined`

### Key Decisions
- Fresh git worktree had no `node_modules`; ran `pnpm install` + `packages/types` build before the TDD loop so `@project/types` resolved.

### Lint Output
PASS

### Test Output
PASS (24 passed, 2 new)

### Commit
`db7194d`

### Outcome: success

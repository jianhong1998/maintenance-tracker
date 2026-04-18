# UI Redesign — Test Cases Evaluation Report

**Branch:** `chore/000/implement-new-ui-design`
**Evaluated by:** QA Senior Engineer (AI)
**Scope:** All spec files added or modified in this branch.

---

## Overview

This branch introduces a full Dark Terminal UI redesign: a new `AppShell` navigation component, a custom `Dialog` primitive, a new `VehicleStatusChip`, a `VehiclesLayout` split-pane, updated card rows with progress bars, and a set of display-helper utilities. New and updated spec files were reviewed against their implementation counterparts.

**Overall verdict:** Coverage is good for happy-path behavior. There are meaningful gaps in edge-case coverage, one untested exported function, and several fragile assertions that will break on minor styling refactors.

---

## File-by-File Findings

---

### 1. `vehicle-display.spec.ts` — MISSING coverage for `getVehicleMetaLine`

**Severity: High**

The module exports three functions:
- `getVehicleDisplayLabels` — tested ✅
- `getVehicleCardMetaLine` — tested ✅
- `getVehicleMetaLine` — **zero tests** ❌

`getVehicleMetaLine` is a new function used by `VehicleDashboardPage` to render the vehicle detail header meta line. It has a different format from `getVehicleCardMetaLine` (includes optional `Plate: XXX` segment), yet no test describes this.

**Missing tests to add:**

```typescript
describe('getVehicleMetaLine', () => {
  it('returns "colour · mileage unit" when registrationNumber is null', () => {
    expect(getVehicleMetaLine(baseVehicle)).toBe('Black · 100 km');
  });

  it('includes "Plate: XXX" when registrationNumber is set', () => {
    const v = { ...baseVehicle, registrationNumber: 'FBA1234Z' };
    expect(getVehicleMetaLine(v)).toBe('Black · 100 km · Plate: FBA1234Z');
  });

  it('formats mileage with locale separators', () => {
    const v = { ...baseVehicle, mileage: 50000 };
    expect(getVehicleMetaLine(v)).toBe('Black · 50,000 km');
  });

  it('uses the mileageUnit in the meta line', () => {
    const v = { ...baseVehicle, mileageUnit: 'mile' as const };
    expect(getVehicleMetaLine(v)).toBe('Black · 100 mile');
  });
});
```

---

### 2. `vehicles-layout.spec.tsx` — Multiple gaps

**Severity: Medium**

Only three scenarios are tested: children rendered, header text, and status chip for a single vehicle with zero warning cards. The component has more behavioral surface that is untested.

**Missing tests:**

#### a) Loading state
```typescript
it('shows a loading indicator when vehicles are loading', () => {
  vi.mocked(useVehicles).mockReturnValue({ data: [], isLoading: true });
  render(<VehiclesLayout><div>child</div></VehiclesLayout>);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});
```

#### b) Empty vehicle list
```typescript
it('renders no vehicle items when vehicles array is empty', () => {
  vi.mocked(useVehicles).mockReturnValue({ data: [], isLoading: false });
  render(<VehiclesLayout><div>child</div></VehiclesLayout>);
  // Confirm no vehicle links are rendered
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
```

#### c) Active vehicle highlighting
The `isActive` prop sets different border/bg classes on the active list item. No test confirms the active route is distinguished.
```typescript
it('marks the vehicle item as active when pathname matches', () => {
  // usePathname mock already returns '/vehicles/v1' — v1 should be active
  render(<VehiclesLayout><div>child</div></VehiclesLayout>);
  const link = screen.getByRole('link', { name: /civic/i });
  // Active item has different aria or class
  expect(link.closest('a')).toHaveAttribute('href', '/vehicles/v1');
  // Verify active styling class is applied (or use aria-current if added)
});
```
**Suggestion:** Add `aria-current="page"` to the active `<Link>` in `VehicleListItem` (mirroring what `AppShellPresentation` already does) so tests can assert it semantically rather than by CSS class string.

#### d) Overdue vehicle chip
```typescript
it('shows overdue chip when vehicle has warning cards', () => {
  vi.mocked(useMaintenanceCards).mockReturnValue({ data: [/* cards */] });
  vi.mocked(countWarningCards).mockReturnValue(2); // or mock via useMaintenanceCards data
  render(<VehiclesLayout><div>child</div></VehiclesLayout>);
  expect(screen.getByText('2 OVERDUE')).toBeInTheDocument();
});
```

---

### 3. `app-shell-presentation.spec.tsx` — Missing sub-route and mobile indicator tests

**Severity: Medium**

#### a) Sub-route active matching not tested
The `isActive` function matches `/history/123` to the `/history` nav item. Only exact match and boundary mismatch (`/history-foo`) are tested. The `pathname.startsWith(href + '/')` branch has no coverage.

**Missing test:**
```typescript
it('marks History as active on /history/123 (deep sub-route)', () => {
  render(
    <AppShellPresentation showNav={true} pathname="/history/123" userDisplayName={null}>
      <div />
    </AppShellPresentation>,
  );
  const historyLinks = screen.getAllByRole('link')
    .filter((l) => l.getAttribute('href') === '/history');
  expect(historyLinks[0]).toHaveAttribute('aria-current', 'page');
});
```

#### b) Mobile active indicator dot not tested
The mobile nav renders a `<span className="w-1 h-1 rounded-full bg-primary" />` for the active item, but nothing in the spec verifies the active item renders this dot versus inactive items not having it. This is a UI regression risk.

#### c) Non-active links missing explicit assertion
The test for `aria-current="page"` on the active link is correct, but no test asserts that the *other* links do **not** have `aria-current="page"` in the same render. This makes it possible for a regression where all links incorrectly get the attribute to go undetected.

**Missing test:**
```typescript
it('does not mark Fleet or Profile as active on /history', () => {
  render(
    <AppShellPresentation showNav={true} pathname="/history" userDisplayName={null}>
      <div />
    </AppShellPresentation>,
  );
  const fleetLinks = screen.getAllByRole('link')
    .filter((l) => l.getAttribute('href') === '/');
  expect(fleetLinks[0]).not.toHaveAttribute('aria-current', 'page');
});
```

---

### 4. `dialog.spec.tsx` — Missing backdrop click test

**Severity: Medium**

The spec tests Escape key dismissal and `aria-labelledby`, but does not test that clicking the backdrop/overlay calls `onOpenChange(false)`. This is core dismiss behavior for a modal dialog.

Radix Dialog closes on overlay click by default; the absence of this test means a future `closeOnOverlayClick={false}` or a custom overlay change could silently break UX.

**Missing test:**
```typescript
it('calls onOpenChange(false) when the overlay is clicked', () => {
  const onOpenChange = vi.fn();
  render(
    <Dialog open={true} onOpenChange={onOpenChange} title="Test">
      <p>content</p>
    </Dialog>,
  );
  // Radix renders the overlay as data-radix-dialog-overlay
  const overlay = document.querySelector('[data-radix-dialog-overlay]');
  expect(overlay).not.toBeNull();
  fireEvent.click(overlay!);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
```

---

### 5. `login-page.spec.tsx` — Missing in-progress text test

**Severity: Low**

The button text changes from `"SIGN IN WITH GOOGLE"` to `"SIGNING IN..."` while `isSigningIn` is true. No test asserts this text change, which is a visible UX feedback mechanism.

**Missing test:**
```typescript
it('shows "SIGNING IN..." text on the button while sign-in is in progress', async () => {
  const signInWithGoogle = vi.fn(() => new Promise(() => {})); // never resolves
  renderLoginPage({ signInWithGoogle });

  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

  expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument();
});
```

Also missing: test that the local error state is **cleared** when a new sign-in attempt starts (i.e., clicking the button a second time after a failure resets `signInError` to null before the new attempt).

---

### 6. `vehicle-dashboard-page.spec.tsx` — Missing cards loading state and sort active state

**Severity: Low–Medium**

#### a) Cards loading state not tested
The component renders `"Loading cards…"` when `cardsLoading` is true, but no test covers this state. Only `vehicleLoading` loading is tested.

**Missing test:**
```typescript
it('shows "Loading cards…" when maintenance cards are loading', () => {
  vi.mocked(useVehicle).mockReturnValue({
    data: mockVehicle, isLoading: false, isError: false,
  } as ReturnType<typeof useVehicle>);
  vi.mocked(useMaintenanceCards).mockReturnValue({
    data: [], isLoading: true,
  } as unknown as ReturnType<typeof useMaintenanceCards>);

  render(<VehicleDashboardPage vehicleId="vehicle-1" />);
  expect(screen.getByText(/loading cards/i)).toBeInTheDocument();
});
```

#### b) Sort button active variant not tested
Clicking "NAME" should make `useMaintenanceCards` receive `'name'`, and the "NAME" button should visually become the active variant while "URGENCY" becomes secondary. Only the query call argument is verified — the active state of the buttons is not.

#### c) Meta line without registration number
The `getVehicleMetaLine` output without a registration number should be `"Silver · 50,000 km"`. The existing test `'shows vehicle header when vehicle loads'` only asserts `/silver/i` substring. A more explicit assertion on the full meta line format would catch a regression in `getVehicleMetaLine`.

---

### 7. `maintenance-card-row.spec.tsx` — Progress fill intermediate states and color logic untested

**Severity: Low**

#### a) Warning zone progress fill (60–99%) not covered
The `getProgressFill` helper returns a value in the 60–99 range for `status === 'warning'`. Only the overdue (100%) and a basic "has track" case are tested. No test verifies the fill is within the warning range.

**Suggested test:**
```typescript
it('renders progress bar fill between 60–99% when status is warning', () => {
  vi.mocked(getCardWarningStatus).mockReturnValue('warning');
  render(
    <MaintenanceCardRow
      {...defaultProps}
      card={{ ...mockCard, nextDueMileage: 50400 }}  // 400 remaining, threshold 500
    />,
  );
  const fill = document.querySelector('[style*="width:"]') as HTMLElement;
  const widthStr = fill?.style.width ?? '0%';
  const pct = parseFloat(widthStr);
  expect(pct).toBeGreaterThanOrEqual(60);
  expect(pct).toBeLessThan(100);
});
```

#### b) Healthy label color (3× rule) not tested

> **Obsolete (2026-04-18).** The 3× muted-grey rule was dropped; healthy labels are cyan unconditionally. The gap described below no longer applies — no test is needed for a non-existent transition. Kept for historical context.

`getHealthyLabelColor` switches between `'primary'` (cyan) and `'muted'` based on whether `remaining > 3 × thresholdNative`. No test verifies this threshold transition is respected.

**Suggested test:**
```typescript
it('applies primary color to sub-label when remaining is below 3x threshold', () => {
  vi.mocked(getCardWarningStatus).mockReturnValue('ok');
  // threshold 500, remaining 1499 (below 3×500 = 1500) → primary
  render(
    <MaintenanceCardRow
      {...defaultProps}
      card={{ ...mockCard, nextDueMileage: 51499 }}
    />,
  );
  const label = screen.getByText(/left/i);
  expect(label.className).toContain('text-[#00e5ff]');
});
```

#### c) `mile` unit card not tested
The `thresholdNative` calculation divides `thresholdKm` by `MILES_TO_KM` for mile-unit vehicles. No test uses `mileageUnit: 'mile'`, leaving the conversion branch uncovered.

---

## Fragile Assertions (Technical Debt)

These tests currently pass but will break on purely cosmetic token changes:

### `vehicle-status-chip.spec.tsx` — Hex literals in class assertions

```typescript
// Fragile: breaks if hex color is moved to CSS variable
expect(chip.className).toContain('text-[#ff4444]');
expect(chip.className).toContain('text-[#00e5ff]');
```

**Fix:** The text content tests (`'ALL GOOD'` / `'3 OVERDUE'`) already cover the semantic state. The style assertions add minimal value while being brittle. Either remove them, or replace with a `data-testid` pattern:
- Add `data-testid="status-chip-overdue"` / `data-testid="status-chip-ok"` to the component and query by that.

### `maintenance-card-row.spec.tsx` — CSS class selector for progress bar track

```typescript
const track = document.querySelector('.bg-\\[\\#1a1a2e\\]');
```

**Fix:** Add `data-testid="progress-bar-track"` to the track `<div>` in the component and use:
```typescript
expect(screen.getByTestId('progress-bar-track')).toBeInTheDocument();
```

---

## Correct Patterns Worth Preserving

The following patterns are well-done and should be replicated in new tests:

1. **Fake timer usage in `mileage-prompt.spec.tsx`** — Pinning system time with `vi.useFakeTimers()` + `vi.setSystemTime()` for timezone-safe date assertions. All datetime tests should follow this pattern.

2. **Dialog mock pattern in `delete-confirm-dialog.spec.tsx` and `mark-done-dialog.spec.tsx`** — These mock `@/components/ui/dialog` at the module level with a simple open/closed conditional render. This isolates the dialog container from tests that focus on form behavior. This pattern is correct and consistent.

3. **Route delegation test in `app/login/page.spec.tsx`** — A thin test that only verifies the page route delegates to `LoginPage`. This correctly follows the `page.tsx` convention (routing only) and avoids duplicating `LoginPage` behavioral tests.

4. **`aria-current="page"` for nav active state** — Using semantic HTML attributes instead of CSS classes for active-state assertions (in `AppShellPresentation` spec). This is the right approach and should be extended to `VehiclesLayout`'s vehicle list items.

---

## Summary Table

| File | Severity | Issue |
|---|---|---|
| `vehicle-display.spec.ts` | **High** | `getVehicleMetaLine` entirely untested |
| `vehicles-layout.spec.tsx` | **Medium** | Missing: loading, empty list, active vehicle, overdue chip |
| `app-shell-presentation.spec.tsx` | **Medium** | Missing: sub-route match, mobile dot, non-active assertion |
| `dialog.spec.tsx` | **Medium** | Missing: backdrop click closes dialog |
| `login-page.spec.tsx` | **Low** | Missing: "SIGNING IN…" button text, error reset |
| `vehicle-dashboard-page.spec.tsx` | **Low** | Missing: cards loading state, sort active state |
| `maintenance-card-row.spec.tsx` | **Low** | Missing: warning fill range, 3× label color, mile unit |
| `vehicle-status-chip.spec.tsx` | Fragile | Hex literal class assertions — swap to `data-testid` |
| `maintenance-card-row.spec.tsx` | Fragile | CSS class selector for track — swap to `data-testid` |

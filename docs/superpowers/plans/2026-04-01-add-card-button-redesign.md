# Add Card Button Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the floating action button (FAB) with an inline dotted-border add-card box at the top of the maintenance cards section.

**Architecture:** Single component change in `vehicle-dashboard-page.tsx` — remove the fixed FAB, restructure the cards render block so the add-card box appears first (always visible), followed by the loading/empty/cards content.

**Tech Stack:** Next.js 15, React, Tailwind CSS, Vitest + React Testing Library

---

### Task 1: Update tests to reflect new UI structure

**Files:**
- Modify: `frontend/src/components/pages/vehicle-dashboard-page.spec.tsx`

- [ ] **Step 1: Update the FAB-label test to assert add-card box is always rendered**

Replace the two existing FAB tests (lines 208–223) with the following block:

```tsx
  // ── add-card box tests ──────────────────────────────────────────────
  it('renders the add-card box with aria-label "Add maintenance card"', () => {
    setupVehicleLoaded();
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    expect(
      screen.getByRole('button', { name: /add maintenance card/i }),
    ).toBeInTheDocument();
  });

  it('renders the add-card box even when there are no cards', () => {
    setupVehicleLoaded([]);
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    expect(
      screen.getByRole('button', { name: /add maintenance card/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no maintenance cards yet/i)).toBeInTheDocument();
  });

  it('renders the add-card box before the empty-state message', () => {
    setupVehicleLoaded([]);
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    const addBox = screen.getByRole('button', { name: /add maintenance card/i });
    const emptyMsg = screen.getByText(/no maintenance cards yet/i);
    expect(
      addBox.compareDocumentPosition(emptyMsg) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders the add-card box before card rows', () => {
    setupVehicleLoaded([mockCard1]);
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    const addBox = screen.getByRole('button', { name: /add maintenance card/i });
    const firstRow = screen.getByTestId('maintenance-card-row');
    expect(
      addBox.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('opens create form dialog when add-card box is clicked', () => {
    setupVehicleLoaded();
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    fireEvent.click(
      screen.getByRole('button', { name: /add maintenance card/i }),
    );
    expect(screen.getByTestId('form-dialog')).toHaveTextContent('create');
  });
```

- [ ] **Step 2: Run the tests to verify the new tests fail and existing tests still pass**

```bash
cd frontend && pnpm exec vitest run src/components/pages/vehicle-dashboard-page.spec.tsx
```

Expected: new tests FAIL (add-card box is not inline yet; FAB is fixed/outside the cards block). Existing tests (vehicle header, sort, card rows, dialogs) should still PASS.

---

### Task 2: Implement the inline add-card box

**Files:**
- Modify: `frontend/src/components/pages/vehicle-dashboard-page.tsx`

- [ ] **Step 1: Replace the cards render block and remove the FAB**

Replace lines 111–142 (the entire cards conditional block + FAB) with:

```tsx
      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-label="Add maintenance card"
          onClick={() => setCreateOpen(true)}
          className="flex w-full items-center justify-center rounded-md border-2 border-dashed border-gray-300 py-4 text-gray-400 hover:bg-gray-50"
        >
          <span className="text-2xl font-light leading-none">+</span>
        </button>

        {cardsLoading ? (
          <p className="text-muted-foreground text-sm">Loading cards…</p>
        ) : cards.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No maintenance cards yet.
          </p>
        ) : (
          cards.map((card) => (
            <MaintenanceCardRow
              key={card.id}
              card={card}
              vehicle={vehicle}
              isDropdownOpen={activeDropdownId === card.id}
              onDropdownToggle={setActiveDropdownId}
              onEdit={handleEdit}
              onMarkDone={handleMarkDone}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
```

Also remove `relative` from the `<main>` className since the FAB (`fixed` positioning) no longer needs it as a reference. Change:

```tsx
    <main className="relative flex flex-col gap-6 p-6">
```

to:

```tsx
    <main className="flex flex-col gap-6 p-6">
```

- [ ] **Step 2: Run all tests**

```bash
cd frontend && pnpm exec vitest run src/components/pages/vehicle-dashboard-page.spec.tsx
```

Expected: all tests PASS.

- [ ] **Step 3: Format and lint**

```bash
just format && just lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/pages/vehicle-dashboard-page.tsx \
        frontend/src/components/pages/vehicle-dashboard-page.spec.tsx
git commit -m "replace FAB with inline dotted add-card box"
```

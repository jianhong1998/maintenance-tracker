# Add Maintenance Card Button Redesign

**Date:** 2026-04-01

## Summary

Replace the floating action button (FAB) in the bottom-right corner with an inline dotted-border box at the top of the maintenance cards section.

## Current Behaviour

A fixed, circular FAB (`bottom-6 right-6`) with a `+` icon opens the `MaintenanceCardFormDialog`. It overlays page content.

## Desired Behaviour

- FAB is removed entirely.
- A full-width dotted-border box appears above the cards list (or above the empty-state message when no cards exist).
- Clicking the box opens the same `MaintenanceCardFormDialog`.

## Visual Spec

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  ← dotted grey border
│                  +                   │  ← grey "+" icon, centered
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
[Card row 1]
[Card row 2]
```

When no cards exist:
```
[Add card box]
No maintenance cards yet.
```

## Component: `vehicle-dashboard-page.tsx`

### Changes

1. **Remove** the FAB `<button>` (lines 134–142).
2. **Restructure** the cards render block (lines 111–132) so the add-card box is always rendered at the top, regardless of loading/empty state.

### Add-card box markup

```tsx
<button
  type="button"
  aria-label="Add maintenance card"
  onClick={() => setCreateOpen(true)}
  className="flex w-full items-center justify-center rounded-md border-2 border-dashed border-gray-300 py-4 text-gray-400 hover:bg-gray-50"
>
  <span className="text-2xl font-light leading-none">+</span>
</button>
```

### Render structure

```tsx
<div className="flex flex-col gap-2">
  {/* Add card box — always visible */}
  <AddCardBox onClick={() => setCreateOpen(true)} />

  {cardsLoading ? (
    <p className="text-muted-foreground text-sm">Loading cards…</p>
  ) : cards.length === 0 ? (
    <p className="text-muted-foreground text-sm">No maintenance cards yet.</p>
  ) : (
    cards.map((card) => <MaintenanceCardRow key={card.id} ... />)
  )}
</div>
```

## Testing

- Existing snapshot / unit tests for `VehicleDashboardPage` should be updated to reflect the new structure (no FAB, add-card box present).
- No new query hooks or API changes required.

# Maintenance Card CRUD — Frontend Design

**Date:** 2026-03-26
**Status:** Approved

---

## 1. Problem Statement

The vehicle dashboard displays maintenance cards as read-only rows. There is no entry point for users to create, edit, delete, or mark maintenance cards as done. All four backend endpoints exist; the frontend mutations and UI are missing entirely.

---

## 2. Scope

Full CRUD on maintenance cards from the vehicle dashboard:

| Action | Trigger |
|---|---|
| Create | FAB "+" button (bottom-right of dashboard) |
| Edit | ⋮ dropdown on card row → Edit |
| Mark Done | ⋮ dropdown on card row → Mark Done |
| Delete | ⋮ dropdown on card row → Delete → confirmation dialog |

---

## 3. Architecture

### 3.1 Component Tree

```
VehicleDashboardPage
├── state: editingCard, markingDoneCard, deletingCard, activeDropdownId
├── FAB "+" button → opens MaintenanceCardFormDialog (create mode)
├── MaintenanceCardRow (per card)           ← updated
│   ├── ⋮ button → inline dropdown (Mark Done / Edit / Delete)
│   └── callbacks: onEdit, onMarkDone, onDelete → bubble up to page
├── MaintenanceCardFormDialog (create + edit, same component)   ← new
├── MarkDoneDialog                                              ← new
└── DeleteConfirmDialog                                         ← new
```

### 3.2 State in VehicleDashboardPage

All dialog/dropdown state is lifted to `VehicleDashboardPage`. This guarantees mutual exclusion — only one dialog can be open at a time — with no coordination logic needed.

```typescript
const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
const [editingCard, setEditingCard] = useState<IMaintenanceCardResDTO | null>(null);
const [markingDoneCard, setMarkingDoneCard] = useState<IMaintenanceCardResDTO | null>(null);
const [deletingCard, setDeletingCard] = useState<IMaintenanceCardResDTO | null>(null);
const [createOpen, setCreateOpen] = useState(false);
```

---

## 4. New Mutation Hooks

All hooks live in `frontend/src/hooks/mutations/maintenance-cards/`.

| Hook | Method | Endpoint | On Success |
|---|---|---|---|
| `useCreateMaintenanceCard(vehicleId)` | POST | `/vehicles/:id/maintenance-cards` | Invalidate cards list |
| `usePatchMaintenanceCard(vehicleId, cardId)` | PATCH | `/vehicles/:id/maintenance-cards/:cardId` | Invalidate cards list |
| `useDeleteMaintenanceCard(vehicleId)` | DELETE | `/vehicles/:id/maintenance-cards/:cardId` | Invalidate cards list — `cardId` passed as the mutation variable, not a hook param, so a single hook instance handles any card |
| `useMarkDone(vehicleId, cardId)` | POST | `/vehicles/:id/maintenance-cards/:cardId/mark-done` | Invalidate cards list + vehicle |

**Cache invalidation detail:**
- Cards list: `invalidateQueries({ queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId] })` — prefix match (no `exact: true`) to cover both sorted and unsorted cache entries.
- Vehicle (mark-done only): `invalidateQueries({ queryKey: [QueryGroup.VEHICLES, vehicleId], exact: true })` — mark-done may update `vehicle.mileage` if `doneAtMileage > vehicle.mileage`.

**Success toasts** (via `sonner`): "Card created", "Card updated", "Card deleted", "Marked as done".

---

## 5. Updated Component: `MaintenanceCardRow`

**File:** `frontend/src/components/maintenance-cards/maintenance-card-row.tsx`

Add a ⋮ button to the right side of each row. Clicking it sets `activeDropdownId` to this card's id (passed via `onDropdownToggle` callback). The dropdown renders inline, anchored to the ⋮ button, with three items:

- **Mark Done** — calls `onMarkDone(card)`
- **Edit** — calls `onEdit(card)`
- **Delete** — calls `onDelete(card)` (destructive red text)

Dropdown closes on outside click (via `useEffect` + document `mousedown` listener, or a shadcn `DropdownMenu` if available).

New props:

```typescript
interface MaintenanceCardRowProps {
  card: IMaintenanceCardResDTO;
  vehicle: IVehicleResDTO;
  isDropdownOpen: boolean;
  onDropdownToggle: (cardId: string | null) => void;
  onEdit: (card: IMaintenanceCardResDTO) => void;
  onMarkDone: (card: IMaintenanceCardResDTO) => void;
  onDelete: (card: IMaintenanceCardResDTO) => void;
}
```

---

## 6. New Component: `MaintenanceCardFormDialog`

**File:** `frontend/src/components/maintenance-cards/maintenance-card-form-dialog.tsx`

Centered dialog. Used for both create and edit — mode determined by whether `card` prop is present.

**Props:**
```typescript
interface MaintenanceCardFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  card?: IMaintenanceCardResDTO; // present = edit mode, absent = create mode
}
```

**Fields:**

| Field | Input | Required | Notes |
|---|---|---|---|
| Type | 3-button toggle: Task / Part / Item | Yes | Defaults to `task` |
| Name | Text input | Yes | |
| Description | Textarea | No | |
| Every (km) | Number input | Conditional | At least one interval required |
| Every (months) | Number input | Conditional | At least one interval required |

**Validation:** Save button disabled until `name` is non-empty AND at least one of `intervalMileage` / `intervalTimeMonths` is filled with a positive number.

**Edit mode:** Pre-fills all fields from `card` prop on open. Title changes to "Edit Maintenance Card".

**On save:** Calls `useCreateMaintenanceCard` or `usePatchMaintenanceCard` depending on mode. Closes dialog on success.

---

## 7. New Component: `MarkDoneDialog`

**File:** `frontend/src/components/maintenance-cards/mark-done-dialog.tsx`

**Props:**
```typescript
interface MarkDoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: IMaintenanceCardResDTO;
  vehicleId: string;
}
```

**Fields:**

| Field | Input | Shown when | Required when shown |
|---|---|---|---|
| Done at mileage | Number input | `card.intervalMileage !== null` | Yes |
| Notes | Textarea | Always | No |

**On save:** Calls `useMarkDone`. Closes dialog on success.

---

## 8. New Component: `DeleteConfirmDialog`

**File:** `frontend/src/components/maintenance-cards/delete-confirm-dialog.tsx`

**Props:**
```typescript
interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: IMaintenanceCardResDTO;
  vehicleId: string;
}
```

Body text: `Delete "[card.name]"? This cannot be undone.`

Two buttons: Cancel (ghost) and Delete (destructive). Delete calls `useDeleteMaintenanceCard`. Closes dialog on success.

---

## 9. Updated Component: `VehicleDashboardPage`

**File:** `frontend/src/components/pages/vehicle-dashboard-page.tsx`

Changes:
1. Add the five state variables (see §3.2).
2. Pass dropdown/action callbacks to each `MaintenanceCardRow`.
3. Render FAB "+" button (fixed position, bottom-right).
4. Render `MaintenanceCardFormDialog` (create mode when `createOpen`, edit mode when `editingCard` is set).
5. Render `MarkDoneDialog` when `markingDoneCard` is set.
6. Render `DeleteConfirmDialog` when `deletingCard` is set.

---

## 10. Testing

Pattern: `*.spec.tsx` alongside each component, Vitest + React Testing Library.

| File | Key test cases |
|---|---|
| `useCreateMaintenanceCard.spec.ts` | POSTs correct body; invalidates cards query on success |
| `usePatchMaintenanceCard.spec.ts` | PATCHes correct body; invalidates cards query on success |
| `useDeleteMaintenanceCard.spec.ts` | DELETEs correct endpoint; invalidates cards query on success |
| `useMarkDone.spec.ts` | POSTs correct body; invalidates cards + vehicle query on success |
| `maintenance-card-row.spec.tsx` | ⋮ renders dropdown; each action calls correct callback |
| `maintenance-card-form-dialog.spec.tsx` | Save disabled until name + interval filled; edit mode pre-fills; create/patch called on submit |
| `mark-done-dialog.spec.tsx` | Mileage field shown only when `intervalMileage !== null`; required when shown |
| `delete-confirm-dialog.spec.tsx` | Confirm calls delete; cancel closes without calling |
| `vehicle-dashboard-page.spec.tsx` | FAB opens create dialog; row callbacks open correct dialog with correct card |

---

## 11. File Summary

**New files:**
- `frontend/src/hooks/mutations/maintenance-cards/useCreateMaintenanceCard.ts`
- `frontend/src/hooks/mutations/maintenance-cards/useCreateMaintenanceCard.spec.ts`
- `frontend/src/hooks/mutations/maintenance-cards/usePatchMaintenanceCard.ts`
- `frontend/src/hooks/mutations/maintenance-cards/usePatchMaintenanceCard.spec.ts`
- `frontend/src/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard.ts`
- `frontend/src/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard.spec.ts`
- `frontend/src/hooks/mutations/maintenance-cards/useMarkDone.ts`
- `frontend/src/hooks/mutations/maintenance-cards/useMarkDone.spec.ts`
- `frontend/src/components/maintenance-cards/maintenance-card-form-dialog.tsx`
- `frontend/src/components/maintenance-cards/maintenance-card-form-dialog.spec.tsx`
- `frontend/src/components/maintenance-cards/mark-done-dialog.tsx`
- `frontend/src/components/maintenance-cards/mark-done-dialog.spec.tsx`
- `frontend/src/components/maintenance-cards/delete-confirm-dialog.tsx`
- `frontend/src/components/maintenance-cards/delete-confirm-dialog.spec.tsx`

**Modified files:**
- `frontend/src/components/maintenance-cards/maintenance-card-row.tsx`
- `frontend/src/components/maintenance-cards/maintenance-card-row.spec.tsx`
- `frontend/src/components/pages/vehicle-dashboard-page.tsx`
- `frontend/src/components/pages/vehicle-dashboard-page.spec.tsx`

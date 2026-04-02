# Vehicle CRUD Frontend — Design Spec

**Date:** 2026-04-02
**Branch:** plan/000/plan-for-vehicle-crud
**Status:** Approved

---

## Background

The backend already exposes full Vehicle CRUD (`GET /vehicles`, `POST /vehicles`, `GET /vehicles/:id`, `PATCH /vehicles/:id`, `DELETE /vehicles/:id`). The frontend currently has read-only vehicle views — a home page grid and a vehicle dashboard. Create, edit, and delete actions are missing entirely.

---

## Scope

Implement vehicle Create, Edit, and Delete on the frontend. No backend changes required.

---

## UX Decisions

### Create
- Triggered from a **`+ Add Vehicle` button** in the header of the home page (`/`), next to the "Your Vehicles" heading.
- Opens a **modal dialog** (`VehicleFormDialog` in create mode).

### Edit & Delete
- Triggered from a **`⋮` dropdown menu** in the vehicle header on the dashboard page (`/vehicles/:id`).
- Matches the existing `⋮` dropdown pattern on maintenance card rows.
- Edit opens `VehicleFormDialog` in edit mode.
- Delete opens `VehicleDeleteConfirmDialog`.

### Delete confirmation copy
- Body: *"Delete [brand model]? This cannot be undone."*
- No cascade warning shown.

---

## Form Dialog (`VehicleFormDialog`)

Single component for both create and edit. Edit mode is determined by whether a `vehicle` prop is passed.

### Fields

| Row | Fields |
|---|---|
| 1 | Brand (half width) · Model (half width) |
| 2 | Colour (full width) |
| 3 | Mileage (half width) · Unit toggle (half width) |

### Mileage Unit toggle
- **Create mode:** always enabled; defaults to `km`.
- **Edit mode, no cards:** enabled.
- **Edit mode, has cards:** disabled. Hint text inline to the right of the km/mile buttons: *"Delete all maintenance cards to edit this"*. `hasCards` prop passed from parent (reuses `cards` already in TanStack Query cache — no extra API call).

### Validation
- Brand, Model, Colour: required non-empty string.
- Mileage: required, numeric, ≥ 0.
- Mileage Unit: required, defaults to `km`.
- Save button disabled until all required fields are filled.

### On success
- Create: `toast.success('Vehicle created')`, close dialog.
- Edit: `toast.success('Vehicle updated')`, close dialog.
- Error: `toast.error(err.message ?? 'Something went wrong')`.

---

## New Components

All under `frontend/src/components/vehicles/`:

| Component | File | Purpose |
|---|---|---|
| `VehicleFormDialog` | `vehicle-form-dialog.tsx` | Create + edit modal |
| `VehicleDeleteConfirmDialog` | `vehicle-delete-confirm-dialog.tsx` | Delete confirmation modal |

---

## New Mutation Hooks

Under `frontend/src/hooks/mutations/vehicles/`:

| Hook | File | API Call |
|---|---|---|
| `useCreateVehicle` | `useCreateVehicle.ts` | `POST /vehicles` |
| `useDeleteVehicle` | `useDeleteVehicle.ts` | `DELETE /vehicles/:id` |

`usePatchVehicle` already exists — reused for edit.

---

## State Management

### `HomeContent` (`home-page.tsx`)
- Add `createOpen: boolean` state.
- `+ Add Vehicle` button sets `createOpen = true`.
- Renders `<VehicleFormDialog open={createOpen} onOpenChange={setCreateOpen} />`.

### `VehicleDashboardPage` (`vehicle-dashboard-page.tsx`)
- Add `editOpen: boolean` and `deleteOpen: boolean` state.
- `⋮` dropdown in vehicle header: Edit sets `editOpen = true`, Delete sets `deleteOpen = true`.
- Renders `<VehicleFormDialog open={editOpen} onOpenChange={setEditOpen} vehicle={vehicle} hasCards={cards.length > 0} />`.
- Renders `<VehicleDeleteConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} vehicle={vehicle} />`.
- On delete success: invalidate `[VEHICLES]` list, redirect to `/`.

---

## Cache Invalidation

| Action | Strategy |
|---|---|
| Create | Invalidate `[VEHICLES]` (prefix match — covers list) |
| Edit | `setQueryData` for `[VEHICLES, id]` + invalidate `[VEHICLES]` exact (existing `usePatchVehicle` behaviour) |
| Delete | Invalidate `[VEHICLES]` (prefix match) — individual entry becomes irrelevant after redirect |

---

## Testing

TDD. Spec files co-located alongside each source file.

### Mutation hook specs
- `useCreateVehicle.spec.ts` — success invalidates `[VEHICLES]` list.
- `useDeleteVehicle.spec.ts` — success invalidates `[VEHICLES]` list.

### Component specs
| Spec file | Key cases |
|---|---|
| `vehicle-form-dialog.spec.tsx` | Correct title for create vs edit; Save disabled when required fields empty; unit toggle disabled when `hasCards=true`; hint text shown when locked; calls create mutation on save (create); calls patch mutation on save (edit) |
| `vehicle-delete-confirm-dialog.spec.tsx` | Renders vehicle name in body; calls delete mutation on confirm; redirects to `/` on success |
| `home-page.spec.tsx` | Renders `+ Add Vehicle` button; opens form dialog on click |
| `vehicle-dashboard-page.spec.tsx` | Renders `⋮` dropdown in vehicle header; opens edit dialog; opens delete dialog |

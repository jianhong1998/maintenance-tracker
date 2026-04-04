# Vehicle CRUD follow-up refactors

Tracked from PR #28 code review (feat/014/vehicle-crud).

---

## 1. `usePatchVehicle('')` called in create mode

### Problem

`vehicle-form-dialog.tsx` always calls both mutation hooks unconditionally (required by Rules of Hooks):

```ts
const patchMutation = usePatchVehicle(vehicle?.id ?? '');
```

In create mode, `vehicle` is `undefined`, so `usePatchVehicle('')` is called with an empty string ID on every render. The mutation never fires today because it is lazy. But it constructs a `PATCH /vehicles/` URL with a blank segment — if the hook ever adds prefetching or eager validation, this becomes a silent bug.

### Potential solution

Add a guard inside `usePatchVehicle` that throws early if the mutation is invoked with an empty ID:

```ts
export const usePatchVehicle = (vehicleId: string) => {
  return useMutation({
    mutationFn: (data: IPatchVehicleReqDTO) => {
      if (!vehicleId) throw new Error('vehicleId is required');
      return patchVehicle(vehicleId, data);
    },
    // ...
  });
};
```

This keeps the hook call unconditional (Rules of Hooks satisfied) while making incorrect usage fail loudly at invocation time rather than silently constructing a bad URL.

---

## 2. Dialog render pattern inconsistency

### Problem

`vehicle-dashboard-page.tsx` renders `VehicleFormDialog` and `VehicleDeleteConfirmDialog` unconditionally with `open={false}`:

```tsx
<VehicleFormDialog open={editVehicleOpen} ... />
<VehicleDeleteConfirmDialog open={deleteVehicleOpen} ... />
```

The existing `DeleteConfirmDialog` for maintenance cards uses conditional rendering:

```tsx
{deletingCard && <DeleteConfirmDialog ... />}
```

Two patterns for the same concept forces future readers to context-switch unnecessarily.

### Potential solution

Standardise on one pattern across the page. The always-render pattern is simpler and avoids mount/unmount animation artifacts — prefer it and migrate the maintenance card `DeleteConfirmDialog` to the same approach.

---

## 3. Global `document.addEventListener('click', ...)` dropdown close pattern

### Problem

`vehicle-dashboard-page.tsx` uses a document-level click listener to close the active dropdown:

```ts
useEffect(() => {
  const close = () => setActiveDropdownId(null);
  document.addEventListener('click', close);
  return () => document.removeEventListener('click', close);
}, []);
```

This is the classic event-propagation trap: clicking a dropdown toggle fires the toggle handler AND then the event bubbles to `document`, immediately closing the dropdown. The current implementation works only because `maintenance-card-row.tsx` calls `stopPropagation()` and `stopImmediatePropagation()` on the toggle click (commit `1dc7893`) — a fragile workaround coupling two unrelated components.

### Potential solution

Replace the global listener with a `pointerdown` outside-click pattern scoped to each dropdown container using a `useOnClickOutside` hook:

```ts
const ref = useRef<HTMLDivElement>(null);
useOnClickOutside(ref, () => setActiveDropdownId(null));
```

This eliminates the propagation dependency and removes the need for `stopPropagation` in `maintenance-card-row.tsx`.

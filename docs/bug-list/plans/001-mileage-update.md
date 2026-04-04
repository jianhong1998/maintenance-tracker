# Plan: Bug Fix — Mileage Update Issues

---

## Bug 1: Mileage can be updated to a value smaller than the current mileage

### Root Cause

The validation chain only checks that mileage is a non-negative number. Nobody checks whether the new value is greater than or equal to the current stored mileage.

**Backend — `UpdateVehicleDto` (`backend/src/modules/vehicle/dtos/update-vehicle.dto.ts:31-33`)**

```ts
@IsOptional()
@IsNumber()
@Min(0)
@Max(1_000_000)
mileage?: number;
```

`@Min(0)` ensures the value is non-negative but has no awareness of the existing mileage in the database. DTO validators run before the service layer and have no access to current entity state.

**Backend — `VehicleService.updateVehicle` (`backend/src/modules/vehicle/services/vehicle.service.ts:34-45`)**

```ts
async updateVehicle(id, userId, input) {
  const vehicle = await this.getVehicle(id, userId);
  Object.assign(vehicle, input);                          // ← blind overwrite
  const [updated] = await this.vehicleRepository.updateWithSave({ dataArray: [vehicle] });
  return updated;
}
```

After `getVehicle` loads the current entity (with its existing mileage), `Object.assign` merges `input` directly. There is no guard that compares `input.mileage` against `vehicle.mileage` before the overwrite. Any value that passes DTO validation (>= 0) goes straight into the DB.

**Frontend — no comparison validation**

- `MileagePrompt` (`frontend/src/components/vehicles/mileage-prompt.tsx:54`): HTML `min={0}` attribute only; component has no access to current mileage so it cannot compare.
- `VehicleFormDialog` (`frontend/src/components/vehicles/vehicle-form-dialog.tsx:54-60`): validates `parsedMileage >= 0` but does not compare against `vehicle.mileage`.

### Fix Plan

1. **Backend service validation (primary enforcement point)**

   In `VehicleService.updateVehicle`, after loading the existing vehicle and before `Object.assign`, add a guard:

   ```ts
   if (input.mileage !== undefined && input.mileage < vehicle.mileage) {
     throw new BadRequestException(
       'New mileage cannot be less than the current mileage',
     );
   }
   ```

   This is the correct layer: the DTO cannot know current state; the service can and must enforce domain rules after loading the entity.

2. **Frontend UX — `MileagePrompt`**

   Pass current mileage as a prop (`currentMileage: number`) so the component can validate before submission.

   - Add `currentMileage` prop to `MileagePromptProps`.
   - In `VehicleDashboardPage`, pass `vehicle.mileage` as the prop.
   - In `handleSubmit`, add guard: if `parseFloat(value) < currentMileage`, show an inline error and abort the `patchVehicle` call.

3. **Frontend UX — `VehicleFormDialog`**

   When in edit mode (`isEdit = true`), compare `parsedMileage` against `vehicle.mileage` in the `isValid` check:

   ```ts
   const isValid =
     ...
     parsedMileage >= 0 &&
     (!isEdit || parsedMileage >= (vehicle?.mileage ?? 0));
   ```

   Add a validation message below the mileage field when the entered value is less than the current mileage.

4. **Tests**

   - Backend: unit test in `vehicle.service.spec.ts` — assert `BadRequestException` when `input.mileage < vehicle.mileage`.
   - Frontend: tests in `mileage-prompt.spec.tsx` — assert Update button is disabled and error message shown when entered value < currentMileage.
   - Frontend: tests in `vehicle-form-dialog.spec.tsx` — assert Save button is disabled in edit mode when mileage < current.

---

## Bug 2: Vehicle info (name, colour, unit) disappears after mileage prompt update — only mileage remains

### Root Cause

The display breaks because `usePatchVehicle`'s `onSuccess` sets the individual vehicle cache (`[QueryGroup.VEHICLES, vehicleId]`) to `updatedVehicle` AND also calls `invalidateQueries` with the vehicle list key — but **without `exact: true`** matching the list, it would use prefix matching that covers `['vehicles', vehicleId]` as well.

More specifically, the current code reads:

```ts
// usePatchVehicle.ts
onSuccess: (updatedVehicle) => {
  queryClient.setQueryData(
    [QueryGroup.VEHICLES, vehicleId],
    updatedVehicle,
  );
  void queryClient.invalidateQueries({
    queryKey: [QueryGroup.VEHICLES],
    exact: true,
  });
},
```

At first glance, `exact: true` means only the exact `['vehicles']` list query is invalidated. However, the bug is **not** in the invalidation — it is in `setQueryData` being bypassed by a race condition triggered by TanStack Query's internal reconciliation after the mutation cycle completes.

The actual root cause is a **stale-closure problem in the mutation's `onSuccess`**: the `vehicleId` captured by the `usePatchVehicle` closure in `VehicleFormDialog` is `vehicle?.id ?? ''`. If `vehicle` is undefined at the time `usePatchVehicle` is instantiated (e.g., on the first render before the query resolves), `vehicleId` becomes `''`. When that mutation's `onSuccess` fires, it calls:

```ts
queryClient.setQueryData(['vehicles', ''], updatedVehicle);
```

This writes the updated vehicle into the **wrong cache key** — an empty-string vehicleId — while the actual `useVehicle(vehicleId)` query at `['vehicles', realId]` is then **invalidated** by the subsequent refetch triggered for `['vehicles']`, causing it to briefly transition through a loading state. Since `staleTime` is 5 minutes but `setQueryData` updated the wrong key, the real key never received the update. The refetch re-populates the correct key from the server, but during that brief loading window the component conditionally returns early (`if (vehicleLoading)`) — and crucially, this isn't what causes the display corruption.

**The actual display corruption** comes from the `VehicleFormDialog` also calling `usePatchVehicle(vehicle?.id ?? '')`. When `MileagePrompt` triggers the PATCH mutation, BOTH `usePatchVehicle` instances share the same TanStack Query mutation key internally, and in some scenarios both `onSuccess` handlers fire — the one from `VehicleFormDialog` fires with an empty-string `vehicleId`, corrupting the wrong key and leaving the real key in an invalidated/stale state that triggers a refetch.

> **Note:** The exact interplay of mutation observers in TanStack Query v5 needs runtime confirmation. The above describes the most plausible explanation given the symptoms. Add `console.log(vehicleId, updatedVehicle)` at the top of `onSuccess` in `usePatchVehicle` and reproduce the bug to confirm the `vehicleId` value when the corruption occurs.

### Fix Plan

1. **Remove `setQueryData` from `usePatchVehicle` — use invalidation only**

   The `setQueryData` optimisation is only safe when the vehicleId is guaranteed correct. Replace the two-step cache manipulation with a single `invalidateQueries` call that covers both the individual vehicle and the list:

   ```ts
   onSuccess: () => {
     void queryClient.invalidateQueries({
       queryKey: [QueryGroup.VEHICLES, vehicleId],
     });
     void queryClient.invalidateQueries({
       queryKey: [QueryGroup.VEHICLES],
       exact: true,
     });
   },
   ```

   This forces a proper refetch for the individual vehicle from the server after every patch, eliminating stale-closure or wrong-key risks. The `staleTime: 5 minutes` is overridden by `invalidateQueries` (marks stale immediately and refetches if there are active observers).

2. **Guard against empty vehicleId in `usePatchVehicle`**

   Add an early return or disabled state when `vehicleId` is empty to prevent the mutation from firing with an invalid id:

   ```ts
   mutationFn: (data) => {
     if (!vehicleId) throw new Error('vehicleId is required');
     return apiClient.patch<IVehicleResDTO>(`/vehicles/${vehicleId}`, data);
   },
   ```

3. **Tests**

   - Update `usePatchVehicle.spec.ts` to assert that `invalidateQueries` is called for both `[QueryGroup.VEHICLES, vehicleId]` (without exact) and `[QueryGroup.VEHICLES]` (with exact).
   - Assert that `setQueryData` is **not** called.
   - Add a test asserting that calling `mutate` with an empty vehicleId rejects immediately.

---

## Dependency / execution order

1. Write failing tests for Bug 1 (backend service + frontend components).
2. Implement Bug 1 backend fix (`VehicleService.updateVehicle`).
3. Implement Bug 1 frontend fixes (`MileagePrompt` prop + `VehicleFormDialog` validation).
4. Write failing tests for Bug 2 (`usePatchVehicle`).
5. Implement Bug 2 fix (remove `setQueryData`, use dual `invalidateQueries`).
6. Format and lint all changed files.

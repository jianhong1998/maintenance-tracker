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

- `MileagePrompt` (`frontend/src/components/vehicles/mileage-prompt.tsx:61`): disabled only checks for a parseable number; component has no access to current mileage so it cannot compare.
- `VehicleFormDialog` (`frontend/src/components/vehicles/vehicle-form-dialog.tsx:55-60`): validates `parsedMileage >= 0` but does not compare against `vehicle.mileage` in edit mode.

### Paths already protected — no changes needed

**`maintenance-card.service.ts#markDone` (`backend/src/modules/maintenance-card/services/maintenance-card.service.ts:224`)**

```ts
if (input.doneAtMileage != null && input.doneAtMileage > vehicle.mileage) {
  await this.vehicleService.updateVehicle(vehicleId, userId, {
    mileage: input.doneAtMileage,
  });
}
```

This path only calls `updateVehicle` when `doneAtMileage > vehicle.mileage`. A lower or equal value simply skips the vehicle update — it cannot decrease mileage. Additionally, once the backend guard (Step 1 below) is in place, any future call to `updateVehicle` from this path also inherits the guard. No changes needed here.

### Fix Plan

1. **Backend service validation (primary enforcement point)**

   In `VehicleService.updateVehicle`, add a guard after loading the vehicle and before `Object.assign`:

   ```ts
   if (input.mileage !== undefined && input.mileage < vehicle.mileage) {
     throw new BadRequestException(
       'New mileage cannot be less than the current mileage',
     );
   }
   ```

   Import `BadRequestException` from `@nestjs/common` (already imported in the file).

   > **Note on race conditions:** This is an application-layer check. Two theoretically concurrent PATCH requests could both read the same stale mileage and both pass validation before either writes. This scenario is impossible in practice for a single-user personal app. Adding database-level locking (e.g., TypeORM `pessimistic_write` lock inside a transaction) would be the rigorous fix but is out of scope given the usage pattern.

2. **Frontend UX — `MileagePrompt` (`frontend/src/components/vehicles/mileage-prompt.tsx`)**

   a. Add `currentMileage: number` to `MileagePromptProps`.

   b. In `handleSubmit`, add a guard before calling `patchVehicle`:
   ```ts
   const parsed = parseFloat(value.trim());
   if (parsed < currentMileage) {
     // show inline error and abort — do NOT call patchVehicle
     return;
   }
   patchVehicle({ mileage: parsed }, { onSuccess: dismiss });
   ```
   Add an inline error state (e.g. `useState<string | null>(null)` for `validationError`) and render it in the UI below the input, similar to the existing `isError` message.

   c. Also tighten the Update button's `disabled` condition to include the mileage comparison:
   ```ts
   disabled={!value.trim() || isNaN(parseFloat(value)) || parseFloat(value) < currentMileage}
   ```

   d. **Caller update — `vehicle-dashboard-page.tsx:116`:**
   ```tsx
   // Before
   <MileagePrompt vehicleId={vehicleId} />

   // After
   <MileagePrompt vehicleId={vehicleId} currentMileage={vehicle.mileage} />
   ```
   `vehicle` is guaranteed non-null at this render point — the component returns early at lines 60-66 if the vehicle is loading or missing.

3. **Frontend UX — `VehicleFormDialog` (`frontend/src/components/vehicles/vehicle-form-dialog.tsx:55-60`)**

   Add the mileage comparison to the `isValid` check in edit mode:

   ```ts
   const isValid =
     brand.trim().length > 0 &&
     model.trim().length > 0 &&
     colour.trim().length > 0 &&
     !isNaN(parsedMileage) &&
     parsedMileage >= 0 &&
     (!isEdit || parsedMileage >= (vehicle?.mileage ?? 0));
   ```

   The `!isEdit` short-circuit means the comparison only applies when editing. `vehicle?.mileage ?? 0` is used for TypeScript type-safety, but in practice `vehicle` is always defined when `isEdit` is true (it's the precondition for `isEdit = !!vehicle`).

   Add a validation message below the mileage field:
   ```tsx
   {isEdit && !isNaN(parsedMileage) && parsedMileage < (vehicle?.mileage ?? 0) && (
     <p className="text-destructive text-xs mt-1">
       Cannot reduce mileage below current value ({vehicle?.mileage})
     </p>
   )}
   ```

4. **Tests**

   - Backend: unit test in `vehicle.service.spec.ts` — assert `BadRequestException` is thrown when `input.mileage < vehicle.mileage`.
   - Backend: assert no exception when `input.mileage === vehicle.mileage` (equal is allowed).
   - Frontend: tests in `mileage-prompt.spec.tsx`:
     - All existing callers must now pass `currentMileage` prop.
     - Assert Update button is disabled when entered value < `currentMileage`.
     - Assert inline validation error is shown when entered value < `currentMileage`.
     - Assert `patchVehicle` is NOT called when validation fails.
   - Frontend: tests in `vehicle-form-dialog.spec.tsx` — assert Save button is disabled in edit mode when `parsedMileage < vehicle.mileage`, and enabled when equal or greater.

---

## Bug 2: Vehicle info (name, colour, unit) disappears after mileage prompt update — only mileage remains

### Root Cause

The root cause is a **stale-closure problem in `usePatchVehicle`'s `onSuccess`**.

**`VehicleFormDialog` (`frontend/src/components/vehicles/vehicle-form-dialog.tsx:52`)**

```ts
const patchMutation = usePatchVehicle(vehicle?.id ?? '');
```

React's Rules of Hooks require this call to be unconditional. On first render, if `vehicle` is undefined, `vehicleId` is captured as `''`. When the mutation's `onSuccess` fires, it calls:

```ts
queryClient.setQueryData(['vehicles', ''], updatedVehicle);
```

This writes the updated vehicle into the **wrong cache key**. The real query at `['vehicles', realId]` is then invalidated by the subsequent `invalidateQueries` call, causing a refetch. During that brief loading window, the vehicle display loses its data.

**`usePatchVehicle` (`frontend/src/hooks/mutations/vehicles/usePatchVehicle.ts`)**

```ts
onSuccess: (updatedVehicle) => {
  queryClient.setQueryData(
    [QueryGroup.VEHICLES, vehicleId],   // ← potentially ['vehicles', '']
    updatedVehicle,
  );
  void queryClient.invalidateQueries({
    queryKey: [QueryGroup.VEHICLES],
    exact: true,
  });
},
```

The `setQueryData` optimisation is only safe when `vehicleId` is guaranteed correct. When it writes to the wrong key, the display breaks.

### Query key structure (no child keys under vehicle-specific key)

```
[QueryGroup.VEHICLES]              → vehicle list
[QueryGroup.VEHICLES, vehicleId]   → individual vehicle (no sub-keys exist)
[QueryGroup.MAINTENANCE_CARDS, vehicleId]  → maintenance cards (separate group)
```

Maintenance cards use their own `QueryGroup.MAINTENANCE_CARDS` group, not nested under `VEHICLES`. This means invalidating `[QueryGroup.VEHICLES, vehicleId]` does not cascade to maintenance cards regardless of the `exact` flag.

### Fix Plan

1. **Remove `setQueryData` from `usePatchVehicle` — use invalidation only**

   Replace the entire `onSuccess` with dual `invalidateQueries`, both using `exact: true`:

   ```ts
   onSuccess: () => {
     void queryClient.invalidateQueries({
       queryKey: [QueryGroup.VEHICLES, vehicleId],
       exact: true,
     });
     void queryClient.invalidateQueries({
       queryKey: [QueryGroup.VEHICLES],
       exact: true,
     });
   },
   ```

   > **Why `exact: true` on both?** The specific vehicle key currently has no child keys (maintenance cards are under `MAINTENANCE_CARDS`, not `VEHICLES`). Adding `exact: true` makes the intent explicit and prevents unintended cascade if sub-keys are added in the future.

   > **Trade-off:** This replaces the one-request approach (setQueryData + list invalidation) with two network requests per update. The individual vehicle is now refetched from the server, not updated from the mutation response. This is the correct trade-off — correctness over saving one request.

   > **Why not `await` sequentially?** `invalidateQueries` synchronously marks queries stale and initiates refetches for active observers. Both calls can fire concurrently with `void`. There is no atomicity requirement between the individual vehicle and list views.

2. **Guard against empty vehicleId in `usePatchVehicle`**

   Add an early throw in `mutationFn`:

   ```ts
   mutationFn: (data) => {
     if (!vehicleId) throw new Error('vehicleId is required');
     return apiClient.patch<IVehicleResDTO>(`/vehicles/${vehicleId}`, data);
   },
   ```

   > **Note:** In `VehicleFormDialog`, `patchMutation` is only called when `isEdit = true`, which requires `vehicle` to be defined, which means `vehicle.id` is a valid UUID. This guard is belt-and-suspenders defense — it should never actually trigger, but it prevents a malformed API call (`PATCH /vehicles/`) if the hook is ever misused.

3. **Tests**

   Update `usePatchVehicle.spec.ts`:
   - Assert `invalidateQueries` is called for `[QueryGroup.VEHICLES, vehicleId]` with `exact: true`.
   - Assert `invalidateQueries` is called for `[QueryGroup.VEHICLES]` with `exact: true`.
   - Assert `setQueryData` is **not** called.
   - Assert that calling `mutate` with an empty `vehicleId` rejects immediately.

---

## Dependency / execution order

1. Write failing tests for Bug 1 (backend service + frontend components).
2. Implement Bug 1 backend fix (`VehicleService.updateVehicle`).
3. Implement Bug 1 frontend fixes (`MileagePrompt` prop + caller update + `VehicleFormDialog` validation).
4. Write failing tests for Bug 2 (`usePatchVehicle`).
5. Implement Bug 2 fix (remove `setQueryData`, use dual `invalidateQueries` with `exact: true`).
6. Format and lint all changed files.

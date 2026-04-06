# Design: VehicleFormDialog Container/Presentation Split

**Date:** 2026-04-06
**Branch:** feat/000/add-vehicle-number
**Motivation:** `VehicleFormDialog` violates single-responsibility — it owns form state, side effects, mutations, derived validation, and full UI rendering in one file. The project's frontend convention requires a container/presentation split. This refactor extracts a `useVehicleForm` hook and a `VehicleFormDialogPresentation` component so each file has one clear purpose.

---

## Files Changed

| File | Change | Responsibility after |
|---|---|---|
| `frontend/src/components/vehicles/use-vehicle-form.ts` | **New** | All state, effects, mutations, derived values, `handleSave` |
| `frontend/src/components/vehicles/vehicle-form-dialog-presentation.tsx` | **New** | Pure UI rendering, no hooks |
| `frontend/src/components/vehicles/vehicle-form-dialog.tsx` | **Updated** | Thin connector: calls hook, renders presentation |

---

## `useVehicleForm` Hook

**Location:** `frontend/src/components/vehicles/use-vehicle-form.ts`

Co-located with the dialog (not in `src/hooks/`) because it encapsulates UI state specific to this dialog, not reusable data-fetching logic.

### Input

```ts
type UseVehicleFormParams = {
  open: boolean;
  vehicle?: IVehicleResDTO;
  hasCards?: boolean;
  onOpenChange: (open: boolean) => void;
};
```

### Responsibilities

- 6 `useState` fields: `registrationNumber`, `brand`, `model`, `colour`, `mileage`, `mileageUnit`
- `useEffect` that resets all fields to `vehicle` values (or empty) when `open` becomes `true`
- Both mutation hooks called unconditionally (Rules of Hooks): `useCreateVehicle()`, `usePatchVehicle(vehicle?.id ?? '')`
- Derived values:
  - `isEdit: boolean` — `!!vehicle`
  - `parsedMileage: number` — `parseFloat(mileage)`
  - `isMileageBelowCurrent: boolean` — only meaningful in edit mode
  - `isValid: boolean` — all required fields non-empty, mileage valid, mileage not below current in edit mode
  - `isPending: boolean` — either mutation is pending
  - `unitLocked: boolean` — `isEdit && hasCards`
- `handleSave()` — trims fields, branches on `isEdit` to call the correct mutation, fires `toast` on success/error, calls `onOpenChange(false)` on success

### Return Shape

```ts
{
  // Field values
  registrationNumber: string;
  brand: string;
  model: string;
  colour: string;
  mileage: string;
  mileageUnit: 'km' | 'mile';

  // Field handlers
  onRegistrationNumberChange: (v: string) => void;
  onBrandChange: (v: string) => void;
  onModelChange: (v: string) => void;
  onColourChange: (v: string) => void;
  onMileageChange: (v: string) => void;
  onMileageUnitChange: (unit: 'km' | 'mile') => void;

  // Derived state
  isEdit: boolean;
  isValid: boolean;
  isPending: boolean;
  unitLocked: boolean;
  isMileageBelowCurrent: boolean;
  currentVehicleMileage: number | undefined;

  // Action
  handleSave: () => void;
}
```

---

## `VehicleFormDialogPresentation` Component

**Location:** `frontend/src/components/vehicles/vehicle-form-dialog-presentation.tsx`

### Responsibilities

- No hooks of any kind
- Renders the `<Dialog>` wrapper with title derived from `isEdit`
- Renders all form fields as controlled inputs wired to the passed handlers
- Renders the registration number character counter
- Renders the mileage-below-current error message when `isMileageBelowCurrent` is true (uses `currentVehicleMileage` for the display value)
- Renders the unit selector with locked state
- Renders Cancel and Save buttons with correct disabled states

### Props

All values come from `useVehicleForm`'s return shape, plus `open` and `onOpenChange` for the `<Dialog>`:

```ts
type VehicleFormDialogPresentationProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & ReturnType<typeof useVehicleForm>;
```

Or expanded explicitly if `ReturnType` is not preferred for readability.

---

## Updated `VehicleFormDialog` Container

**Location:** `frontend/src/components/vehicles/vehicle-form-dialog.tsx`

Thin connector — ~10 lines of logic:

```ts
export const VehicleFormDialog: FC<VehicleFormDialogProps> = ({
  open, onOpenChange, vehicle, hasCards,
}) => {
  const form = useVehicleForm({ open, vehicle, hasCards, onOpenChange });
  return <VehicleFormDialogPresentation open={open} onOpenChange={onOpenChange} {...form} />;
};
```

---

## Testing

### `use-vehicle-form.spec.ts` (new)

Unit tests using `renderHook` from `@testing-library/react`:

- Initialises with empty fields when `vehicle` is undefined and `open` becomes true
- Resets to `vehicle` values when `open` becomes true in edit mode
- `isValid` is false when required fields are empty
- `isValid` is false when `mileage` is below current in edit mode
- `isValid` is true when all required fields are filled and mileage is valid
- `handleSave` calls `createMutation.mutate` with correct payload in create mode (optional `registrationNumber` sent as `undefined` when empty)
- `handleSave` calls `patchMutation.mutate` with correct payload in edit mode (`registrationNumber` sent as `null` when empty)
- `unitLocked` is true only when `isEdit && hasCards`
- `isMileageBelowCurrent` is true when parsed mileage < currentVehicleMileage in edit mode

### `vehicle-form-dialog-presentation.spec.tsx` (new)

Rendering tests with mocked props (no mutation setup needed):

- Renders "Add Vehicle" title when `isEdit` is false
- Renders "Edit Vehicle" title when `isEdit` is true
- Shows character counter for registration number
- Shows mileage error when `isMileageBelowCurrent` is true, hidden otherwise
- Save button is disabled when `isValid` is false or `isPending` is true
- Unit selector buttons are disabled when `unitLocked` is true
- Locked unit hint text appears when `unitLocked` is true

### `vehicle-form-dialog.spec.tsx` (existing)

Existing integration tests remain unchanged — they test the connected component and cover end-to-end behavior. No behavioral change is introduced.

---

## Constraints

- No behavioral change — this is a pure structural refactor
- `inputClass` constant moves to the presentation file (it belongs to rendering)
- The `open` and `onOpenChange` props are passed to both the hook and the presentation component — the hook needs `open` for the reset effect, the presentation needs them for `<Dialog>`
- Mutation hooks must remain unconditionally called (Rules of Hooks) — the hook already handles this correctly

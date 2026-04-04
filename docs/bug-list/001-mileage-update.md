# Bug report 1

## Description

User is able to update the mileage that smaller than current mileage.

There is no validation in all mileage updates.

## Expected Behaviour

When user enter a smaller mileage, should prompt user that cannot update mileage to smaller than current mileage.

## Current Behaviour

Vehicle mileage is updated successfully. Maintenance card next due mileage not affected.

## Affected Paths

1. `MileagePrompt` — daily mileage prompt field accepts any non-negative number.
2. `VehicleFormDialog` (edit mode) — mileage field accepts any non-negative number.
3. `MarkDoneDialog` — "Done at mileage" field accepts any positive number, including values below the vehicle's current mileage.

## Fix Status

All three paths have been fixed:

- `MileagePrompt`: added `currentMileage` prop; submit guard + disabled button when value < currentMileage; backend `VehicleService.updateVehicle` throws `BadRequestException` when `input.mileage < vehicle.mileage`.
- `VehicleFormDialog` (edit mode): `isValid` check now includes `parsedMileage >= vehicle.mileage`; inline error message shown when below current mileage.
- `MarkDoneDialog`: added `currentMileage` prop; `isValid` now requires `doneAtMileage >= currentMileage`; backend `MaintenanceCardService.markDone` throws `BadRequestException` when `doneAtMileage < vehicle.mileage`.

# Bug report 2

## Description

After update the vehicle mileage from the daily mileage prompt field, the displaying of vehicle info is broken.

## Expected Behaviour

After the updating of mileage is done, the display should only update the mileage display.

## Current Behaviour

After the udpating of mileage is done, the vehicle name and other info are gone, only left with the updated vehicle mileage.

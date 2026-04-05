# Bug List Index

An index of all recorded bugs, their reports, and fix plans.

---

## 001 — Mileage Update Issues

**Branch:** `bugfix/000/mileage-update-issue`

**Files:**
- [Bug Report](001-mileage-update-issues/001-bug-report.md)
- [Fix Plan](001-mileage-update-issues/002-fix-plan.md)

**Bugs covered:**

### Bug 1 — Mileage can be set below current value
No validation prevented users from entering a mileage smaller than the vehicle's current mileage. Affected three paths: `MileagePrompt`, `VehicleFormDialog` (edit mode), and `MarkDoneDialog`.

**Fix:** Backend guard in `VehicleService.updateVehicle` and `MaintenanceCardService.markDone` throws `BadRequestException` when new mileage is below current. Frontend validation added to all three components — submit guard, disabled button state, and inline error messages.

### Bug 2 — Vehicle info disappears after mileage prompt update
After submitting the daily mileage prompt, vehicle name and other info vanished — only the updated mileage remained. Root cause: stale closure in `usePatchVehicle` caused `setQueryData` to write to the wrong cache key (`['vehicles', '']` instead of the real ID), then `invalidateQueries` flushed the real key, leaving the view in a loading state with no data.

**Fix:** Removed `setQueryData` from `usePatchVehicle`. Replaced with dual `invalidateQueries` (both `[QueryGroup.VEHICLES, vehicleId]` and `[QueryGroup.VEHICLES]` with `exact: true`) — correctness over saving one network request.

# Embedding mileage-related fields in VehicleEntity

Identified during planning of refactor/000/mileage-prompt-refactoring.

---

## Problem

`VehicleEntity` currently has mileage-related fields scattered as flat columns: `mileage`, `mileageUnit`, and (after refactor #001) `mileageLastUpdatedAt`. These three fields are semantically a single concept — the vehicle's odometer state — but there is no structural grouping to reflect that.

Adding more mileage-related fields in the future (e.g. mileage at last service, odometer unit conversion) will continue to pollute the top-level entity.

## Potential solution

Use TypeORM's embedded entity to group mileage-related columns under a `MileageInfo` class:

```ts
// mileage-info.embedded.ts
export class MileageInfo {
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'mileage', transformer: decimalTransformer })
  value: number;

  @Column({ type: 'enum', enum: Object.values(MILEAGE_UNITS), name: 'mileage_unit', default: MILEAGE_UNITS.KM })
  unit: MileageUnit;

  @Column({ type: 'timestamptz', name: 'mileage_last_updated_at', nullable: true })
  lastUpdatedAt: Date | null;
}

// VehicleEntity
@Embedded(() => MileageInfo, { prefix: false })
mileage: MileageInfo;
```

With `prefix: false` and explicit `name` overrides on each `@Column`, the underlying DB columns (`mileage`, `mileage_unit`, `mileage_last_updated_at`) remain unchanged — no migration needed for existing columns.

## Considerations

- **Internal refactor blast**: `vehicle.mileage` (number) becomes `vehicle.mileage.value` everywhere — `VehicleService`, `MaintenanceCardService`, `toResDTO`, all spec files.
- **DTO shape decision**: `IVehicleResDTO` could either stay flat (safe, no API break) or restructure to `mileage: { value, unit, lastUpdatedAt }` (cleaner, but breaking change for frontend).
- **Scope**: This is purely a structural refactor with no user-facing behaviour change. It deserves its own dedicated PR rather than being bundled into a feature branch.

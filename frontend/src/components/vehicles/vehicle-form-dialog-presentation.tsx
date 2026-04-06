import { FC } from 'react';
import { MILEAGE_UNITS } from '@project/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

type VehicleFormDialogPresentationProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationNumber: string;
  brand: string;
  model: string;
  colour: string;
  mileage: string;
  mileageUnit: 'km' | 'mile';
  onRegistrationNumberChange: (v: string) => void;
  onBrandChange: (v: string) => void;
  onModelChange: (v: string) => void;
  onColourChange: (v: string) => void;
  onMileageChange: (v: string) => void;
  onMileageUnitChange: (unit: 'km' | 'mile') => void;
  isEdit: boolean;
  isValid: boolean;
  isPending: boolean;
  unitLocked: boolean;
  isMileageBelowCurrent: boolean;
  currentVehicleMileage: number | undefined;
  handleSave: () => void;
};

export const VehicleFormDialogPresentation: FC<
  VehicleFormDialogPresentationProps
> = ({
  open,
  onOpenChange,
  registrationNumber,
  brand,
  model,
  colour,
  mileage,
  mileageUnit,
  onRegistrationNumberChange,
  onBrandChange,
  onModelChange,
  onColourChange,
  onMileageChange,
  onMileageUnitChange,
  isEdit,
  isValid,
  isPending,
  unitLocked,
  isMileageBelowCurrent,
  currentVehicleMileage,
  handleSave,
}) => {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit Vehicle' : 'Add Vehicle'}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="vehicle-reg-number"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Vehicle Registration Number{' '}
            <span className="font-normal normal-case tracking-normal">
              ({registrationNumber.length}/15)
            </span>
          </label>
          <input
            id="vehicle-reg-number"
            type="text"
            maxLength={15}
            value={registrationNumber}
            onChange={(e) => onRegistrationNumberChange(e.target.value)}
            placeholder="e.g. SBC1234Z"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="vehicle-brand"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Brand <span className="text-destructive">*</span>
            </label>
            <input
              id="vehicle-brand"
              type="text"
              value={brand}
              onChange={(e) => onBrandChange(e.target.value)}
              placeholder="e.g. Toyota"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="vehicle-model"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Model <span className="text-destructive">*</span>
            </label>
            <input
              id="vehicle-model"
              type="text"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder="e.g. Corolla"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="vehicle-colour"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Colour <span className="text-destructive">*</span>
          </label>
          <input
            id="vehicle-colour"
            type="text"
            value={colour}
            onChange={(e) => onColourChange(e.target.value)}
            placeholder="e.g. Silver"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="vehicle-mileage"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Mileage <span className="text-destructive">*</span>
            </label>
            <input
              id="vehicle-mileage"
              type="number"
              min={0}
              value={mileage}
              onChange={(e) => onMileageChange(e.target.value)}
              placeholder="e.g. 85000"
              className={inputClass}
            />
            {isMileageBelowCurrent && (
              <p className="text-destructive text-xs mt-1">
                Cannot reduce mileage below current value (
                {currentVehicleMileage})
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Unit {!unitLocked && <span className="text-destructive">*</span>}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                {([MILEAGE_UNITS.KM, MILEAGE_UNITS.MILE] as const).map(
                  (unit) => (
                    <button
                      key={unit}
                      type="button"
                      disabled={unitLocked}
                      onClick={() => onMileageUnitChange(unit)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-xs',
                        mileageUnit === unit
                          ? 'border-transparent bg-primary text-primary-foreground'
                          : 'border-input bg-background',
                        unitLocked && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      {unit}
                    </button>
                  ),
                )}
              </div>
              {unitLocked && (
                <span className="text-xs italic text-muted-foreground">
                  Delete all maintenance cards to edit this
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isValid || isPending}
          >
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

'use client';

import { FC, useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { IVehicleResDTO } from '@project/types';
import { MILEAGE_UNITS } from '@project/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCreateVehicle } from '@/hooks/mutations/vehicles/useCreateVehicle';
import { usePatchVehicle } from '@/hooks/mutations/vehicles/usePatchVehicle';
import { cn } from '@/lib/utils';

type VehicleFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: IVehicleResDTO;
  hasCards?: boolean;
};

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export const VehicleFormDialog: FC<VehicleFormDialogProps> = ({
  open,
  onOpenChange,
  vehicle,
  hasCards = false,
}) => {
  const isEdit = !!vehicle;

  const [registrationNumber, setRegistrationNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [colour, setColour] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageUnit, setMileageUnit] = useState<'km' | 'mile'>(
    MILEAGE_UNITS.KM,
  );

  useEffect(() => {
    if (open) {
      setRegistrationNumber(vehicle?.registrationNumber ?? '');
      setBrand(vehicle?.brand ?? '');
      setModel(vehicle?.model ?? '');
      setColour(vehicle?.colour ?? '');
      setMileage(vehicle?.mileage?.toString() ?? '');
      setMileageUnit(vehicle?.mileageUnit ?? MILEAGE_UNITS.KM);
    }
  }, [open, vehicle]);

  // Both hooks must be called unconditionally (Rules of Hooks).
  // Only one fires per save depending on isEdit.
  const createMutation = useCreateVehicle();
  const patchMutation = usePatchVehicle(vehicle?.id ?? '');

  const parsedMileage = parseFloat(mileage);
  const isValid =
    brand.trim().length > 0 &&
    model.trim().length > 0 &&
    colour.trim().length > 0 &&
    !isNaN(parsedMileage) &&
    parsedMileage >= 0 &&
    (!isEdit || parsedMileage >= vehicle!.mileage);

  const isPending = createMutation.isPending || patchMutation.isPending;
  const unitLocked = isEdit && hasCards;

  const successMsg = isEdit ? 'Vehicle updated' : 'Vehicle created';

  const handleSave = () => {
    const trimmedReg = registrationNumber.trim();
    const commonPayload = {
      brand: brand.trim(),
      model: model.trim(),
      colour: colour.trim(),
      mileage: parsedMileage,
      mileageUnit,
    };
    const callbacks = {
      onSuccess: () => {
        toast.success(successMsg);
        onOpenChange(false);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Something went wrong');
      },
    };

    if (isEdit) {
      patchMutation.mutate(
        { ...commonPayload, registrationNumber: trimmedReg || null },
        callbacks,
      );
    } else {
      createMutation.mutate(
        { ...commonPayload, registrationNumber: trimmedReg || undefined },
        callbacks,
      );
    }
  };

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
            onChange={(e) => setRegistrationNumber(e.target.value)}
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
              onChange={(e) => setBrand(e.target.value)}
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
              onChange={(e) => setModel(e.target.value)}
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
            onChange={(e) => setColour(e.target.value)}
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
              onChange={(e) => setMileage(e.target.value)}
              placeholder="e.g. 85000"
              className={inputClass}
            />
            {isEdit &&
              !isNaN(parsedMileage) &&
              parsedMileage < vehicle!.mileage && (
                <p className="text-destructive text-xs mt-1">
                  Cannot reduce mileage below current value ({vehicle!.mileage})
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
                      onClick={() => setMileageUnit(unit)}
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

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { IVehicleResDTO } from '@project/types';
import { MILEAGE_UNITS } from '@project/types';
import { useCreateVehicle } from '@/hooks/mutations/vehicles/useCreateVehicle';
import { usePatchVehicle } from '@/hooks/mutations/vehicles/usePatchVehicle';

type UseVehicleFormParams = {
  open: boolean;
  vehicle?: IVehicleResDTO;
  hasCards?: boolean;
  onOpenChange: (open: boolean) => void;
};

export const useVehicleForm = ({
  open,
  vehicle,
  hasCards = false,
  onOpenChange,
}: UseVehicleFormParams) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Both hooks must be called unconditionally (Rules of Hooks).
  // Only one fires per save depending on isEdit.
  const createMutation = useCreateVehicle();
  const patchMutation = usePatchVehicle(vehicle?.id ?? '');

  const parsedMileage = parseFloat(mileage);
  const isMileageBelowCurrent =
    vehicle !== undefined &&
    !isNaN(parsedMileage) &&
    parsedMileage < vehicle.mileage;

  const trimmedReg = registrationNumber.trim();

  const isValid =
    brand.trim().length > 0 &&
    model.trim().length > 0 &&
    colour.trim().length > 0 &&
    !isNaN(parsedMileage) &&
    parsedMileage >= 0 &&
    !isMileageBelowCurrent;

  const isPending = createMutation.isPending || patchMutation.isPending;
  const unitLocked = isEdit && hasCards;

  const handleSave = () => {
    if (!isValid) return;
    const commonPayload = {
      brand: brand.trim(),
      model: model.trim(),
      colour: colour.trim(),
      mileage: parsedMileage,
      mileageUnit,
    };
    const callbacks = {
      onSuccess: () => {
        toast.success(isEdit ? 'Vehicle updated' : 'Vehicle created');
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

  return {
    registrationNumber,
    brand,
    model,
    colour,
    mileage,
    mileageUnit,
    onRegistrationNumberChange: setRegistrationNumber,
    onBrandChange: setBrand,
    onModelChange: setModel,
    onColourChange: setColour,
    onMileageChange: setMileage,
    onMileageUnitChange: setMileageUnit,
    isEdit,
    isValid,
    isPending,
    unitLocked,
    isMileageBelowCurrent,
    currentVehicleMileage: vehicle?.mileage,
    handleSave,
  };
};

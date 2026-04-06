'use client';

import { FC } from 'react';
import type { IVehicleResDTO } from '@project/types';
import { useVehicleForm } from './use-vehicle-form';
import { VehicleFormDialogPresentation } from './vehicle-form-dialog-presentation';

type VehicleFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: IVehicleResDTO;
  hasCards?: boolean;
};

export const VehicleFormDialog: FC<VehicleFormDialogProps> = ({
  open,
  onOpenChange,
  vehicle,
  hasCards = false,
}) => {
  const form = useVehicleForm({ open, vehicle, hasCards, onOpenChange });
  return (
    <VehicleFormDialogPresentation
      open={open}
      onOpenChange={onOpenChange}
      {...form}
    />
  );
};

import type { IVehicleResDTO } from '@project/types';

export const getVehicleDisplayLabels = (vehicle: IVehicleResDTO) => {
  const brandModel = `${vehicle.brand} ${vehicle.model}`;
  return vehicle.registrationNumber
    ? { primary: vehicle.registrationNumber, secondary: brandModel }
    : { primary: brandModel, secondary: null };
};

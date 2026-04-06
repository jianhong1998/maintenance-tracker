import type { IVehicleResDTO } from '@project/types';

export const getVehicleDisplayLabels = (vehicle: IVehicleResDTO) => ({
  primary: vehicle.registrationNumber ?? `${vehicle.brand} ${vehicle.model}`,
  secondary: vehicle.registrationNumber
    ? `${vehicle.brand} ${vehicle.model}`
    : null,
});

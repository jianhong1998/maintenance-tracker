import type { IVehicleResDTO } from '@project/types';

export const getVehicleDisplayLabels = (vehicle: IVehicleResDTO) => {
  const brandModel = `${vehicle.brand} ${vehicle.model}`;
  return vehicle.registrationNumber
    ? { primary: vehicle.registrationNumber, secondary: brandModel }
    : { primary: brandModel, secondary: null };
};

/**
 * Meta line for the vehicle detail page header.
 * Format: "Colour · Mileage unit · Plate: XXX"
 * Distinct from getVehicleDisplayLabels — this is full detail, not card-list brevity.
 */
export const getVehicleMetaLine = (vehicle: IVehicleResDTO): string => {
  const parts = [
    vehicle.colour,
    `${vehicle.mileage.toLocaleString()} ${vehicle.mileageUnit}`,
  ];
  if (vehicle.registrationNumber) {
    parts.push(`Plate: ${vehicle.registrationNumber}`);
  }
  return parts.join(' · ');
};

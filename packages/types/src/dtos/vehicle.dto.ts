export const MILEAGE_UNITS = Object.freeze({
  KM: 'km',
  MILE: 'mile',
} as const);

export type MileageUnit = (typeof MILEAGE_UNITS)[keyof typeof MILEAGE_UNITS];

export interface ICreateVehicleReqDTO {
  brand: string;
  model: string;
  colour: string;
  mileage: number;
  mileageUnit: MileageUnit;
}

export interface IUpdateVehicleReqDTO {
  brand?: string;
  model?: string;
  colour?: string;
  mileage?: number;
  mileageUnit?: MileageUnit;
}

export interface IVehicleResDTO {
  id: string;
  brand: string;
  model: string;
  colour: string;
  mileage: number;
  mileageUnit: MileageUnit;
  createdAt: string;
  updatedAt: string;
}

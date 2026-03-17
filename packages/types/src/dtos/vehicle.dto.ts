export const MILEAGE_UNITS = ['km', 'mile'] as const;
export type MileageUnit = (typeof MILEAGE_UNITS)[number];

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

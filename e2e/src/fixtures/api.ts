import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  MILEAGE_UNITS,
  type ICreateMaintenanceCardReqDTO,
  type ICreateVehicleReqDTO,
  type IMaintenanceCardResDTO,
  type IRecordMileageReqDTO,
  type IVehicleResDTO,
} from '@project/types';

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:3001';

// e2e test inputs allow omitting mileageUnit (defaults to km below).
export type CreateVehicleInput = Omit<ICreateVehicleReqDTO, 'mileageUnit'> & {
  mileageUnit?: ICreateVehicleReqDTO['mileageUnit'];
};

export type CreateCardInput = ICreateMaintenanceCardReqDTO;
export type VehicleResponse = IVehicleResDTO;
export type CardResponse = IMaintenanceCardResDTO;

const buildClient = (idToken: string): AxiosInstance =>
  axios.create({
    baseURL: BACKEND_URL,
    headers: { Authorization: `Bearer ${idToken}` },
  });

export const apiCreateVehicle = async (
  idToken: string,
  input: CreateVehicleInput,
): Promise<VehicleResponse> => {
  const client = buildClient(idToken);
  const res = await client.post<VehicleResponse>('/vehicles', {
    mileageUnit: MILEAGE_UNITS.KM,
    ...input,
  });
  return res.data;
};

export const apiGetVehicleStatus = async (
  idToken: string,
  vehicleId: string,
): Promise<number> => {
  const client = buildClient(idToken);
  try {
    await client.get(`/vehicles/${vehicleId}`);
    return 200;
  } catch (err) {
    if (err instanceof AxiosError && err.response) return err.response.status;
    throw err;
  }
};

export const apiCreateCard = async (
  idToken: string,
  vehicleId: string,
  input: CreateCardInput,
): Promise<CardResponse> => {
  const client = buildClient(idToken);
  const res = await client.post<CardResponse>(
    `/vehicles/${vehicleId}/maintenance-cards`,
    {
      description: null,
      intervalMileage: null,
      intervalTimeMonths: null,
      nextDueMileage: null,
      nextDueDate: null,
      ...input,
    },
  );
  return res.data;
};

export const apiGetCards = async (
  idToken: string,
  vehicleId: string,
): Promise<CardResponse[]> => {
  const client = buildClient(idToken);
  const res = await client.get<CardResponse[]>(
    `/vehicles/${vehicleId}/maintenance-cards`,
  );
  return res.data;
};

export const apiRecordMileage = async (
  idToken: string,
  vehicleId: string,
  mileage: number,
): Promise<VehicleResponse> => {
  const client = buildClient(idToken);
  const body: IRecordMileageReqDTO = { mileage };
  const res = await client.patch<VehicleResponse>(
    `/vehicles/${vehicleId}/mileage`,
    body,
  );
  return res.data;
};

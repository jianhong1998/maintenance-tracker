import axios, { AxiosInstance } from 'axios';

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:3001';

export type CreateVehicleInput = {
  brand: string;
  model: string;
  colour: string;
  mileage: number;
  mileageUnit?: 'km' | 'mile';
  registrationNumber?: string;
};

export type CreateCardInput = {
  type: 'task' | 'part' | 'item';
  name: string;
  description?: string | null;
  intervalMileage?: number | null;
  intervalTimeMonths?: number | null;
  nextDueMileage?: number | null;
  nextDueDate?: string | null;
};

export type VehicleResponse = {
  id: string;
  brand: string;
  model: string;
  colour: string;
  mileage: number;
  mileageUnit: 'km' | 'mile';
  mileageLastUpdatedAt: string | null;
  registrationNumber: string | null;
};

export type CardResponse = {
  id: string;
  vehicleId: string;
  type: 'task' | 'part' | 'item';
  name: string;
  description: string | null;
  intervalMileage: number | null;
  intervalTimeMonths: number | null;
  nextDueMileage: number | null;
  nextDueDate: string | null;
};

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
    mileageUnit: 'km',
    ...input,
  });
  return res.data;
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

export const apiRecordMileage = async (
  idToken: string,
  vehicleId: string,
  mileage: number,
): Promise<VehicleResponse> => {
  const client = buildClient(idToken);
  const res = await client.patch<VehicleResponse>(
    `/vehicles/${vehicleId}/mileage`,
    { mileage },
  );
  return res.data;
};

export type MaintenanceCardType = 'task' | 'part' | 'item';

export interface ICreateMaintenanceCardReqDTO {
  type: MaintenanceCardType;
  name: string;
  description?: string | null;
  intervalMileage?: number | null;
  intervalTimeMonths?: number | null;
}

export interface IUpdateMaintenanceCardReqDTO {
  type?: MaintenanceCardType;
  name?: string;
  description?: string | null;
  intervalMileage?: number | null;
  intervalTimeMonths?: number | null;
}

export interface IMaintenanceCardResDTO {
  id: string;
  vehicleId: string;
  type: MaintenanceCardType;
  name: string;
  description: string | null;
  intervalMileage: number | null;
  intervalTimeMonths: number | null;
  nextDueMileage: number | null;
  nextDueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

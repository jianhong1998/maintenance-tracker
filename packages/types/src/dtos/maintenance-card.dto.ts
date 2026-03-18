export const MAINTENANCE_CARD_TYPES = Object.freeze({
  TASK: 'task',
  PART: 'part',
  ITEM: 'item',
} as const);

export type MaintenanceCardType = (typeof MAINTENANCE_CARD_TYPES)[keyof typeof MAINTENANCE_CARD_TYPES];

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
  /** ISO date string (YYYY-MM-DD), e.g. "2026-09-01", or null if not yet set */
  nextDueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

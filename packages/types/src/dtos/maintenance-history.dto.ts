export interface IMarkDoneReqDTO {
  doneAtMileage?: number | null;
  notes?: string | null;
}

export interface IMaintenanceHistoryResDTO {
  id: string;
  maintenanceCardId: string;
  doneAtMileage: number | null;
  doneAtDate: string;
  notes: string | null;
  createdAt: string;
}

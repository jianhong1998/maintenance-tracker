import { IsNumber, Max, Min } from 'class-validator';
import type { IRecordMileageReqDTO } from '@project/types';

export class RecordMileageDto implements IRecordMileageReqDTO {
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  mileage: number;
}

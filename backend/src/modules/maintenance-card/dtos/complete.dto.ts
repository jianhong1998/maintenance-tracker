import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import type { IMarkDoneReqDTO } from '@project/types';

export class MarkDoneDto implements IMarkDoneReqDTO {
  @IsOptional()
  @IsNumber()
  @Min(1)
  doneAtMileage?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

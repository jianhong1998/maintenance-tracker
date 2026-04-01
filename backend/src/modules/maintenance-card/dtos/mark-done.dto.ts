import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { IMarkDoneReqDTO } from '@project/types';

export class MarkDoneDto implements IMarkDoneReqDTO {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  doneAtMileage?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

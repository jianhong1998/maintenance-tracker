import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import type {
  IUpdateMaintenanceCardReqDTO,
  MaintenanceCardType,
} from '@project/types';
import { MAINTENANCE_CARD_TYPES } from '@project/types';

export class UpdateMaintenanceCardDto implements IUpdateMaintenanceCardReqDTO {
  @IsOptional()
  @IsIn(Object.values(MAINTENANCE_CARD_TYPES))
  type?: MaintenanceCardType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  // @IsOptional() skips all validators when value is null or undefined (class-validator behaviour)
  // Sending null explicitly clears the field; the service enforces at-least-one-interval constraint.
  @IsOptional()
  @ValidateIf((o: UpdateMaintenanceCardDto) => o.intervalMileage !== null)
  @IsInt()
  @Min(1)
  intervalMileage?: number | null;

  @IsOptional()
  @ValidateIf((o: UpdateMaintenanceCardDto) => o.intervalTimeMonths !== null)
  @IsInt()
  @Min(1)
  intervalTimeMonths?: number | null;
}

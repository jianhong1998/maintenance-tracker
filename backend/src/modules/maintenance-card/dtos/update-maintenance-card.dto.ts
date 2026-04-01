import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
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

  // @IsOptional skips @IsInt/@Min when null or undefined is sent, allowing null to clear the field.
  // The service enforces the at-least-one-interval constraint after both fields are resolved.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  intervalMileage?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  intervalTimeMonths?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  nextDueMileage?: number | null;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string | null;
}

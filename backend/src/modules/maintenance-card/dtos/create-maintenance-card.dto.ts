import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import type {
  ICreateMaintenanceCardReqDTO,
  MaintenanceCardType,
} from '@project/types';
import { MAINTENANCE_CARD_TYPES } from '@project/types';

export class CreateMaintenanceCardDto implements ICreateMaintenanceCardReqDTO {
  @IsEnum(Object.values(MAINTENANCE_CARD_TYPES))
  type: MaintenanceCardType;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  // @ValidateIf skips @IsNumber/@Min when null is sent, allowing null to clear the field.
  // The service enforces the at-least-one-interval constraint after both fields are resolved.
  @IsOptional()
  @ValidateIf((o: CreateMaintenanceCardDto) => o.intervalMileage !== null)
  @IsNumber()
  @Min(1)
  intervalMileage?: number | null;

  @IsOptional()
  @ValidateIf((o: CreateMaintenanceCardDto) => o.intervalTimeMonths !== null)
  @IsNumber()
  @Min(1)
  intervalTimeMonths?: number | null;
}

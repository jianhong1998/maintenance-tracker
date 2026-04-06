import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MILEAGE_UNITS } from '@project/types';
import type { ICreateVehicleReqDTO, MileageUnit } from '@project/types';

export class CreateVehicleDto implements ICreateVehicleReqDTO {
  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsString()
  @IsNotEmpty()
  colour: string;

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  mileage: number;

  @IsString()
  @IsIn(Object.values(MILEAGE_UNITS))
  mileageUnit: MileageUnit;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  registrationNumber?: string;
}

import {
  IsIn,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { MILEAGE_UNITS } from '@project/types';
import type { IUpdateVehicleReqDTO, MileageUnit } from '@project/types';

export class UpdateVehicleDto implements IUpdateVehicleReqDTO {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  brand?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  model?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  colour?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  mileage?: number;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(MILEAGE_UNITS))
  mileageUnit?: MileageUnit;

  @IsOptional()
  @ValidateIf((o: UpdateVehicleDto) => o.registrationNumber !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(15)
  registrationNumber?: string | null;
}

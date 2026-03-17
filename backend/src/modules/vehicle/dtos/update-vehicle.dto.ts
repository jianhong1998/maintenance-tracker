import {
  IsIn,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type { IUpdateVehicleReqDTO, MileageUnit } from '@project/types';
import { MileageUnit as MileageUnitEnum } from 'src/db/entities/vehicle.entity';

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
  mileage?: number;

  @IsOptional()
  @IsIn(Object.values(MileageUnitEnum))
  mileageUnit?: MileageUnit;
}

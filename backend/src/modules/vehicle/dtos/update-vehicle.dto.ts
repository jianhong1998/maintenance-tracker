import {
  IsIn,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { IUpdateVehicleReqDTO, MileageUnit } from '@project/types';

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
  @IsIn(['km', 'mile'])
  mileageUnit?: MileageUnit;
}

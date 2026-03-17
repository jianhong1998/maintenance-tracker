import { IsIn, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ICreateVehicleReqDTO, MileageUnit } from '@project/types';

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
  mileage: number;

  @IsIn(['km', 'mile'])
  mileageUnit: MileageUnit;
}

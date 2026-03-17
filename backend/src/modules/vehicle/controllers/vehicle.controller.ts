import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { IAuthUser, IVehicleResDTO } from '@project/types';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { VehicleEntity } from 'src/db/entities/vehicle.entity';
import { VehicleService } from '../services/vehicle.service';
import { CreateVehicleDto } from '../dtos/create-vehicle.dto';
import { UpdateVehicleDto } from '../dtos/update-vehicle.dto';

function toResDTO(vehicle: VehicleEntity): IVehicleResDTO {
  return {
    id: vehicle.id,
    brand: vehicle.brand,
    model: vehicle.model,
    colour: vehicle.colour,
    mileage: vehicle.mileage,
    mileageUnit: vehicle.mileageUnit,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}

@Controller('vehicles')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Get()
  async list(@CurrentUser() user: IAuthUser): Promise<IVehicleResDTO[]> {
    const vehicles = await this.vehicleService.listVehicles(user.id);
    return vehicles.map(toResDTO);
  }

  @Get(':id')
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<IVehicleResDTO> {
    const vehicle = await this.vehicleService.getVehicle(id, user.id);
    return toResDTO(vehicle);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateVehicleDto,
    @CurrentUser() user: IAuthUser,
  ): Promise<IVehicleResDTO> {
    const vehicle = await this.vehicleService.createVehicle(user.id, dto);
    return toResDTO(vehicle);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser() user: IAuthUser,
  ): Promise<IVehicleResDTO> {
    const vehicle = await this.vehicleService.updateVehicle(id, user.id, dto);
    return toResDTO(vehicle);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<void> {
    await this.vehicleService.deleteVehicle(id, user.id);
  }
}

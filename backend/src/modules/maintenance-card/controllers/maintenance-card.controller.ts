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
  Query,
} from '@nestjs/common';
import type { IAuthUser, IMaintenanceCardResDTO } from '@project/types';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { MaintenanceCardService } from '../services/maintenance-card.service';
import { CreateMaintenanceCardDto } from '../dtos/create-maintenance-card.dto';
import { UpdateMaintenanceCardDto } from '../dtos/update-maintenance-card.dto';

function toResDTO(card: MaintenanceCardEntity): IMaintenanceCardResDTO {
  return {
    id: card.id,
    vehicleId: card.vehicleId,
    type: card.type,
    name: card.name,
    description: card.description,
    intervalMileage: card.intervalMileage,
    intervalTimeMonths: card.intervalTimeMonths,
    nextDueMileage: card.nextDueMileage,
    nextDueDate: card.nextDueDate
      ? new Date(card.nextDueDate).toISOString()
      : null,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

@Controller('vehicles/:vehicleId/maintenance-cards')
export class MaintenanceCardController {
  constructor(private readonly cardService: MaintenanceCardService) {}

  @Get()
  async list(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Query('sort') sort: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<IMaintenanceCardResDTO[]> {
    const sortKey = sort === 'urgency' ? 'urgency' : 'name';
    const cards = await this.cardService.listCards(vehicleId, user.id, sortKey);
    return cards.map(toResDTO);
  }

  @Get(':id')
  async getOne(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<IMaintenanceCardResDTO> {
    const card = await this.cardService.getCard(id, vehicleId, user.id);
    return toResDTO(card);
  }

  @Post()
  async create(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() dto: CreateMaintenanceCardDto,
    @CurrentUser() user: IAuthUser,
  ): Promise<IMaintenanceCardResDTO> {
    const card = await this.cardService.createCard(vehicleId, user.id, {
      type: dto.type,
      name: dto.name,
      description: dto.description ?? null,
      intervalMileage: dto.intervalMileage ?? null,
      intervalTimeMonths: dto.intervalTimeMonths ?? null,
    });
    return toResDTO(card);
  }

  @Patch(':id')
  async update(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaintenanceCardDto,
    @CurrentUser() user: IAuthUser,
  ): Promise<IMaintenanceCardResDTO> {
    const card = await this.cardService.updateCard(id, vehicleId, user.id, dto);
    return toResDTO(card);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<void> {
    await this.cardService.deleteCard(id, vehicleId, user.id);
  }
}

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
import type {
  IAuthUser,
  IMaintenanceCardResDTO,
  IMaintenanceHistoryResDTO,
} from '@project/types';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
import { MaintenanceCardService } from '../services/maintenance-card.service';
import { MaintenanceHistoryService } from '../services/maintenance-history.service';
import { CreateMaintenanceCardDto } from '../dtos/create-maintenance-card.dto';
import { UpdateMaintenanceCardDto } from '../dtos/update-maintenance-card.dto';
import { MarkDoneDto } from '../dtos/mark-done.dto';

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
      ? new Date(card.nextDueDate).toISOString().slice(0, 10)
      : null,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

function historyToResDTO(
  history: MaintenanceHistoryEntity,
): IMaintenanceHistoryResDTO {
  return {
    id: history.id,
    maintenanceCardId: history.maintenanceCardId,
    doneAtMileage: history.doneAtMileage,
    doneAtDate: new Date(history.doneAtDate).toISOString().slice(0, 10),
    notes: history.notes,
    createdAt: history.createdAt.toISOString(),
  };
}

@Controller('vehicles/:vehicleId/maintenance-cards')
export class MaintenanceCardController {
  constructor(
    private readonly cardService: MaintenanceCardService,
    private readonly historyService: MaintenanceHistoryService,
  ) {}

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
  @HttpCode(HttpStatus.CREATED)
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
      nextDueMileage: dto.nextDueMileage ?? null,
      nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null,
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
    const card = await this.cardService.updateCard(id, vehicleId, user.id, {
      ...dto,
      nextDueDate:
        dto.nextDueDate !== undefined
          ? dto.nextDueDate
            ? new Date(dto.nextDueDate)
            : null
          : undefined,
    });
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

  @Post(':id/mark-done')
  @HttpCode(HttpStatus.CREATED)
  async markDone(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkDoneDto,
    @CurrentUser() user: IAuthUser,
  ): Promise<IMaintenanceHistoryResDTO> {
    const history = await this.cardService.markDone(
      id,
      vehicleId,
      user.id,
      dto,
    );
    return historyToResDTO(history);
  }

  @Get(':id/history')
  async listHistory(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<IMaintenanceHistoryResDTO[]> {
    const records = await this.historyService.listHistory(
      id,
      vehicleId,
      user.id,
    );
    return records.map(historyToResDTO);
  }
}

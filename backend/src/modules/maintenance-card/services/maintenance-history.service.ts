import { Injectable, NotFoundException } from '@nestjs/common';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
import { VehicleService } from 'src/modules/vehicle/services/vehicle.service';
import { MaintenanceCardRepository } from '../repositories/maintenance-card.repository';
import { MaintenanceHistoryRepository } from '../repositories/maintenance-history.repository';

@Injectable()
export class MaintenanceHistoryService {
  constructor(
    private readonly historyRepository: MaintenanceHistoryRepository,
    private readonly cardRepository: MaintenanceCardRepository,
    private readonly vehicleService: VehicleService,
  ) {}

  async listHistory(
    cardId: string,
    vehicleId: string,
    userId: string,
  ): Promise<MaintenanceHistoryEntity[]> {
    const [, card] = await Promise.all([
      this.vehicleService.getVehicle(vehicleId, userId),
      this.cardRepository.getOneWithDeleted({
        criteria: { id: cardId, vehicleId },
      }),
    ]);
    if (!card) throw new NotFoundException('Maintenance card not found');

    return this.historyRepository.findByCardId(cardId);
  }
}

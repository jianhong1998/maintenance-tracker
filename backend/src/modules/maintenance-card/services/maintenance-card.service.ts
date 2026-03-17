import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import type { MaintenanceCardType } from '@project/types';
import { VehicleService } from 'src/modules/vehicle/services/vehicle.service';
import { MaintenanceCardRepository } from '../repositories/maintenance-card.repository';

export type CreateCardInput = {
  type: MaintenanceCardType;
  name: string;
  description: string | null;
  intervalMileage: number | null;
  intervalTimeMonths: number | null;
};

export type UpdateCardInput = {
  type?: MaintenanceCardType;
  name?: string;
  description?: string | null;
  intervalMileage?: number | null;
  intervalTimeMonths?: number | null;
};

function assertAtLeastOneInterval(input: {
  intervalMileage?: number | null;
  intervalTimeMonths?: number | null;
}): void {
  if (input.intervalMileage == null && input.intervalTimeMonths == null) {
    throw new BadRequestException(
      'At least one of intervalMileage or intervalTimeMonths must be set',
    );
  }
}

function sortByUrgency(
  cards: MaintenanceCardEntity[],
  vehicleMileage: number,
): MaintenanceCardEntity[] {
  const today = new Date();

  const isDateOverdue = (card: MaintenanceCardEntity): boolean =>
    card.nextDueDate !== null && new Date(card.nextDueDate) < today;

  const isMileageOverdue = (card: MaintenanceCardEntity): boolean =>
    card.nextDueMileage !== null && card.nextDueMileage < vehicleMileage;

  const isOverdue = (card: MaintenanceCardEntity): boolean =>
    isDateOverdue(card) || isMileageOverdue(card);

  const overdueByDate = cards
    .filter((c) => isDateOverdue(c))
    .sort(
      (a, b) =>
        new Date(a.nextDueDate!).getTime() - new Date(b.nextDueDate!).getTime(),
    );

  const overdueByMileageOnly = cards
    .filter((c) => !isDateOverdue(c) && isMileageOverdue(c))
    .sort((a, b) => (a.nextDueMileage ?? 0) - (b.nextDueMileage ?? 0));

  const nonOverdue = cards
    .filter(
      (c) =>
        !isOverdue(c) && (c.nextDueDate !== null || c.nextDueMileage !== null),
    )
    .sort((a, b) => {
      if (a.nextDueDate && b.nextDueDate) {
        return (
          new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
        );
      }
      if (a.nextDueDate) return -1;
      if (b.nextDueDate) return 1;
      return (a.nextDueMileage ?? 0) - (b.nextDueMileage ?? 0);
    });

  const noDueInfo = cards.filter(
    (c) => c.nextDueDate === null && c.nextDueMileage === null,
  );

  return [
    ...overdueByDate,
    ...overdueByMileageOnly,
    ...nonOverdue,
    ...noDueInfo,
  ];
}

@Injectable()
export class MaintenanceCardService {
  constructor(
    private readonly cardRepository: MaintenanceCardRepository,
    private readonly vehicleService: VehicleService,
  ) {}

  async listCards(
    vehicleId: string,
    userId: string,
    sort: 'urgency' | 'name',
  ): Promise<MaintenanceCardEntity[]> {
    const vehicle = await this.vehicleService.getVehicle(vehicleId, userId);
    const cards = await this.cardRepository.getAll({ criteria: { vehicleId } });

    if (sort === 'name') {
      return cards.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sortByUrgency(cards, vehicle.mileage);
  }

  async getCard(
    id: string,
    vehicleId: string,
    userId: string,
  ): Promise<MaintenanceCardEntity> {
    await this.vehicleService.getVehicle(vehicleId, userId);
    const card = await this.cardRepository.getOne({
      criteria: { id, vehicleId },
    });
    if (!card) throw new NotFoundException('Maintenance card not found');
    return card;
  }

  async createCard(
    vehicleId: string,
    userId: string,
    input: CreateCardInput,
  ): Promise<MaintenanceCardEntity> {
    assertAtLeastOneInterval(input);
    await this.vehicleService.getVehicle(vehicleId, userId);
    return this.cardRepository.create({
      creationData: { vehicleId, ...input },
    });
  }

  async updateCard(
    id: string,
    vehicleId: string,
    userId: string,
    input: UpdateCardInput,
  ): Promise<MaintenanceCardEntity> {
    const card = await this.getCard(id, vehicleId, userId);
    Object.assign(card, input);
    assertAtLeastOneInterval(card);
    const [updated] = await this.cardRepository.updateWithSave({
      dataArray: [card],
    });
    return updated;
  }

  async deleteCard(
    id: string,
    vehicleId: string,
    userId: string,
  ): Promise<void> {
    await this.getCard(id, vehicleId, userId);
    await this.cardRepository.delete({ criteria: { id, vehicleId } });
  }
}

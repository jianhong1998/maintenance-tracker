import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { VehicleService } from 'src/modules/vehicle/services/vehicle.service';
import {
  MaintenanceCardRepository,
  type CreateMaintenanceCardData,
} from '../repositories/maintenance-card.repository';

export type CreateCardInput = Omit<CreateMaintenanceCardData, 'vehicleId'>;

type UpdateCardInput = Partial<CreateCardInput>;

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
    card.nextDueDate !== null && card.nextDueDate < today;

  const isMileageOverdue = (card: MaintenanceCardEntity): boolean =>
    card.nextDueMileage !== null && card.nextDueMileage <= vehicleMileage;

  const overdueByDate: MaintenanceCardEntity[] = [];
  const overdueByMileageOnly: MaintenanceCardEntity[] = [];
  const nonOverdue: MaintenanceCardEntity[] = [];
  const noDueInfo: MaintenanceCardEntity[] = [];

  for (const card of cards) {
    if (isDateOverdue(card)) {
      overdueByDate.push(card);
    } else if (isMileageOverdue(card)) {
      overdueByMileageOnly.push(card);
    } else if (card.nextDueDate !== null || card.nextDueMileage !== null) {
      nonOverdue.push(card);
    } else {
      noDueInfo.push(card);
    }
  }

  overdueByDate.sort(
    (a, b) => a.nextDueDate!.getTime() - b.nextDueDate!.getTime(),
  );
  overdueByMileageOnly.sort((a, b) => a.nextDueMileage! - b.nextDueMileage!);
  nonOverdue.sort((a, b) => {
    if (a.nextDueDate && b.nextDueDate) {
      return a.nextDueDate.getTime() - b.nextDueDate.getTime();
    }
    if (a.nextDueDate) return -1;
    if (b.nextDueDate) return 1;
    return a.nextDueMileage! - b.nextDueMileage!;
  });

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
    const [vehicle, cards] = await Promise.all([
      this.vehicleService.getVehicle(vehicleId, userId),
      this.cardRepository.getAll({ criteria: { vehicleId } }),
    ]);

    if (sort === 'name') {
      return [...cards].sort((a, b) => a.name.localeCompare(b.name));
    }

    return sortByUrgency(cards, vehicle.mileage);
  }

  async getCard(
    id: string,
    vehicleId: string,
    userId: string,
  ): Promise<MaintenanceCardEntity> {
    const [, card] = await Promise.all([
      this.vehicleService.getVehicle(vehicleId, userId),
      this.cardRepository.getOne({ criteria: { id, vehicleId } }),
    ]);
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
    const patch = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    );
    Object.assign(card, patch);
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
    const card = await this.getCard(id, vehicleId, userId);
    await this.cardRepository.delete({ entities: [card] });
  }
}

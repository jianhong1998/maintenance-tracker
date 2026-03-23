import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { IMarkDoneReqDTO } from '@project/types';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { MaintenanceHistoryEntity } from 'src/db/entities/maintenance-history.entity';
import { VehicleService } from 'src/modules/vehicle/services/vehicle.service';
import { BackgroundJobRepository } from 'src/modules/background-job/repositories/background-job.repository';
import {
  MaintenanceCardRepository,
  type CreateMaintenanceCardData,
} from '../repositories/maintenance-card.repository';
import { MaintenanceHistoryRepository } from '../repositories/maintenance-history.repository';

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
    private readonly historyRepository: MaintenanceHistoryRepository,
    private readonly vehicleService: VehicleService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly backgroundJobRepository: BackgroundJobRepository,
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
    await this.dataSource.transaction(async (em) => {
      await this.cardRepository.delete({ entities: [card], entityManager: em });
      await this.backgroundJobRepository.cancelJobsForCard(id, em);
    });
  }

  async markDone(
    id: string,
    vehicleId: string,
    userId: string,
    input: IMarkDoneReqDTO,
  ): Promise<MaintenanceHistoryEntity> {
    const [vehicle, card] = await Promise.all([
      this.vehicleService.getVehicle(vehicleId, userId),
      this.cardRepository.getOne({ criteria: { id, vehicleId } }),
    ]);
    if (!card) throw new NotFoundException('Maintenance card not found');

    if (card.intervalMileage !== null && input.doneAtMileage == null) {
      throw new BadRequestException(
        'doneAtMileage is required when the card has an intervalMileage',
      );
    }

    const today = new Date();

    if (card.intervalMileage !== null) {
      card.nextDueMileage = input.doneAtMileage! + card.intervalMileage;
    }
    if (card.intervalTimeMonths !== null) {
      const nextDue = new Date(today);
      nextDue.setMonth(nextDue.getMonth() + card.intervalTimeMonths);
      card.nextDueDate = nextDue;
    }

    const history = await this.dataSource.transaction(async (em) => {
      await this.cardRepository.updateWithSave({
        dataArray: [card],
        entityManager: em,
      });
      const createdHistory = await this.historyRepository.create({
        creationData: {
          maintenanceCardId: id,
          doneAtMileage: input.doneAtMileage ?? null,
          doneAtDate: today,
          notes: input.notes ?? null,
        },
        entityManager: em,
      });
      await this.backgroundJobRepository.cancelJobsForCard(id, em);
      return createdHistory;
    });

    // Known limitation: updateVehicle runs after the transaction commits.
    // A failure here leaves the vehicle mileage stale while the history record persists.
    // Cross-service atomicity requires a saga/outbox pattern (out of scope).
    if (input.doneAtMileage != null && input.doneAtMileage > vehicle.mileage) {
      await this.vehicleService.updateVehicle(vehicleId, userId, {
        mileage: input.doneAtMileage,
      });
    }

    return history;
  }
}

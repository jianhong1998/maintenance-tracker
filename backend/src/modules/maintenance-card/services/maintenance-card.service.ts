import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { compareCardsByUrgency } from '../utils/card-sort.util';

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

function addMonths(date: Date, months: number): Date {
  const targetDay = date.getDate();
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(date.getMonth() + months);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(targetDay, lastDay));
  return result;
}

@Injectable()
export class MaintenanceCardService {
  constructor(
    private readonly cardRepository: MaintenanceCardRepository,
    private readonly historyRepository: MaintenanceHistoryRepository,
    private readonly vehicleService: VehicleService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly backgroundJobRepository: BackgroundJobRepository,
    private readonly configService: ConfigService,
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

    const mileageWarningThresholdKm =
      this.configService.get<number>('MILEAGE_WARNING_THRESHOLD_KM') ?? 500;
    const notificationDaysBefore =
      this.configService.get<number>('NOTIFICATION_DAYS_BEFORE') ?? 7;

    return [...cards].sort(
      compareCardsByUrgency({
        vehicleMileage: vehicle.mileage,
        mileageUnit: vehicle.mileageUnit,
        mileageWarningThresholdKm,
        notificationDaysBefore,
        today: new Date(),
      }),
    );
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

    const doneAtMileage = input.doneAtMileage;

    if (card.intervalMileage !== null && typeof doneAtMileage !== 'number') {
      throw new BadRequestException(
        'doneAtMileage is required when the card has an intervalMileage',
      );
    }

    if (typeof doneAtMileage === 'number' && doneAtMileage < vehicle.mileage) {
      throw new BadRequestException(
        'doneAtMileage cannot be less than the vehicle current mileage',
      );
    }

    const today = new Date();

    if (card.intervalMileage !== null && typeof doneAtMileage === 'number') {
      card.nextDueMileage = doneAtMileage + card.intervalMileage;
    }
    if (card.intervalTimeMonths !== null) {
      card.nextDueDate = addMonths(today, card.intervalTimeMonths);
    }

    const history = await this.dataSource.transaction(async (em) => {
      await this.cardRepository.updateWithSave({
        dataArray: [card],
        entityManager: em,
      });
      const createdHistory = await this.historyRepository.create({
        creationData: {
          maintenanceCardId: id,
          doneAtMileage: doneAtMileage ?? null,
          doneAtDate: today,
          notes: input.notes ?? null,
        },
        entityManager: em,
      });
      await this.backgroundJobRepository.cancelJobsForCard(id, em);
      return createdHistory;
    });

    // Known limitation: recordMileage runs after the transaction commits.
    // A failure here leaves the vehicle mileage stale while the history record persists.
    // Cross-service atomicity requires a saga/outbox pattern (out of scope).
    if (typeof doneAtMileage === 'number') {
      await this.vehicleService.recordMileage({
        id: vehicleId,
        userId,
        mileage: doneAtMileage,
      });
    }

    return history;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { BackgroundJobEntity } from 'src/db/entities/background-job.entity';
import { INotificationService } from 'src/modules/worker/notification-service.interface';
import { EmailService } from './email.service';

@Injectable()
export class NotificationService implements INotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(MaintenanceCardEntity)
    private readonly cardRepository: Repository<MaintenanceCardEntity>,
    private readonly emailService: EmailService,
  ) {}

  async sendUpcomingNotification(
    backgroundJob: BackgroundJobEntity,
  ): Promise<void> {
    const card = await this.getCardWithUserOrThrow(backgroundJob.referenceId!);
    const { user } = card.vehicle;

    await this.emailService.sendEmail({
      to: user.email,
      subject: `Maintenance due soon: ${card.name}`,
      body: [
        `Your ${card.vehicle.brand} ${card.vehicle.model} is due for "${card.name}".`,
        `Due date: ${String(card.nextDueDate).slice(0, 10)}.`,
        `Please schedule your maintenance soon.`,
      ].join(' '),
    });

    this.logger.log(
      `Sent upcoming notification for card ${card.id} to ${user.email}`,
    );
  }

  async sendOverdueNotification(
    backgroundJob: BackgroundJobEntity,
  ): Promise<void> {
    const card = await this.getCardWithUserOrThrow(backgroundJob.referenceId!);
    const { user } = card.vehicle;

    await this.emailService.sendEmail({
      to: user.email,
      subject: `Maintenance overdue: ${card.name}`,
      body: [
        `Your ${card.vehicle.brand} ${card.vehicle.model} has overdue maintenance: "${card.name}".`,
        `This was due on ${String(card.nextDueDate).slice(0, 10)}.`,
        `Please schedule your maintenance as soon as possible.`,
      ].join(' '),
    });

    this.logger.log(
      `Sent overdue notification for card ${card.id} to ${user.email}`,
    );
  }

  private async getCardWithUserOrThrow(
    cardId: string,
  ): Promise<MaintenanceCardEntity> {
    const card = await this.cardRepository.findOne({
      where: { id: cardId },
      relations: ['vehicle', 'vehicle.user'],
      withDeleted: true,
    });

    if (!card) {
      throw new Error(`MaintenanceCard ${cardId} not found`);
    }

    return card;
  }
}

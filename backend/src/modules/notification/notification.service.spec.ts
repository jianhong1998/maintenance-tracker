import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';
import { MaintenanceCardEntity } from 'src/db/entities/maintenance-card.entity';
import { BackgroundJobEntity } from 'src/db/entities/background-job.entity';

const mockEmailService = {
  sendEmail: vi.fn(),
};

const buildCard = (
  overrides: Partial<MaintenanceCardEntity> = {},
): MaintenanceCardEntity =>
  ({
    id: 'card-1',
    name: 'Oil Change',
    nextDueDate: '2026-04-01' as unknown as Date,
    vehicle: {
      id: 'vehicle-1',
      brand: 'Toyota',
      model: 'Corolla',
      user: {
        id: 'user-1',
        email: 'user@example.com',
      },
    },
    ...overrides,
  }) as unknown as MaintenanceCardEntity;

const buildJob = (referenceId: string): BackgroundJobEntity =>
  ({ id: 'job-1', referenceId }) as BackgroundJobEntity;

const mockCardRepo = {
  findOne: vi.fn(),
};

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: EmailService, useValue: mockEmailService },
        {
          provide: getRepositoryToken(MaintenanceCardEntity),
          useValue: mockCardRepo,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('#sendUpcomingNotification', () => {
    it('fetches card with vehicle+user relations and sends upcoming email', async () => {
      const card = buildCard();
      mockCardRepo.findOne.mockResolvedValue(card as never);
      mockEmailService.sendEmail.mockResolvedValue(undefined as never);

      await service.sendUpcomingNotification(buildJob('card-1'));

      expect(mockCardRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'card-1' },
        relations: ['vehicle', 'vehicle.user'],
        withDeleted: true,
      });

      const emailCall = mockEmailService.sendEmail.mock
        .calls[0]?.[0] as unknown as Record<string, unknown>;
      expect(emailCall).toBeDefined();
      expect(emailCall?.to).toBe('user@example.com');
      expect(String(emailCall?.subject)).toContain('Oil Change');
      expect(String(emailCall?.body)).toContain('Toyota');
    });

    it('throws when card is not found', async () => {
      mockCardRepo.findOne.mockResolvedValue(null as never);

      await expect(
        service.sendUpcomingNotification(buildJob('missing-card')),
      ).rejects.toThrow('MaintenanceCard missing-card not found');
    });
  });

  describe('#sendOverdueNotification', () => {
    it('fetches card with vehicle+user relations and sends overdue email', async () => {
      const card = buildCard();
      mockCardRepo.findOne.mockResolvedValue(card as never);
      mockEmailService.sendEmail.mockResolvedValue(undefined as never);

      await service.sendOverdueNotification(buildJob('card-1'));

      const emailCall = mockEmailService.sendEmail.mock
        .calls[0]?.[0] as unknown as Record<string, unknown>;
      expect(emailCall).toBeDefined();
      expect(emailCall?.to).toBe('user@example.com');
      expect(String(emailCall?.subject)).toContain('Oil Change');
      expect(String(emailCall?.body)).toContain('overdue');
    });

    it('throws when card is not found', async () => {
      mockCardRepo.findOne.mockResolvedValue(null as never);

      await expect(
        service.sendOverdueNotification(buildJob('missing-card')),
      ).rejects.toThrow('MaintenanceCard missing-card not found');
    });
  });
});

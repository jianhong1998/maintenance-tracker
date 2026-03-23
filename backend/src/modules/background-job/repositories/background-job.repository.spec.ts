import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  BackgroundJobRepository,
  BACKGROUND_JOB_REFERENCE_TYPES,
  CreateBackgroundJobData,
} from './background-job.repository';
import {
  BackgroundJobEntity,
  BackgroundJobStatus,
} from 'src/db/entities/background-job.entity';

const mockQueryBuilder = {
  insert: vi.fn().mockReturnThis(),
  into: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  orIgnore: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  execute: vi.fn(),
};

const mockTypeOrmRepo = {
  createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
};

describe('BackgroundJobRepository', () => {
  let repository: BackgroundJobRepository;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTypeOrmRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackgroundJobRepository,
        {
          provide: getRepositoryToken(BackgroundJobEntity),
          useValue: mockTypeOrmRepo,
        },
      ],
    }).compile();

    repository = module.get<BackgroundJobRepository>(BackgroundJobRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('#create', () => {
    it('creates and saves a new background job', async () => {
      const now = new Date();
      const creationData: CreateBackgroundJobData = {
        jobType: 'notification.upcoming',
        referenceId: 'card-1',
        referenceType: 'maintenance_card',
        idempotencyKey: 'notification.upcoming:card-1:2026-04-01',
        payload: { cardId: 'card-1' },
        scheduledFrom: now,
        expiresAt: new Date(now.getTime() + 86400000),
      };
      const job = {
        id: 'job-1',
        ...creationData,
      } as unknown as BackgroundJobEntity;

      mockTypeOrmRepo.create.mockReturnValue(job);
      mockTypeOrmRepo.save.mockResolvedValue(job);

      const result = await repository.create({ creationData });

      expect(mockTypeOrmRepo.create).toHaveBeenCalledWith(creationData);
      expect(mockTypeOrmRepo.save).toHaveBeenCalledWith(job);
      expect(result).toEqual(job);
    });
  });

  describe('#insertIfNotExists', () => {
    it('returns inserted row when no conflict', async () => {
      const now = new Date();
      const data: CreateBackgroundJobData = {
        jobType: 'notification.upcoming',
        referenceId: 'card-1',
        referenceType: 'maintenance_card',
        idempotencyKey: 'notification.upcoming:card-1:2026-04-01',
        payload: { cardId: 'card-1' },
        scheduledFrom: now,
        expiresAt: new Date(now.getTime() + 86400000),
      };
      const inserted = {
        id: 'job-1',
        ...data,
      } as unknown as BackgroundJobEntity;
      mockQueryBuilder.execute.mockResolvedValue({ raw: [inserted] });

      const result = await repository.insertIfNotExists(data);

      expect(result).toEqual(inserted);
    });

    it('returns null when conflict fires (job already exists)', async () => {
      const now = new Date();
      const data: CreateBackgroundJobData = {
        jobType: 'notification.upcoming',
        referenceId: 'card-1',
        referenceType: 'maintenance_card',
        idempotencyKey: 'notification.upcoming:card-1:2026-04-01',
        payload: { cardId: 'card-1' },
        scheduledFrom: now,
        expiresAt: new Date(now.getTime() + 86400000),
      };
      mockQueryBuilder.execute.mockResolvedValue({ raw: [] });

      const result = await repository.insertIfNotExists(data);

      expect(result).toBeNull();
    });
  });

  describe('#findPendingForRecovery', () => {
    it('returns jobs eligible for recovery', async () => {
      const jobs = [{ id: 'job-1' }] as BackgroundJobEntity[];
      mockTypeOrmRepo.find.mockResolvedValue(jobs);

      const result = await repository.findPendingForRecovery();

      expect(result).toEqual(jobs);
      expect(mockTypeOrmRepo.find).toHaveBeenCalledOnce();
    });
  });

  describe('#updateStatus', () => {
    it('updates job status by id', async () => {
      mockTypeOrmRepo.update.mockResolvedValue(undefined);

      await repository.updateStatus('job-1', BackgroundJobStatus.PROCESSING);

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        { id: 'job-1' },
        { status: BackgroundJobStatus.PROCESSING },
      );
    });
  });

  describe('#cancelJobsForCard', () => {
    it('sets pending/processing jobs for a card to cancelled', async () => {
      mockTypeOrmRepo.update.mockResolvedValue(undefined);

      await repository.cancelJobsForCard('card-1');

      expect(mockTypeOrmRepo.update).toHaveBeenCalledWith(
        {
          referenceType: BACKGROUND_JOB_REFERENCE_TYPES.maintenanceCard,
          referenceId: 'card-1',
          status: In([
            BackgroundJobStatus.PENDING,
            BackgroundJobStatus.PROCESSING,
          ]),
        },
        { status: BackgroundJobStatus.CANCELLED },
      );
    });

    it('uses entityManager repo when provided', async () => {
      const emRepo = { update: vi.fn().mockResolvedValue(undefined) };
      const entityManager = {
        getRepository: vi.fn().mockReturnValue(emRepo),
      };

      await repository.cancelJobsForCard(
        'card-1',
        entityManager as unknown as import('typeorm').EntityManager,
      );

      expect(entityManager.getRepository).toHaveBeenCalledWith(
        BackgroundJobEntity,
      );
      expect(emRepo.update).toHaveBeenCalled();
      expect(mockTypeOrmRepo.update).not.toHaveBeenCalled();
    });
  });
});

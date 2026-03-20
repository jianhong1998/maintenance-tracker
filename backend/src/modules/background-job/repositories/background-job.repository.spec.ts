import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  BackgroundJobRepository,
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
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  andWhere: vi.fn().mockReturnThis(),
  getMany: vi.fn(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
};

const mockTypeOrmRepo = {
  createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
  create: vi.fn(),
  save: vi.fn(),
};

describe('BackgroundJobRepository', () => {
  let repository: BackgroundJobRepository;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTypeOrmRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.insert.mockReturnThis();
    mockQueryBuilder.into.mockReturnThis();
    mockQueryBuilder.values.mockReturnThis();
    mockQueryBuilder.orIgnore.mockReturnThis();
    mockQueryBuilder.returning.mockReturnThis();
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.from.mockReturnThis();
    mockQueryBuilder.where.mockReturnThis();
    mockQueryBuilder.andWhere.mockReturnThis();
    mockQueryBuilder.update.mockReturnThis();
    mockQueryBuilder.set.mockReturnThis();

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
      mockQueryBuilder.getMany.mockResolvedValue(jobs);

      const result = await repository.findPendingForRecovery();

      expect(result).toEqual(jobs);
    });
  });

  describe('#updateStatus', () => {
    it('updates job status by id', async () => {
      mockQueryBuilder.execute.mockResolvedValue(undefined);

      await repository.updateStatus('job-1', BackgroundJobStatus.PROCESSING);

      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        status: BackgroundJobStatus.PROCESSING,
      });
    });
  });

  describe('#cancelJobsForCard', () => {
    it('sets pending/processing jobs for a card to cancelled', async () => {
      mockQueryBuilder.execute.mockResolvedValue(undefined);

      await repository.cancelJobsForCard('card-1');

      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        status: BackgroundJobStatus.CANCELLED,
      });
    });
  });
});

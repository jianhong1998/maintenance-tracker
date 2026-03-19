import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ConfigController } from './config.controller';

const mockConfigService = {
  get: vi.fn(),
};

describe('ConfigController', () => {
  let controller: ConfigController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigController],
      providers: [{ provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    controller = module.get<ConfigController>(ConfigController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('#getConfig', () => {
    it('returns mileageWarningThresholdKm from env', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MILEAGE_WARNING_THRESHOLD_KM') return 500;
        return undefined;
      });

      const result = controller.getConfig();

      expect(result).toEqual({ mileageWarningThresholdKm: 500 });
    });

    it('falls back to default 500 when MILEAGE_WARNING_THRESHOLD_KM is not set', () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = controller.getConfig();

      expect(result.mileageWarningThresholdKm).toBe(500);
    });
  });
});

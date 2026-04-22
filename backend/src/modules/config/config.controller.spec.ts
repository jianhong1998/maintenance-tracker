import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ConfigController } from './config.controller';
import { EnvironmentVariableUtil } from '../common/utils/environment-variable.util';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

const mockConfigService = {
  get: vi.fn(),
};

const mockEnvironmentVariableUtil = {
  getFeatureFlags: vi.fn(),
};

describe('ConfigController', () => {
  let controller: ConfigController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigController],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: EnvironmentVariableUtil,
          useValue: mockEnvironmentVariableUtil,
        },
      ],
    }).compile();

    controller = module.get<ConfigController>(ConfigController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getConfig is decorated with @Public()', () => {
    const method = Object.getOwnPropertyDescriptor(
      ConfigController.prototype,
      'getConfig',
    )?.value as object;
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, method) as boolean;
    expect(isPublic).toBe(true);
  });

  describe('#getConfig', () => {
    it('returns mileageWarningThresholdKm and notificationDaysBefore from env', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MILEAGE_WARNING_THRESHOLD_KM') return 500;
        if (key === 'NOTIFICATION_DAYS_BEFORE') return 7;
        return undefined;
      });

      const result = controller.getConfig();

      expect(result).toEqual({
        mileageWarningThresholdKm: 500,
        notificationDaysBefore: 7,
      });
    });

    it('falls back to default 500 when MILEAGE_WARNING_THRESHOLD_KM is not set', () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = controller.getConfig();

      expect(result.mileageWarningThresholdKm).toBe(500);
    });

    it('falls back to default 7 when NOTIFICATION_DAYS_BEFORE is not set', () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = controller.getConfig();

      expect(result.notificationDaysBefore).toBe(7);
    });

    it('coerces numeric string env values to numbers (real env vars are always strings)', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MILEAGE_WARNING_THRESHOLD_KM') return '500';
        if (key === 'NOTIFICATION_DAYS_BEFORE') return '7';
        return undefined;
      });

      const result = controller.getConfig();

      expect(result).toEqual({
        mileageWarningThresholdKm: 500,
        notificationDaysBefore: 7,
      });
      expect(typeof result.mileageWarningThresholdKm).toBe('number');
      expect(typeof result.notificationDaysBefore).toBe('number');
    });

    it('falls back to defaults when env values are non-numeric strings', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MILEAGE_WARNING_THRESHOLD_KM') return 'not-a-number';
        if (key === 'NOTIFICATION_DAYS_BEFORE') return '';
        return undefined;
      });

      const result = controller.getConfig();

      expect(result).toEqual({
        mileageWarningThresholdKm: 500,
        notificationDaysBefore: 7,
      });
    });
  });

  it('getFeatureFlag is decorated with @Public()', () => {
    const method = Object.getOwnPropertyDescriptor(
      ConfigController.prototype,
      'getFeatureFlag',
    )?.value as object;
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, method) as boolean;
    expect(isPublic).toBe(true);
  });

  describe('#getFeatureFlag', () => {
    it('returns enableHistory and enableProfile from EnvironmentVariableUtil', () => {
      mockEnvironmentVariableUtil.getFeatureFlags.mockReturnValue({
        enableMockAuth: false,
        enableHistory: true,
        enableProfile: false,
      });

      const result = controller.getFeatureFlag();

      expect(result).toEqual({ enableHistory: true, enableProfile: false });
    });

    it('returns false for both when flags are disabled', () => {
      mockEnvironmentVariableUtil.getFeatureFlags.mockReturnValue({
        enableMockAuth: false,
        enableHistory: false,
        enableProfile: false,
      });

      const result = controller.getFeatureFlag();

      expect(result).toEqual({ enableHistory: false, enableProfile: false });
    });
  });
});

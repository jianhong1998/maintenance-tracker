import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EnvironmentVariableUtil } from './environment-variable.util';

const mockConfigService = {
  get: vi.fn(),
};

describe('EnvironmentVariableUtil', () => {
  let util: EnvironmentVariableUtil;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvironmentVariableUtil,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    util = module.get<EnvironmentVariableUtil>(EnvironmentVariableUtil);
  });

  describe('#getFeatureFlags', () => {
    it('returns enableHistory=true when BACKEND_ENABLE_HISTORY is "true"', () => {
      mockConfigService.get.mockImplementation((key: string, def: string) => {
        if (key === 'BACKEND_ENABLE_HISTORY') return 'true';
        return def ?? 'false';
      });

      expect(util.getFeatureFlags().enableHistory).toBe(true);
    });

    it('returns enableHistory=false when BACKEND_ENABLE_HISTORY is "false"', () => {
      mockConfigService.get.mockImplementation(
        (_key: string, def: string) => def ?? 'false',
      );

      expect(util.getFeatureFlags().enableHistory).toBe(false);
    });

    it('returns enableHistory=false when BACKEND_ENABLE_HISTORY is not set', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(util.getFeatureFlags().enableHistory).toBe(false);
    });

    it('returns enableProfile=true when BACKEND_ENABLE_PROFILE is "true"', () => {
      mockConfigService.get.mockImplementation((key: string, def: string) => {
        if (key === 'BACKEND_ENABLE_PROFILE') return 'true';
        return def ?? 'false';
      });

      expect(util.getFeatureFlags().enableProfile).toBe(true);
    });

    it('returns enableProfile=false when BACKEND_ENABLE_PROFILE is not set', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(util.getFeatureFlags().enableProfile).toBe(false);
    });

    it('returns enableMockAuth=true when BACKEND_ENABLE_MOCK_AUTH is "true"', () => {
      mockConfigService.get.mockImplementation((key: string, def: string) => {
        if (key === 'BACKEND_ENABLE_MOCK_AUTH') return 'true';
        return def ?? 'false';
      });
      expect(util.getFeatureFlags().enableMockAuth).toBe(true);
    });

    it('returns enableMockAuth=false when BACKEND_ENABLE_MOCK_AUTH is not set', () => {
      mockConfigService.get.mockReturnValue(undefined);
      expect(util.getFeatureFlags().enableMockAuth).toBe(false);
    });
  });
});

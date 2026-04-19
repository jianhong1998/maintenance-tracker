import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IAppConfigResDTO, IFeatureFlagResDTO } from '@project/types';
import {
  DEFAULT_MILEAGE_WARNING_THRESHOLD_KM,
  DEFAULT_NOTIFICATION_DAYS_BEFORE,
} from '@project/types';
import { Public } from '../auth/decorators/public.decorator';
import { EnvironmentVariableUtil } from '../common/utils/environment-variable.util';
import { readNumericEnv } from '../common/utils/config-number.util';

@Controller('config')
export class ConfigController {
  constructor(
    private readonly configService: ConfigService,
    private readonly environmentVariableUtil: EnvironmentVariableUtil,
  ) {}

  @Public()
  @Get()
  getConfig(): IAppConfigResDTO {
    return {
      mileageWarningThresholdKm: readNumericEnv({
        configService: this.configService,
        key: 'MILEAGE_WARNING_THRESHOLD_KM',
        fallback: DEFAULT_MILEAGE_WARNING_THRESHOLD_KM,
      }),
      notificationDaysBefore: readNumericEnv({
        configService: this.configService,
        key: 'NOTIFICATION_DAYS_BEFORE',
        fallback: DEFAULT_NOTIFICATION_DAYS_BEFORE,
      }),
    };
  }

  @Public()
  @Get('feature-flag')
  getFeatureFlag(): IFeatureFlagResDTO {
    const { enableHistory, enableProfile } =
      this.environmentVariableUtil.getFeatureFlags();
    return { enableHistory, enableProfile };
  }
}

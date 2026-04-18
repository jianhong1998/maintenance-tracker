import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IAppConfigResDTO, IFeatureFlagResDTO } from '@project/types';
import { Public } from '../auth/decorators/public.decorator';
import { EnvironmentVariableUtil } from '../common/utils/environment-variable.util';

const DEFAULT_MILEAGE_WARNING_THRESHOLD_KM = 500;
const DEFAULT_NOTIFICATION_DAYS_BEFORE = 7;

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
      mileageWarningThresholdKm:
        this.configService.get<number>('MILEAGE_WARNING_THRESHOLD_KM') ??
        DEFAULT_MILEAGE_WARNING_THRESHOLD_KM,
      notificationDaysBefore:
        this.configService.get<number>('NOTIFICATION_DAYS_BEFORE') ??
        DEFAULT_NOTIFICATION_DAYS_BEFORE,
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

import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IAppConfigResDTO } from '@project/types';
import { Public } from '../auth/decorators/public.decorator';

const DEFAULT_MILEAGE_WARNING_THRESHOLD_KM = 500;

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Public()
  @Get()
  getConfig(): IAppConfigResDTO {
    return {
      mileageWarningThresholdKm:
        this.configService.get<number>('MILEAGE_WARNING_THRESHOLD_KM') ??
        DEFAULT_MILEAGE_WARNING_THRESHOLD_KM,
    };
  }
}

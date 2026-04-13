import { Controller, Get } from '@nestjs/common';
import { AppService } from '../services/app.service';
import { HealthCheckResDTO } from '../dtos/health-check.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello() {
    const result = this.appService.healthCheck();
    return new HealthCheckResDTO(result);
  }
}

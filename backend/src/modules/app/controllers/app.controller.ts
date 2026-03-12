import { Controller, Get } from '@nestjs/common';
import { AppService } from '../services/app.service';
import { HealthCheckResDTO } from '../dtos/health-check.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello() {
    const result = this.appService.healthCheck();
    return new HealthCheckResDTO(result);
  }
}

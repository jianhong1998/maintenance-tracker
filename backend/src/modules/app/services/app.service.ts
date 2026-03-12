import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  healthCheck(): { isHealthy: boolean } {
    return { isHealthy: true };
  }
}

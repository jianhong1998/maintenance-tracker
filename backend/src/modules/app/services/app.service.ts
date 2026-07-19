import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  healthCheck(): { isHealthy: boolean } {
    return { isHealthy: true };
  }

  getVersion(): { version: string } {
    return { version: process.env.BACKEND_APP_VERSION ?? 'unreleased' };
  }
}

import { IHealthCheckResDTO } from '@project/types';

export class HealthCheckResDTO implements IHealthCheckResDTO {
  public isHealthy: boolean;
  public timestamp: string;

  constructor(params: { isHealthy: boolean }) {
    this.isHealthy = params.isHealthy;
    this.timestamp = new Date().toISOString();
  }
}

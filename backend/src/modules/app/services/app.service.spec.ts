import { AppService } from './app.service';

describe('#healthCheck', () => {
  it('should return health check object', () => {
    const appService = new AppService();
    const result = appService.healthCheck();

    expect(result).toEqual({ isHealthy: true });
  });
});

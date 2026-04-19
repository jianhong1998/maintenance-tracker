import axiosInstance from '../config/axios';
import { IAppConfigResDTO, IHealthCheckResDTO } from '@project/types';

describe('#Health Check', () => {
  it('should return status 200 without auth token', async () => {
    const result = await axiosInstance.get('/');

    expect(result.status).toBe(200);
  });

  it('should response with expected schema in payload without auth token', async () => {
    const result = await axiosInstance.get('/');

    expect(result.data).toMatchObject({
      isHealthy: true,
      timestamp: expect.any(String) as string,
    } as IHealthCheckResDTO);
  });
});

describe('GET /config', () => {
  it('returns mileageWarningThresholdKm and notificationDaysBefore as numbers', async () => {
    const { data, status } =
      await axiosInstance.get<IAppConfigResDTO>('/config');
    expect(status).toBe(200);
    expect(typeof data.mileageWarningThresholdKm).toBe('number');
    expect(typeof data.notificationDaysBefore).toBe('number');
  });
});

import axiosInstance from '../config/axios';
import { IHealthCheckResDTO } from '@project/types';

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

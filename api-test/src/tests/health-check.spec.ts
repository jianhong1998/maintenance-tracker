import axiosInstance from '../config/axios';
import { IHealthCheckResDTO } from '@project/types';

const authHeaders = { headers: { Authorization: 'Bearer api-test-token' } };

describe('#Health Check', () => {
  it('should return status 200', async () => {
    const result = await axiosInstance.get('/', authHeaders);

    expect(result.status).toBe(200);
  });

  it('should response with expected schema in payload', async () => {
    const result = await axiosInstance.get('/', authHeaders);

    expect(result.data).toMatchObject({
      isHealthy: true,
      timestamp: expect.any(String) as string,
    } as IHealthCheckResDTO);
  });

  it('returns 401 when no auth token is provided', async () => {
    await expect(axiosInstance.get('/')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });
});

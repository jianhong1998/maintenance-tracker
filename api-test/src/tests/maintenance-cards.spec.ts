import axiosInstance from '../config/axios';
import type { IVehicleResDTO, IMaintenanceCardResDTO } from '@project/types';

const API_TEST_TOKEN = 'Bearer api-test-token';

function authHeaders() {
  return { headers: { Authorization: API_TEST_TOKEN } };
}

const baseVehiclePayload = {
  brand: 'Yamaha',
  model: 'NMax',
  colour: 'Blue',
  mileage: 3000,
  mileageUnit: 'km',
};

describe('#MaintenanceCards', () => {
  let vehicleId: string;

  beforeEach(async () => {
    const res = await axiosInstance.post<IVehicleResDTO>(
      '/vehicles',
      baseVehiclePayload,
      authHeaders(),
    );
    vehicleId = res.data.id;
  });

  afterEach(async () => {
    await axiosInstance
      .delete(`/vehicles/${vehicleId}`, authHeaders())
      .catch(() => undefined);
  });

  // ─── POST ─────────────────────────────────────────────────────────────────

  describe('POST /vehicles/:vehicleId/maintenance-cards', () => {
    it('returns 201 with the created card (HTTP 201 status fix)', async () => {
      const res = await axiosInstance.post<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards`,
        { type: 'task', name: 'Oil Change', intervalMileage: 5000 },
        authHeaders(),
      );

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        id: expect.any(String) as string,
        vehicleId,
        type: 'task',
        name: 'Oil Change',
        intervalMileage: 5000,
        intervalTimeMonths: null,
        description: null,
        nextDueMileage: null,
        nextDueDate: null,
        createdAt: expect.any(String) as string,
        updatedAt: expect.any(String) as string,
      } as IMaintenanceCardResDTO);
    });

    it('returns 201 with intervalTimeMonths only', async () => {
      const res = await axiosInstance.post<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards`,
        { type: 'part', name: 'Air Filter', intervalTimeMonths: 12 },
        authHeaders(),
      );

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        intervalMileage: null,
        intervalTimeMonths: 12,
      });
    });

    it('returns 201 with both intervals and description', async () => {
      const res = await axiosInstance.post<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards`,
        {
          type: 'item',
          name: 'Brake Pads',
          intervalMileage: 20000,
          intervalTimeMonths: 24,
          description: 'Replace both front and rear',
        },
        authHeaders(),
      );

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        intervalMileage: 20000,
        intervalTimeMonths: 24,
        description: 'Replace both front and rear',
      });
    });

    it('intervalMileage is returned as a JS number, not a decimal string (column type fix)', async () => {
      const res = await axiosInstance.post<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards`,
        { type: 'task', name: 'Chain Lube', intervalMileage: 1000 },
        authHeaders(),
      );

      expect(res.status).toBe(201);
      expect(res.data.intervalMileage).toBe(1000);
      expect(typeof res.data.intervalMileage).toBe('number');
    });

    it('nextDueDate is null for a newly created card and createdAt is ISO string', async () => {
      const res = await axiosInstance.post<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards`,
        { type: 'task', name: 'Clutch Check', intervalMileage: 30000 },
        authHeaders(),
      );

      expect(res.data.nextDueDate).toBeNull();
      // createdAt must be a valid ISO 8601 timestamp
      expect(() => new Date(res.data.createdAt)).not.toThrow();
    });

    it('returns 400 when neither interval field is provided', async () => {
      await expect(
        axiosInstance.post(
          `/vehicles/${vehicleId}/maintenance-cards`,
          { type: 'task', name: 'Tyre Check' },
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 400 when intervalMileage is a decimal (must be integer)', async () => {
      await expect(
        axiosInstance.post(
          `/vehicles/${vehicleId}/maintenance-cards`,
          { type: 'task', name: 'Coolant', intervalMileage: 5000.5 },
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 400 when intervalMileage is 0 (minimum is 1)', async () => {
      await expect(
        axiosInstance.post(
          `/vehicles/${vehicleId}/maintenance-cards`,
          { type: 'task', name: 'Coolant', intervalMileage: 0 },
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 400 when intervalTimeMonths is a decimal', async () => {
      await expect(
        axiosInstance.post(
          `/vehicles/${vehicleId}/maintenance-cards`,
          { type: 'task', name: 'Coolant', intervalTimeMonths: 1.5 },
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 400 when type is invalid', async () => {
      await expect(
        axiosInstance.post(
          `/vehicles/${vehicleId}/maintenance-cards`,
          { type: 'invalid', name: 'Test', intervalMileage: 1000 },
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 400 when name is empty', async () => {
      await expect(
        axiosInstance.post(
          `/vehicles/${vehicleId}/maintenance-cards`,
          { type: 'task', name: '', intervalMileage: 1000 },
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 404 when vehicle does not exist', async () => {
      const nonExistentVehicleId = '01960000-0000-7000-8000-000000000002';
      await expect(
        axiosInstance.post(
          `/vehicles/${nonExistentVehicleId}/maintenance-cards`,
          { type: 'task', name: 'Oil Change', intervalMileage: 5000 },
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 404 } });
    });

    it('returns 401 when no auth token is provided', async () => {
      await expect(
        axiosInstance.post(`/vehicles/${vehicleId}/maintenance-cards`, {
          type: 'task',
          name: 'Oil Change',
          intervalMileage: 5000,
        }),
      ).rejects.toMatchObject({ response: { status: 401 } });
    });
  });

  // ─── GET list ─────────────────────────────────────────────────────────────

  describe('GET /vehicles/:vehicleId/maintenance-cards', () => {
    let cardId: string;

    beforeEach(async () => {
      const res = await axiosInstance.post<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards`,
        { type: 'task', name: 'Oil Change', intervalMileage: 5000 },
        authHeaders(),
      );
      cardId = res.data.id;
    });

    it('returns 200 with an array of cards', async () => {
      const res = await axiosInstance.get<IMaintenanceCardResDTO[]>(
        `/vehicles/${vehicleId}/maintenance-cards`,
        authHeaders(),
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      const found = res.data.find((c) => c.id === cardId);
      expect(found).toBeDefined();
    });

    it('returns cards sorted alphabetically when sort=name', async () => {
      await axiosInstance.post(
        `/vehicles/${vehicleId}/maintenance-cards`,
        { type: 'task', name: 'Air Filter', intervalMileage: 10000 },
        authHeaders(),
      );

      const res = await axiosInstance.get<IMaintenanceCardResDTO[]>(
        `/vehicles/${vehicleId}/maintenance-cards?sort=name`,
        authHeaders(),
      );

      const names = res.data.map((c) => c.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it('returns 200 array when sort=urgency (urgency sort smoke test)', async () => {
      const res = await axiosInstance.get<IMaintenanceCardResDTO[]>(
        `/vehicles/${vehicleId}/maintenance-cards?sort=urgency`,
        authHeaders(),
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('returns 200 with empty array when vehicle has no cards', async () => {
      const emptyVehicleRes = await axiosInstance.post<IVehicleResDTO>(
        '/vehicles',
        { ...baseVehiclePayload, model: 'CBR' },
        authHeaders(),
      );
      const emptyVehicleId = emptyVehicleRes.data.id;

      try {
        const res = await axiosInstance.get<IMaintenanceCardResDTO[]>(
          `/vehicles/${emptyVehicleId}/maintenance-cards`,
          authHeaders(),
        );

        expect(res.status).toBe(200);
        expect(res.data).toEqual([]);
      } finally {
        await axiosInstance
          .delete(`/vehicles/${emptyVehicleId}`, authHeaders())
          .catch(() => undefined);
      }
    });

    it('returns 404 when vehicle does not exist', async () => {
      const nonExistentVehicleId = '01960000-0000-7000-8000-000000000003';
      await expect(
        axiosInstance.get(
          `/vehicles/${nonExistentVehicleId}/maintenance-cards`,
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 404 } });
    });

    it('returns 401 when no auth token is provided', async () => {
      await expect(
        axiosInstance.get(`/vehicles/${vehicleId}/maintenance-cards`),
      ).rejects.toMatchObject({ response: { status: 401 } });
    });
  });

  // ─── GET single ───────────────────────────────────────────────────────────

  describe('GET /vehicles/:vehicleId/maintenance-cards/:id', () => {
    let cardId: string;

    beforeEach(async () => {
      const res = await axiosInstance.post<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards`,
        { type: 'task', name: 'Spark Plug', intervalTimeMonths: 6 },
        authHeaders(),
      );
      cardId = res.data.id;
    });

    it('returns 200 with the full card shape', async () => {
      const res = await axiosInstance.get<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
        authHeaders(),
      );

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        id: cardId,
        vehicleId,
        name: 'Spark Plug',
        type: 'task',
        intervalTimeMonths: 6,
        intervalMileage: null,
        nextDueDate: null,
        nextDueMileage: null,
      } as Partial<IMaintenanceCardResDTO>);
    });

    // nextDueDate date-only format (YYYY-MM-DD) is validated here for the null
    // branch. The non-null branch requires a "log maintenance" endpoint (future
    // feature) to set nextDueDate, so it is not tested here.
    it('returns nextDueDate as null when not yet set', async () => {
      const res = await axiosInstance.get<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
        authHeaders(),
      );

      expect(res.data.nextDueDate).toBeNull();
    });

    it('returns 404 when card does not exist', async () => {
      const nonExistentCardId = '01960000-0000-7000-8000-000000000004';
      await expect(
        axiosInstance.get(
          `/vehicles/${vehicleId}/maintenance-cards/${nonExistentCardId}`,
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 404 } });
    });

    it('returns 400 when card id is not a valid UUID', async () => {
      await expect(
        axiosInstance.get(
          `/vehicles/${vehicleId}/maintenance-cards/not-a-uuid`,
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 404 when card belongs to a different vehicle', async () => {
      const otherVehicleRes = await axiosInstance.post<IVehicleResDTO>(
        '/vehicles',
        { ...baseVehiclePayload, model: 'MT-07' },
        authHeaders(),
      );
      const otherVehicleId = otherVehicleRes.data.id;

      try {
        await expect(
          axiosInstance.get(
            `/vehicles/${otherVehicleId}/maintenance-cards/${cardId}`,
            authHeaders(),
          ),
        ).rejects.toMatchObject({ response: { status: 404 } });
      } finally {
        await axiosInstance
          .delete(`/vehicles/${otherVehicleId}`, authHeaders())
          .catch(() => undefined);
      }
    });

    it('returns 401 when no auth token is provided', async () => {
      await expect(
        axiosInstance.get(`/vehicles/${vehicleId}/maintenance-cards/${cardId}`),
      ).rejects.toMatchObject({ response: { status: 401 } });
    });
  });

  // ─── PATCH ────────────────────────────────────────────────────────────────

  describe('PATCH /vehicles/:vehicleId/maintenance-cards/:id', () => {
    let cardId: string;

    beforeEach(async () => {
      const res = await axiosInstance.post<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards`,
        { type: 'task', name: 'Coolant Top-up', intervalMileage: 8000 },
        authHeaders(),
      );
      cardId = res.data.id;
    });

    it('returns 200 with updated fields', async () => {
      const res = await axiosInstance.patch<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
        { name: 'Coolant Flush', intervalMileage: 10000 },
        authHeaders(),
      );

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({
        name: 'Coolant Flush',
        intervalMileage: 10000,
      });
    });

    it('allows setting intervalTimeMonths on a mileage-only card', async () => {
      const res = await axiosInstance.patch<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
        { intervalTimeMonths: 6 },
        authHeaders(),
      );

      expect(res.status).toBe(200);
      expect(res.data.intervalTimeMonths).toBe(6);
      expect(res.data.intervalMileage).toBe(8000);
    });

    it('allows clearing intervalMileage when intervalTimeMonths is already set', async () => {
      await axiosInstance.patch(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
        { intervalTimeMonths: 12 },
        authHeaders(),
      );

      const res = await axiosInstance.patch<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
        { intervalMileage: null },
        authHeaders(),
      );

      expect(res.status).toBe(200);
      expect(res.data.intervalMileage).toBeNull();
      expect(res.data.intervalTimeMonths).toBe(12);
    });

    it('returns 400 when clearing the only remaining interval', async () => {
      // Card only has intervalMileage; clearing it leaves no interval
      await expect(
        axiosInstance.patch(
          `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
          { intervalMileage: null },
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 400 when intervalMileage is a decimal', async () => {
      await expect(
        axiosInstance.patch(
          `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
          { intervalMileage: 999.9 },
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 400 when name is set to empty string', async () => {
      await expect(
        axiosInstance.patch(
          `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
          { name: '' },
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 400 when type is invalid', async () => {
      await expect(
        axiosInstance.patch(
          `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
          { type: 'unknown' },
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 404 when card does not exist', async () => {
      const nonExistentCardId = '01960000-0000-7000-8000-000000000005';
      await expect(
        axiosInstance.patch(
          `/vehicles/${vehicleId}/maintenance-cards/${nonExistentCardId}`,
          { name: 'Updated' },
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 404 } });
    });

    it('returns 401 when no auth token is provided', async () => {
      await expect(
        axiosInstance.patch(
          `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
          { name: 'Updated' },
        ),
      ).rejects.toMatchObject({ response: { status: 401 } });
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────────────

  describe('DELETE /vehicles/:vehicleId/maintenance-cards/:id', () => {
    let cardId: string;

    beforeEach(async () => {
      const res = await axiosInstance.post<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards`,
        { type: 'task', name: 'Tyre Rotation', intervalMileage: 10000 },
        authHeaders(),
      );
      cardId = res.data.id;
    });

    it('returns 204 on successful deletion', async () => {
      const res = await axiosInstance.delete(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
        authHeaders(),
      );

      expect(res.status).toBe(204);
    });

    it('returns 404 after the card has been deleted', async () => {
      await axiosInstance.delete(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
        authHeaders(),
      );

      await expect(
        axiosInstance.get(
          `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 404 } });
    });

    it('returns 404 when card does not exist', async () => {
      await axiosInstance.delete(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
        authHeaders(),
      );

      await expect(
        axiosInstance.delete(
          `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
          authHeaders(),
        ),
      ).rejects.toMatchObject({ response: { status: 404 } });
    });

    it('returns 401 when no auth token is provided', async () => {
      await expect(
        axiosInstance.delete(
          `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
        ),
      ).rejects.toMatchObject({ response: { status: 401 } });
    });
  });
});

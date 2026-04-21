import axiosInstance from '../config/axios';
import type { IVehicleResDTO, IMaintenanceCardResDTO } from '@project/types';
import { createTestUser, authHeaders, type TestUser } from '../helpers/auth';

let user: TestUser;

beforeAll(async () => {
  user = await createTestUser();
});

const baseVehiclePayload = {
  brand: 'Honda',
  model: 'PCX',
  colour: 'White',
  mileage: 5000,
  mileageUnit: 'km',
};

describe('#Vehicles', () => {
  describe('POST /vehicles', () => {
    it('returns 201 with the created vehicle', async () => {
      const res = await axiosInstance.post<IVehicleResDTO>(
        '/vehicles',
        baseVehiclePayload,
        authHeaders(user),
      );

      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({
        id: expect.any(String) as string,
        brand: 'Honda',
        model: 'PCX',
        colour: 'White',
        mileage: 5000,
        mileageUnit: 'km',
        createdAt: expect.any(String) as string,
        updatedAt: expect.any(String) as string,
      } as IVehicleResDTO);
    });

    it('returns 401 when no auth token is provided', async () => {
      await expect(
        axiosInstance.post('/vehicles', baseVehiclePayload),
      ).rejects.toMatchObject({ response: { status: 401 } });
    });

    it('returns 400 when required fields are missing', async () => {
      await expect(
        axiosInstance.post('/vehicles', { brand: 'Honda' }, authHeaders(user)),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 400 when mileageUnit is invalid', async () => {
      await expect(
        axiosInstance.post(
          '/vehicles',
          { ...baseVehiclePayload, mileageUnit: 'invalid' },
          authHeaders(user),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 201 with registrationNumber when provided', async () => {
      const res = await axiosInstance.post<IVehicleResDTO>(
        '/vehicles',
        { ...baseVehiclePayload, registrationNumber: 'ABC-1234' },
        authHeaders(user),
      );

      expect(res.status).toBe(201);
      expect(res.data.registrationNumber).toBe('ABC-1234');

      await axiosInstance
        .delete(`/vehicles/${res.data.id}`, authHeaders(user))
        .catch(() => undefined);
    });

    it('returns 201 with registrationNumber null when not provided', async () => {
      const res = await axiosInstance.post<IVehicleResDTO>(
        '/vehicles',
        baseVehiclePayload,
        authHeaders(user),
      );

      expect(res.status).toBe(201);
      expect(res.data.registrationNumber).toBeNull();

      await axiosInstance
        .delete(`/vehicles/${res.data.id}`, authHeaders(user))
        .catch(() => undefined);
    });

    it('returns 400 when registrationNumber exceeds 15 characters', async () => {
      await expect(
        axiosInstance.post(
          '/vehicles',
          {
            ...baseVehiclePayload,
            registrationNumber: 'TOOLONGREGPLATE' + 'X',
          },
          authHeaders(user),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });
  });

  describe('GET /vehicles', () => {
    let vehicleId: string;

    beforeEach(async () => {
      const res = await axiosInstance.post<IVehicleResDTO>(
        '/vehicles',
        baseVehiclePayload,
        authHeaders(user),
      );
      vehicleId = res.data.id;
    });

    afterEach(async () => {
      await axiosInstance
        .delete(`/vehicles/${vehicleId}`, authHeaders(user))
        .catch(() => undefined);
    });

    it('returns 200 with an array of vehicles', async () => {
      const res = await axiosInstance.get<IVehicleResDTO[]>(
        '/vehicles',
        authHeaders(user),
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      const found = res.data.find((v) => v.id === vehicleId);
      expect(found).toBeDefined();
    });

    it('returns 401 when no auth token is provided', async () => {
      await expect(axiosInstance.get('/vehicles')).rejects.toMatchObject({
        response: { status: 401 },
      });
    });
  });

  describe('GET /vehicles/:id', () => {
    let vehicleId: string;

    beforeEach(async () => {
      const res = await axiosInstance.post<IVehicleResDTO>(
        '/vehicles',
        baseVehiclePayload,
        authHeaders(user),
      );
      vehicleId = res.data.id;
    });

    afterEach(async () => {
      await axiosInstance
        .delete(`/vehicles/${vehicleId}`, authHeaders(user))
        .catch(() => undefined);
    });

    it('returns 200 with the vehicle', async () => {
      const res = await axiosInstance.get<IVehicleResDTO>(
        `/vehicles/${vehicleId}`,
        authHeaders(user),
      );

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ id: vehicleId, brand: 'Honda' });
    });

    it('returns 404 when vehicle does not exist', async () => {
      const nonExistentId = '01960000-0000-7000-8000-000000000000';
      await expect(
        axiosInstance.get(`/vehicles/${nonExistentId}`, authHeaders(user)),
      ).rejects.toMatchObject({ response: { status: 404 } });
    });

    it('returns 400 when id is not a valid UUID', async () => {
      await expect(
        axiosInstance.get('/vehicles/not-a-uuid', authHeaders(user)),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 401 when no auth token is provided', async () => {
      await expect(
        axiosInstance.get(`/vehicles/${vehicleId}`),
      ).rejects.toMatchObject({ response: { status: 401 } });
    });

    it('returns registrationNumber as null when not set at creation', async () => {
      const res = await axiosInstance.get<IVehicleResDTO>(
        `/vehicles/${vehicleId}`,
        authHeaders(user),
      );

      expect(res.status).toBe(200);
      expect(res.data.registrationNumber).toBeNull();
    });

    it('returns registrationNumber when it was set at creation', async () => {
      const createRes = await axiosInstance.post<IVehicleResDTO>(
        '/vehicles',
        { ...baseVehiclePayload, registrationNumber: 'XYZ-9999' },
        authHeaders(user),
      );
      const idWithReg = createRes.data.id;

      const res = await axiosInstance.get<IVehicleResDTO>(
        `/vehicles/${idWithReg}`,
        authHeaders(user),
      );

      expect(res.status).toBe(200);
      expect(res.data.registrationNumber).toBe('XYZ-9999');

      await axiosInstance
        .delete(`/vehicles/${idWithReg}`, authHeaders(user))
        .catch(() => undefined);
    });
  });

  describe('PATCH /vehicles/:id', () => {
    let vehicleId: string;

    beforeEach(async () => {
      const res = await axiosInstance.post<IVehicleResDTO>(
        '/vehicles',
        baseVehiclePayload,
        authHeaders(user),
      );
      vehicleId = res.data.id;
    });

    afterEach(async () => {
      await axiosInstance
        .delete(`/vehicles/${vehicleId}`, authHeaders(user))
        .catch(() => undefined);
    });

    it('returns 200 with the updated vehicle', async () => {
      const res = await axiosInstance.patch<IVehicleResDTO>(
        `/vehicles/${vehicleId}`,
        { colour: 'Black', mileage: 10000 },
        authHeaders(user),
      );

      expect(res.status).toBe(200);
      expect(res.data).toMatchObject({ colour: 'Black', mileage: 10000 });
    });

    it('returns 404 when vehicle does not exist', async () => {
      const nonExistentId = '01960000-0000-7000-8000-000000000001';
      await expect(
        axiosInstance.patch(
          `/vehicles/${nonExistentId}`,
          { colour: 'Red' },
          authHeaders(user),
        ),
      ).rejects.toMatchObject({ response: { status: 404 } });
    });

    it('returns 400 when mileageUnit is invalid', async () => {
      await expect(
        axiosInstance.patch(
          `/vehicles/${vehicleId}`,
          { mileageUnit: 'feet' },
          authHeaders(user),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });

    it('returns 401 when no auth token is provided', async () => {
      await expect(
        axiosInstance.patch(`/vehicles/${vehicleId}`, { colour: 'Black' }),
      ).rejects.toMatchObject({ response: { status: 401 } });
    });

    it('returns 200 with updated registrationNumber', async () => {
      const res = await axiosInstance.patch<IVehicleResDTO>(
        `/vehicles/${vehicleId}`,
        { registrationNumber: 'NEW-REG-01' },
        authHeaders(user),
      );

      expect(res.status).toBe(200);
      expect(res.data.registrationNumber).toBe('NEW-REG-01');
    });

    it('returns 200 and clears registrationNumber when patched to null', async () => {
      // First set a value
      const setRes = await axiosInstance.patch<IVehicleResDTO>(
        `/vehicles/${vehicleId}`,
        { registrationNumber: 'TEMP-REG' },
        authHeaders(user),
      );
      expect(setRes.data.registrationNumber).toBe('TEMP-REG');

      // Then clear it
      const res = await axiosInstance.patch<IVehicleResDTO>(
        `/vehicles/${vehicleId}`,
        { registrationNumber: null },
        authHeaders(user),
      );

      expect(res.status).toBe(200);
      expect(res.data.registrationNumber).toBeNull();
    });

    it('returns 400 when registrationNumber exceeds 15 characters', async () => {
      await expect(
        axiosInstance.patch(
          `/vehicles/${vehicleId}`,
          { registrationNumber: 'TOOLONGREGPLATE' + 'X' },
          authHeaders(user),
        ),
      ).rejects.toMatchObject({ response: { status: 400 } });
    });
  });

  describe('DELETE /vehicles/:id', () => {
    let vehicleId: string;

    beforeEach(async () => {
      const res = await axiosInstance.post<IVehicleResDTO>(
        '/vehicles',
        baseVehiclePayload,
        authHeaders(user),
      );
      vehicleId = res.data.id;
    });

    it('returns 204 on successful deletion', async () => {
      const res = await axiosInstance.delete(
        `/vehicles/${vehicleId}`,
        authHeaders(user),
      );
      expect(res.status).toBe(204);
    });

    it('returns 404 after the vehicle has been deleted', async () => {
      await axiosInstance.delete(`/vehicles/${vehicleId}`, authHeaders(user));

      await expect(
        axiosInstance.get(`/vehicles/${vehicleId}`, authHeaders(user)),
      ).rejects.toMatchObject({ response: { status: 404 } });
    });

    it('soft-deletes all maintenance cards when vehicle is deleted (cascade)', async () => {
      // Create a card for the vehicle
      await axiosInstance.post<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards`,
        { type: 'task', name: 'Oil Change', intervalMileage: 5000 },
        authHeaders(user),
      );

      // Delete the vehicle
      await axiosInstance.delete(`/vehicles/${vehicleId}`, authHeaders(user));

      // The vehicle no longer exists, so any card request should return 404
      await expect(
        axiosInstance.get(
          `/vehicles/${vehicleId}/maintenance-cards`,
          authHeaders(user),
        ),
      ).rejects.toMatchObject({ response: { status: 404 } });
    });

    it('returns 404 when vehicle does not exist', async () => {
      // Clean up first so we have a real non-existent id scenario
      await axiosInstance.delete(`/vehicles/${vehicleId}`, authHeaders(user));

      await expect(
        axiosInstance.delete(`/vehicles/${vehicleId}`, authHeaders(user)),
      ).rejects.toMatchObject({ response: { status: 404 } });
    });

    it('returns 401 when no auth token is provided', async () => {
      await expect(
        axiosInstance.delete(`/vehicles/${vehicleId}`),
      ).rejects.toMatchObject({ response: { status: 401 } });

      // Clean up
      await axiosInstance
        .delete(`/vehicles/${vehicleId}`, authHeaders(user))
        .catch(() => undefined);
    });
  });
});

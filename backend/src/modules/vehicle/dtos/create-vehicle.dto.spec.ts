import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { CreateVehicleDto } from './create-vehicle.dto';

const validPayload = {
  brand: 'Honda',
  model: 'PCX',
  colour: 'White',
  mileage: 1000,
  mileageUnit: 'km',
};

describe('CreateVehicleDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(CreateVehicleDto, validPayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  describe('mileageUnit', () => {
    it('rejects a numeric value for mileageUnit', async () => {
      const dto = plainToInstance(CreateVehicleDto, {
        ...validPayload,
        mileageUnit: 123,
      });
      const errors = await validate(dto);
      const mileageUnitErrors = errors.find(
        (e) => e.property === 'mileageUnit',
      );
      expect(mileageUnitErrors).toBeDefined();
    });

    it('rejects an invalid string mileageUnit', async () => {
      const dto = plainToInstance(CreateVehicleDto, {
        ...validPayload,
        mileageUnit: 'gallons',
      });
      const errors = await validate(dto);
      const mileageUnitErrors = errors.find(
        (e) => e.property === 'mileageUnit',
      );
      expect(mileageUnitErrors).toBeDefined();
    });

    it('accepts a valid string mileageUnit', async () => {
      const dto = plainToInstance(CreateVehicleDto, validPayload);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('mileage', () => {
    it('rejects a negative mileage', async () => {
      const dto = plainToInstance(CreateVehicleDto, {
        ...validPayload,
        mileage: -1,
      });
      const errors = await validate(dto);
      const mileageErrors = errors.find((e) => e.property === 'mileage');
      expect(mileageErrors).toBeDefined();
    });

    it('rejects a value above 1_000_000', async () => {
      const dto = plainToInstance(CreateVehicleDto, {
        ...validPayload,
        mileage: 1_000_001,
      });
      const errors = await validate(dto);
      const mileageErrors = errors.find((e) => e.property === 'mileage');
      expect(mileageErrors).toBeDefined();
    });

    it('accepts zero mileage', async () => {
      const dto = plainToInstance(CreateVehicleDto, {
        ...validPayload,
        mileage: 0,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('brand', () => {
    it('rejects an empty string brand', async () => {
      const dto = plainToInstance(CreateVehicleDto, {
        ...validPayload,
        brand: '',
      });
      const errors = await validate(dto);
      const brandErrors = errors.find((e) => e.property === 'brand');
      expect(brandErrors).toBeDefined();
    });

    it('rejects a missing brand', async () => {
      const { brand: _brand, ...withoutBrand } = validPayload;
      const dto = plainToInstance(CreateVehicleDto, withoutBrand);
      const errors = await validate(dto);
      const brandErrors = errors.find((e) => e.property === 'brand');
      expect(brandErrors).toBeDefined();
    });
  });

  describe('model', () => {
    it('rejects an empty string model', async () => {
      const dto = plainToInstance(CreateVehicleDto, {
        ...validPayload,
        model: '',
      });
      const errors = await validate(dto);
      const modelErrors = errors.find((e) => e.property === 'model');
      expect(modelErrors).toBeDefined();
    });

    it('rejects a missing model', async () => {
      const { model: _model, ...withoutModel } = validPayload;
      const dto = plainToInstance(CreateVehicleDto, withoutModel);
      const errors = await validate(dto);
      const modelErrors = errors.find((e) => e.property === 'model');
      expect(modelErrors).toBeDefined();
    });
  });

  describe('colour', () => {
    it('rejects an empty string colour', async () => {
      const dto = plainToInstance(CreateVehicleDto, {
        ...validPayload,
        colour: '',
      });
      const errors = await validate(dto);
      const colourErrors = errors.find((e) => e.property === 'colour');
      expect(colourErrors).toBeDefined();
    });

    it('rejects a missing colour', async () => {
      const { colour: _colour, ...withoutColour } = validPayload;
      const dto = plainToInstance(CreateVehicleDto, withoutColour);
      const errors = await validate(dto);
      const colourErrors = errors.find((e) => e.property === 'colour');
      expect(colourErrors).toBeDefined();
    });
  });

  describe('registrationNumber', () => {
    it('accepts a payload without registrationNumber (field is optional)', async () => {
      const dto = plainToInstance(CreateVehicleDto, validPayload);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts a valid registrationNumber string', async () => {
      const dto = plainToInstance(CreateVehicleDto, {
        ...validPayload,
        registrationNumber: 'FBA1234Z',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects a registrationNumber exceeding 15 characters', async () => {
      const dto = plainToInstance(CreateVehicleDto, {
        ...validPayload,
        registrationNumber: 'A'.repeat(16),
      });
      const errors = await validate(dto);
      const regErrors = errors.find((e) => e.property === 'registrationNumber');
      expect(regErrors).toBeDefined();
    });

    it('accepts a registrationNumber of exactly 15 characters', async () => {
      const dto = plainToInstance(CreateVehicleDto, {
        ...validPayload,
        registrationNumber: 'A'.repeat(15),
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects an empty string registrationNumber', async () => {
      const dto = plainToInstance(CreateVehicleDto, {
        ...validPayload,
        registrationNumber: '',
      });
      const errors = await validate(dto);
      const regErrors = errors.find((e) => e.property === 'registrationNumber');
      expect(regErrors).toBeDefined();
    });
  });
});

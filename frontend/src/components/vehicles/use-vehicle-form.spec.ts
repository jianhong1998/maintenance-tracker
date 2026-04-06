import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { IVehicleResDTO } from '@project/types';

vi.mock('@/hooks/mutations/vehicles/useCreateVehicle', () => ({
  useCreateVehicle: vi.fn(),
}));
vi.mock('@/hooks/mutations/vehicles/usePatchVehicle', () => ({
  usePatchVehicle: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useCreateVehicle } from '@/hooks/mutations/vehicles/useCreateVehicle';
import { usePatchVehicle } from '@/hooks/mutations/vehicles/usePatchVehicle';
import { toast } from 'sonner';
import { useVehicleForm } from './use-vehicle-form';

const mockCreateMutate = vi.fn();
const mockPatchMutate = vi.fn();

const mockVehicle: IVehicleResDTO = {
  id: 'v1',
  brand: 'Toyota',
  model: 'Corolla',
  colour: 'Silver',
  mileage: 85000,
  mileageUnit: 'km',
  mileageLastUpdatedAt: null,
  registrationNumber: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('useVehicleForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateVehicle).mockReturnValue({
      mutate: mockCreateMutate,
      isPending: false,
    } as ReturnType<typeof useCreateVehicle>);
    vi.mocked(usePatchVehicle).mockReturnValue({
      mutate: mockPatchMutate,
      isPending: false,
    } as ReturnType<typeof usePatchVehicle>);
  });

  describe('initialization', () => {
    it('starts with empty fields when no vehicle is provided and open becomes true', () => {
      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: undefined,
          hasCards: false,
          onOpenChange: vi.fn(),
        }),
      );
      expect(result.current.brand).toBe('');
      expect(result.current.model).toBe('');
      expect(result.current.colour).toBe('');
      expect(result.current.mileage).toBe('');
      expect(result.current.registrationNumber).toBe('');
      expect(result.current.mileageUnit).toBe('km');
    });

    it('pre-fills fields from vehicle when open becomes true in edit mode', () => {
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({
            open,
            vehicle: mockVehicle,
            hasCards: false,
            onOpenChange: vi.fn(),
          }),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      expect(result.current.brand).toBe('Toyota');
      expect(result.current.model).toBe('Corolla');
      expect(result.current.colour).toBe('Silver');
      expect(result.current.mileage).toBe('85000');
      expect(result.current.mileageUnit).toBe('km');
    });

    it('pre-fills registrationNumber from vehicle when present', () => {
      const vehicleWithReg = { ...mockVehicle, registrationNumber: 'FBA1234Z' };
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({
            open,
            vehicle: vehicleWithReg,
            hasCards: false,
            onOpenChange: vi.fn(),
          }),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      expect(result.current.registrationNumber).toBe('FBA1234Z');
    });

    it('does not reset fields when open is false', () => {
      const { result } = renderHook(() =>
        useVehicleForm({
          open: false,
          vehicle: mockVehicle,
          hasCards: false,
          onOpenChange: vi.fn(),
        }),
      );
      // open=false → useEffect condition `if (open)` skipped → fields stay at initial empty
      expect(result.current.brand).toBe('');
    });
  });

  describe('isEdit', () => {
    it('returns false when no vehicle is provided', () => {
      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: undefined,
          hasCards: false,
          onOpenChange: vi.fn(),
        }),
      );
      expect(result.current.isEdit).toBe(false);
    });

    it('returns true when a vehicle is provided', () => {
      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: mockVehicle,
          hasCards: false,
          onOpenChange: vi.fn(),
        }),
      );
      expect(result.current.isEdit).toBe(true);
    });
  });

  describe('isValid', () => {
    it('is false when required fields are empty', () => {
      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: undefined,
          hasCards: false,
          onOpenChange: vi.fn(),
        }),
      );
      expect(result.current.isValid).toBe(false);
    });

    it('is true when all required fields are filled with valid mileage', () => {
      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: undefined,
          hasCards: false,
          onOpenChange: vi.fn(),
        }),
      );
      act(() => {
        result.current.onBrandChange('Toyota');
        result.current.onModelChange('Corolla');
        result.current.onColourChange('Silver');
        result.current.onMileageChange('85000');
      });
      expect(result.current.isValid).toBe(true);
    });

    it('is false when mileage is non-numeric', () => {
      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: undefined,
          hasCards: false,
          onOpenChange: vi.fn(),
        }),
      );
      act(() => {
        result.current.onBrandChange('Toyota');
        result.current.onModelChange('Corolla');
        result.current.onColourChange('Silver');
        result.current.onMileageChange('abc');
      });
      expect(result.current.isValid).toBe(false);
    });

    it('is false when mileage is below current vehicle mileage in edit mode', () => {
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({
            open,
            vehicle: mockVehicle,
            hasCards: false,
            onOpenChange: vi.fn(),
          }),
        { initialProps: { open: false } },
      );
      rerender({ open: true }); // pre-fills mileage to '85000'
      act(() => {
        result.current.onMileageChange('80000');
      });
      expect(result.current.isValid).toBe(false);
    });
  });

  describe('isMileageBelowCurrent', () => {
    it('is false in create mode regardless of mileage', () => {
      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: undefined,
          hasCards: false,
          onOpenChange: vi.fn(),
        }),
      );
      act(() => {
        result.current.onMileageChange('0');
      });
      expect(result.current.isMileageBelowCurrent).toBe(false);
    });

    it('is true when mileage is below current vehicle mileage in edit mode', () => {
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({
            open,
            vehicle: mockVehicle,
            hasCards: false,
            onOpenChange: vi.fn(),
          }),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      act(() => {
        result.current.onMileageChange('80000');
      });
      expect(result.current.isMileageBelowCurrent).toBe(true);
    });

    it('is false when mileage equals current vehicle mileage in edit mode', () => {
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({
            open,
            vehicle: mockVehicle,
            hasCards: false,
            onOpenChange: vi.fn(),
          }),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      expect(result.current.isMileageBelowCurrent).toBe(false);
    });
  });

  describe('unitLocked', () => {
    it('is false in create mode', () => {
      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: undefined,
          hasCards: true,
          onOpenChange: vi.fn(),
        }),
      );
      expect(result.current.unitLocked).toBe(false);
    });

    it('is false in edit mode when hasCards is false', () => {
      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: mockVehicle,
          hasCards: false,
          onOpenChange: vi.fn(),
        }),
      );
      expect(result.current.unitLocked).toBe(false);
    });

    it('is true in edit mode when hasCards is true', () => {
      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: mockVehicle,
          hasCards: true,
          onOpenChange: vi.fn(),
        }),
      );
      expect(result.current.unitLocked).toBe(true);
    });
  });

  describe('currentVehicleMileage', () => {
    it('is undefined in create mode', () => {
      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: undefined,
          hasCards: false,
          onOpenChange: vi.fn(),
        }),
      );
      expect(result.current.currentVehicleMileage).toBeUndefined();
    });

    it('returns vehicle mileage in edit mode', () => {
      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: mockVehicle,
          hasCards: false,
          onOpenChange: vi.fn(),
        }),
      );
      expect(result.current.currentVehicleMileage).toBe(85000);
    });
  });

  describe('handleSave', () => {
    it('calls createMutation.mutate with correct payload in create mode', () => {
      const onOpenChange = vi.fn();
      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: undefined,
          hasCards: false,
          onOpenChange,
        }),
      );
      act(() => {
        result.current.onBrandChange('Toyota');
        result.current.onModelChange('Corolla');
        result.current.onColourChange('Silver');
        result.current.onMileageChange('85000');
      });
      act(() => {
        result.current.handleSave();
      });
      expect(mockCreateMutate).toHaveBeenCalledWith(
        {
          brand: 'Toyota',
          model: 'Corolla',
          colour: 'Silver',
          mileage: 85000,
          mileageUnit: 'km',
          registrationNumber: undefined,
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
      expect(mockPatchMutate).not.toHaveBeenCalled();
    });

    it('sends registrationNumber as string in create mode when field is filled', () => {
      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: undefined,
          hasCards: false,
          onOpenChange: vi.fn(),
        }),
      );
      act(() => {
        result.current.onRegistrationNumberChange('ABC123');
        result.current.onBrandChange('Toyota');
        result.current.onModelChange('Corolla');
        result.current.onColourChange('Silver');
        result.current.onMileageChange('85000');
      });
      act(() => {
        result.current.handleSave();
      });
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ registrationNumber: 'ABC123' }),
        expect.any(Object),
      );
    });

    it('calls patchMutation.mutate with correct payload in edit mode', () => {
      const onOpenChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({
            open,
            vehicle: mockVehicle,
            hasCards: false,
            onOpenChange,
          }),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      act(() => {
        result.current.handleSave();
      });
      expect(mockPatchMutate).toHaveBeenCalledWith(
        {
          brand: 'Toyota',
          model: 'Corolla',
          colour: 'Silver',
          mileage: 85000,
          mileageUnit: 'km',
          registrationNumber: null,
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
      expect(mockCreateMutate).not.toHaveBeenCalled();
    });

    it('sends registrationNumber as null in edit mode when field is empty', () => {
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({
            open,
            vehicle: { ...mockVehicle, registrationNumber: 'FBA1234Z' },
            hasCards: false,
            onOpenChange: vi.fn(),
          }),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      act(() => {
        result.current.onRegistrationNumberChange('');
      });
      act(() => {
        result.current.handleSave();
      });
      expect(mockPatchMutate).toHaveBeenCalledWith(
        expect.objectContaining({ registrationNumber: null }),
        expect.any(Object),
      );
    });

    it('calls toast.success and onOpenChange(false) on create success', () => {
      const onOpenChange = vi.fn();
      vi.mocked(useCreateVehicle).mockReturnValue({
        mutate: (_data: unknown, opts: { onSuccess: () => void }) =>
          opts.onSuccess(),
        isPending: false,
      } as ReturnType<typeof useCreateVehicle>);

      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: undefined,
          hasCards: false,
          onOpenChange,
        }),
      );
      act(() => {
        result.current.onBrandChange('Toyota');
        result.current.onModelChange('Corolla');
        result.current.onColourChange('Silver');
        result.current.onMileageChange('85000');
      });
      act(() => {
        result.current.handleSave();
      });
      expect(toast.success).toHaveBeenCalledWith('Vehicle created');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('calls toast.success("Vehicle updated") and onOpenChange(false) on edit success', () => {
      const onOpenChange = vi.fn();
      vi.mocked(usePatchVehicle).mockReturnValue({
        mutate: (_data: unknown, opts: { onSuccess: () => void }) =>
          opts.onSuccess(),
        isPending: false,
      } as ReturnType<typeof usePatchVehicle>);

      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({
            open,
            vehicle: mockVehicle,
            hasCards: false,
            onOpenChange,
          }),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      act(() => {
        result.current.handleSave();
      });
      expect(toast.success).toHaveBeenCalledWith('Vehicle updated');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('calls toast.error with error message on mutation failure', () => {
      vi.mocked(useCreateVehicle).mockReturnValue({
        mutate: (_data: unknown, opts: { onError: (err: Error) => void }) =>
          opts.onError(new Error('Server error')),
        isPending: false,
      } as ReturnType<typeof useCreateVehicle>);

      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: undefined,
          hasCards: false,
          onOpenChange: vi.fn(),
        }),
      );
      act(() => {
        result.current.onBrandChange('Toyota');
        result.current.onModelChange('Corolla');
        result.current.onColourChange('Silver');
        result.current.onMileageChange('85000');
      });
      act(() => {
        result.current.handleSave();
      });
      expect(toast.error).toHaveBeenCalledWith('Server error');
    });

    it('falls back to "Something went wrong" when error message is empty', () => {
      vi.mocked(useCreateVehicle).mockReturnValue({
        mutate: (_data: unknown, opts: { onError: (err: Error) => void }) =>
          opts.onError(new Error('')),
        isPending: false,
      } as ReturnType<typeof useCreateVehicle>);

      const { result } = renderHook(() =>
        useVehicleForm({
          open: true,
          vehicle: undefined,
          hasCards: false,
          onOpenChange: vi.fn(),
        }),
      );
      act(() => {
        result.current.onBrandChange('Toyota');
        result.current.onModelChange('Corolla');
        result.current.onColourChange('Silver');
        result.current.onMileageChange('85000');
      });
      act(() => {
        result.current.handleSave();
      });
      expect(toast.error).toHaveBeenCalledWith('Something went wrong');
    });
  });
});

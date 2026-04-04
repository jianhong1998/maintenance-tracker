// frontend/src/components/vehicles/vehicle-form-dialog.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { IVehicleResDTO } from '@project/types';

vi.mock('@/hooks/mutations/vehicles/useCreateVehicle', () => ({
  useCreateVehicle: vi.fn(),
}));
vi.mock('@/hooks/mutations/vehicles/usePatchVehicle', () => ({
  usePatchVehicle: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    onOpenChange: (v: boolean) => void;
    children: React.ReactNode;
  }) =>
    open ? (
      <div
        role="dialog"
        aria-label={title}
      >
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

import { toast } from 'sonner';
import { useCreateVehicle } from '@/hooks/mutations/vehicles/useCreateVehicle';
import { usePatchVehicle } from '@/hooks/mutations/vehicles/usePatchVehicle';
import { VehicleFormDialog } from './vehicle-form-dialog';

const mockCreateMutate = vi.fn();
const mockPatchMutate = vi.fn();

const mockVehicle: IVehicleResDTO = {
  id: 'v1',
  brand: 'Toyota',
  model: 'Corolla',
  colour: 'Silver',
  mileage: 85000,
  mileageUnit: 'km',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('VehicleFormDialog', () => {
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

  it('shows "Add Vehicle" title in create mode (no vehicle prop)', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Add Vehicle',
    );
  });

  it('shows "Edit Vehicle" title in edit mode (vehicle prop provided)', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Edit Vehicle',
    );
  });

  it('pre-fills fields with vehicle data in edit mode', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    expect(screen.getByLabelText(/brand/i)).toHaveValue('Toyota');
    expect(screen.getByLabelText(/model/i)).toHaveValue('Corolla');
    expect(screen.getByLabelText(/colour/i)).toHaveValue('Silver');
  });

  it('Save button is disabled when required fields are empty', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('Save button is enabled when all required fields are filled', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled();
  });

  it('unit toggle buttons are enabled when hasCards is false', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
        hasCards={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'km' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'mile' })).not.toBeDisabled();
  });

  it('unit toggle buttons are disabled and hint text shown when hasCards is true', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
        hasCards={true}
      />,
    );
    expect(screen.getByRole('button', { name: 'km' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'mile' })).toBeDisabled();
    expect(
      screen.getByText(/delete all maintenance cards to edit this/i),
    ).toBeInTheDocument();
  });

  it('calls createMutation.mutate with correct data on Save in create mode', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/brand/i), {
      target: { value: 'Toyota' },
    });
    fireEvent.change(screen.getByLabelText(/model/i), {
      target: { value: 'Corolla' },
    });
    fireEvent.change(screen.getByLabelText(/colour/i), {
      target: { value: 'Silver' },
    });
    fireEvent.change(screen.getByLabelText(/mileage/i), {
      target: { value: '85000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(mockCreateMutate).toHaveBeenCalledWith(
      {
        brand: 'Toyota',
        model: 'Corolla',
        colour: 'Silver',
        mileage: 85000,
        mileageUnit: 'km',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mockPatchMutate).not.toHaveBeenCalled();
  });

  it('calls patchMutation.mutate with correct data on Save in edit mode', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(mockPatchMutate).toHaveBeenCalledWith(
      {
        brand: 'Toyota',
        model: 'Corolla',
        colour: 'Silver',
        mileage: 85000,
        mileageUnit: 'km',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it('shows success toast and closes dialog on create success', () => {
    const onOpenChange = vi.fn();
    vi.mocked(useCreateVehicle).mockReturnValue({
      mutate: (_data: unknown, opts: { onSuccess: () => void }) =>
        opts.onSuccess(),
      isPending: false,
    } as ReturnType<typeof useCreateVehicle>);

    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/brand/i), {
      target: { value: 'Toyota' },
    });
    fireEvent.change(screen.getByLabelText(/model/i), {
      target: { value: 'Corolla' },
    });
    fireEvent.change(screen.getByLabelText(/colour/i), {
      target: { value: 'Silver' },
    });
    fireEvent.change(screen.getByLabelText(/mileage/i), {
      target: { value: '85000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(toast.success).toHaveBeenCalledWith('Vehicle created');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows success toast and closes dialog on edit success', () => {
    const onOpenChange = vi.fn();
    vi.mocked(usePatchVehicle).mockReturnValue({
      mutate: (_data: unknown, opts: { onSuccess: () => void }) =>
        opts.onSuccess(),
      isPending: false,
    } as ReturnType<typeof usePatchVehicle>);

    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={onOpenChange}
        vehicle={mockVehicle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(toast.success).toHaveBeenCalledWith('Vehicle updated');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error toast when mutation fails', () => {
    vi.mocked(useCreateVehicle).mockReturnValue({
      mutate: (_data: unknown, opts: { onError: (err: Error) => void }) =>
        opts.onError(new Error('Server error')),
      isPending: false,
    } as ReturnType<typeof useCreateVehicle>);

    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/brand/i), {
      target: { value: 'Toyota' },
    });
    fireEvent.change(screen.getByLabelText(/model/i), {
      target: { value: 'Corolla' },
    });
    fireEvent.change(screen.getByLabelText(/colour/i), {
      target: { value: 'Silver' },
    });
    fireEvent.change(screen.getByLabelText(/mileage/i), {
      target: { value: '85000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(toast.error).toHaveBeenCalledWith('Server error');
  });

  it('disables Save button in edit mode when mileage is reduced below current vehicle mileage', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    // Change mileage to something lower than 85000
    fireEvent.change(screen.getByLabelText(/mileage/i), {
      target: { value: '80000' },
    });
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('enables Save button in edit mode when mileage equals current vehicle mileage', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    // Pre-filled with 85000 (the current mileage) — should be valid
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled();
  });

  it('shows fallback error toast when mutation error message is empty string', () => {
    vi.mocked(useCreateVehicle).mockReturnValue({
      mutate: (_data: unknown, opts: { onError: (err: Error) => void }) =>
        opts.onError(new Error('')),
      isPending: false,
    } as ReturnType<typeof useCreateVehicle>);

    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/brand/i), {
      target: { value: 'Toyota' },
    });
    fireEvent.change(screen.getByLabelText(/model/i), {
      target: { value: 'Corolla' },
    });
    fireEvent.change(screen.getByLabelText(/colour/i), {
      target: { value: 'Silver' },
    });
    fireEvent.change(screen.getByLabelText(/mileage/i), {
      target: { value: '85000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(toast.error).toHaveBeenCalledWith('Something went wrong');
  });
});

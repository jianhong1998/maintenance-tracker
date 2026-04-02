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

const mockMutate = vi.fn();

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
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof useCreateVehicle>);
    vi.mocked(usePatchVehicle).mockReturnValue({
      mutate: mockMutate,
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
    expect(screen.getByPlaceholderText(/toyota/i)).toHaveValue('Toyota');
    expect(screen.getByPlaceholderText(/corolla/i)).toHaveValue('Corolla');
    expect(screen.getByPlaceholderText(/silver/i)).toHaveValue('Silver');
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
    fireEvent.change(screen.getByPlaceholderText(/toyota/i), {
      target: { value: 'Toyota' },
    });
    fireEvent.change(screen.getByPlaceholderText(/corolla/i), {
      target: { value: 'Corolla' },
    });
    fireEvent.change(screen.getByPlaceholderText(/silver/i), {
      target: { value: 'Silver' },
    });
    fireEvent.change(screen.getByPlaceholderText(/85000/i), {
      target: { value: '85000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      {
        brand: 'Toyota',
        model: 'Corolla',
        colour: 'Silver',
        mileage: 85000,
        mileageUnit: 'km',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
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
    expect(mockMutate).toHaveBeenCalledWith(
      {
        brand: 'Toyota',
        model: 'Corolla',
        colour: 'Silver',
        mileage: 85000,
        mileageUnit: 'km',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
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
    fireEvent.change(screen.getByPlaceholderText(/toyota/i), {
      target: { value: 'Toyota' },
    });
    fireEvent.change(screen.getByPlaceholderText(/corolla/i), {
      target: { value: 'Corolla' },
    });
    fireEvent.change(screen.getByPlaceholderText(/silver/i), {
      target: { value: 'Silver' },
    });
    fireEvent.change(screen.getByPlaceholderText(/85000/i), {
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
    fireEvent.change(screen.getByPlaceholderText(/toyota/i), {
      target: { value: 'Toyota' },
    });
    fireEvent.change(screen.getByPlaceholderText(/corolla/i), {
      target: { value: 'Corolla' },
    });
    fireEvent.change(screen.getByPlaceholderText(/silver/i), {
      target: { value: 'Silver' },
    });
    fireEvent.change(screen.getByPlaceholderText(/85000/i), {
      target: { value: '85000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(toast.error).toHaveBeenCalledWith('Server error');
  });
});

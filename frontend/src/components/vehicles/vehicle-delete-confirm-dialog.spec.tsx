import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { IVehicleResDTO } from '@project/types';

vi.mock('@/hooks/mutations/vehicles/useDeleteVehicle', () => ({
  useDeleteVehicle: vi.fn(),
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

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ replace: mockReplace })),
}));

import { useDeleteVehicle } from '@/hooks/mutations/vehicles/useDeleteVehicle';
import { toast } from 'sonner';
import { VehicleDeleteConfirmDialog } from './vehicle-delete-confirm-dialog';

const mockMutate = vi.fn();

const mockVehicle: IVehicleResDTO = {
  id: 'v1',
  brand: 'Toyota',
  model: 'Corolla',
  colour: 'Silver',
  mileage: 85000,
  mileageUnit: 'km',
  mileageLastUpdatedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('VehicleDeleteConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReplace.mockReset();
    vi.mocked(useDeleteVehicle).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof useDeleteVehicle>);
  });

  it('shows vehicle brand and model in the confirmation message', () => {
    render(
      <VehicleDeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    expect(screen.getByText(/Toyota Corolla/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('calls onOpenChange(false) without mutating when Cancel is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <VehicleDeleteConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        vehicle={mockVehicle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockMutate).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls mutate with vehicleId when Delete is clicked', () => {
    render(
      <VehicleDeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('shows success toast, closes dialog, and redirects to "/" on success', () => {
    const onOpenChange = vi.fn();
    vi.mocked(useDeleteVehicle).mockReturnValue({
      mutate: (_id: string, opts: { onSuccess: () => void }) =>
        opts.onSuccess(),
      isPending: false,
    } as ReturnType<typeof useDeleteVehicle>);

    render(
      <VehicleDeleteConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        vehicle={mockVehicle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(toast.success).toHaveBeenCalledWith('Vehicle deleted');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('shows error toast when deleteMutation fails', () => {
    vi.mocked(useDeleteVehicle).mockReturnValue({
      mutate: (_id: string, opts: { onError: (err: Error) => void }) =>
        opts.onError(new Error('Delete failed')),
      isPending: false,
    } as ReturnType<typeof useDeleteVehicle>);

    render(
      <VehicleDeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(toast.error).toHaveBeenCalledWith('Delete failed');
  });

  it('shows fallback error toast when delete error message is empty string', () => {
    vi.mocked(useDeleteVehicle).mockReturnValue({
      mutate: (_id: string, opts: { onError: (err: Error) => void }) =>
        opts.onError(new Error('')),
      isPending: false,
    } as ReturnType<typeof useDeleteVehicle>);

    render(
      <VehicleDeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(toast.error).toHaveBeenCalledWith('Something went wrong');
  });
});

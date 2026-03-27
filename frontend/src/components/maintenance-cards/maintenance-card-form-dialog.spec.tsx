import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { IMaintenanceCardResDTO } from '@project/types';

vi.mock('@/hooks/mutations/maintenance-cards/useCreateMaintenanceCard', () => ({
  useCreateMaintenanceCard: vi.fn(),
}));
vi.mock('@/hooks/mutations/maintenance-cards/usePatchMaintenanceCard', () => ({
  usePatchMaintenanceCard: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
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
import { useCreateMaintenanceCard } from '@/hooks/mutations/maintenance-cards/useCreateMaintenanceCard';
import { usePatchMaintenanceCard } from '@/hooks/mutations/maintenance-cards/usePatchMaintenanceCard';
import { MaintenanceCardFormDialog } from './maintenance-card-form-dialog';

const mockCard: IMaintenanceCardResDTO = {
  id: 'card-1',
  vehicleId: 'v1',
  type: 'part',
  name: 'Tyre Rotation',
  description: 'Front and rear',
  intervalMileage: 10000,
  intervalTimeMonths: 12,
  nextDueMileage: 60000,
  nextDueDate: '2027-01-01',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockMutate = vi.fn();

describe('MaintenanceCardFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateMaintenanceCard).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof useCreateMaintenanceCard>);
    vi.mocked(usePatchMaintenanceCard).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof usePatchMaintenanceCard>);
  });

  it('shows "New Maintenance Card" title in create mode', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
      />,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-label',
      'New Maintenance Card',
    );
  });

  it('shows "Edit Maintenance Card" title in edit mode', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
        card={mockCard}
      />,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-label',
      'Edit Maintenance Card',
    );
  });

  it('pre-fills all fields from card prop in edit mode', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
        card={mockCard}
      />,
    );
    expect(screen.getByPlaceholderText('e.g. Oil Change')).toHaveValue(
      'Tyre Rotation',
    );
    expect(screen.getByPlaceholderText('Optional notes…')).toHaveValue(
      'Front and rear',
    );
    expect(screen.getByPlaceholderText('e.g. 5000')).toHaveValue(10000);
    expect(screen.getByPlaceholderText('e.g. 6')).toHaveValue(12);
  });

  it('disables Save when name is empty', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
      />,
    );
    // No name, no intervals — Save is disabled
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('disables Save when name is filled but no interval is set', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'My Card' },
    });
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('enables Save when name and at least one interval are filled', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'My Card' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 5000'), {
      target: { value: '5000' },
    });
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls createMutation.mutate with correct data in create mode when Save is clicked', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'Oil Change' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 5000'), {
      target: { value: '5000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      {
        type: 'task',
        name: 'Oil Change',
        description: null,
        intervalMileage: 5000,
        intervalTimeMonths: null,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('calls patchMutation.mutate in edit mode when Save is clicked', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
        card={mockCard}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tyre Rotation' }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('calls onOpenChange(false) and shows toast when onSuccess fires in create mode', () => {
    const onOpenChange = vi.fn();

    vi.mocked(useCreateMaintenanceCard).mockReturnValue({
      mutate: (_data: unknown, opts: { onSuccess: () => void }) =>
        opts.onSuccess(),
      isPending: false,
    } as ReturnType<typeof useCreateMaintenanceCard>);

    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={onOpenChange}
        vehicleId="v1"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'New Card' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 5000'), {
      target: { value: '3000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(toast.success).toHaveBeenCalledWith('Card created');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) and shows toast when onSuccess fires in edit mode', () => {
    const onOpenChange = vi.fn();

    vi.mocked(usePatchMaintenanceCard).mockReturnValue({
      mutate: (_data: unknown, opts: { onSuccess: () => void }) =>
        opts.onSuccess(),
      isPending: false,
    } as ReturnType<typeof usePatchMaintenanceCard>);

    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={onOpenChange}
        vehicleId="v1"
        card={mockCard}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(toast.success).toHaveBeenCalledWith('Card updated');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { IMaintenanceCardResDTO } from '@project/types';

vi.mock('@/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard', () => ({
  useDeleteMaintenanceCard: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    title: string;
    children: React.ReactNode;
  }) => (open ? <div role="dialog">{children}</div> : null),
}));

import { useDeleteMaintenanceCard } from '@/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from './delete-confirm-dialog';

const mockMutate = vi.fn();

const mockCard: IMaintenanceCardResDTO = {
  id: 'card-1',
  vehicleId: 'v1',
  type: 'task',
  name: 'Oil Change',
  description: null,
  intervalMileage: 5000,
  intervalTimeMonths: null,
  nextDueMileage: null,
  nextDueDate: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('DeleteConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeleteMaintenanceCard).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof useDeleteMaintenanceCard>);
  });

  it('shows the card name in the confirmation message', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCard}
        vehicleId="v1"
      />,
    );
    expect(screen.getByText(/Oil Change/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('calls Cancel without mutating when Cancel is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <DeleteConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        card={mockCard}
        vehicleId="v1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockMutate).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls mutate with cardId when Delete is clicked', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCard}
        vehicleId="v1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      'card-1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('calls onOpenChange(false) and shows toast when onSuccess fires', () => {
    const onOpenChange = vi.fn();

    vi.mocked(useDeleteMaintenanceCard).mockReturnValue({
      mutate: (_cardId: string, opts: { onSuccess: () => void }) =>
        opts.onSuccess(),
      isPending: false,
    } as ReturnType<typeof useDeleteMaintenanceCard>);

    render(
      <DeleteConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        card={mockCard}
        vehicleId="v1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(toast.success).toHaveBeenCalledWith('Card deleted');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

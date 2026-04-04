import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { IMaintenanceCardResDTO } from '@project/types';

vi.mock('@/hooks/mutations/maintenance-cards/useMarkDone', () => ({
  useMarkDone: vi.fn(),
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

import { useMarkDone } from '@/hooks/mutations/maintenance-cards/useMarkDone';
import { toast } from 'sonner';
import { MarkDoneDialog } from './mark-done-dialog';

const mockMutate = vi.fn();

const cardWithMileage: IMaintenanceCardResDTO = {
  id: 'card-1',
  vehicleId: 'v1',
  type: 'task',
  name: 'Oil Change',
  description: null,
  intervalMileage: 5000,
  intervalTimeMonths: null,
  nextDueMileage: 55000,
  nextDueDate: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const cardWithoutMileage: IMaintenanceCardResDTO = {
  ...cardWithMileage,
  intervalMileage: null,
  nextDueMileage: null,
};

describe('MarkDoneDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMarkDone).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof useMarkDone>);
  });

  it('shows mileage input when card.intervalMileage is not null', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithMileage}
        vehicleId="v1"
        currentMileage={50000}
      />,
    );
    expect(
      screen.getByPlaceholderText('Current odometer reading'),
    ).toBeInTheDocument();
  });

  it('hides mileage input when card.intervalMileage is null', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithoutMileage}
        vehicleId="v1"
        currentMileage={50000}
      />,
    );
    expect(
      screen.queryByPlaceholderText('Current odometer reading'),
    ).not.toBeInTheDocument();
  });

  it('disables Done button when mileage is required but empty', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithMileage}
        vehicleId="v1"
        currentMileage={50000}
      />,
    );
    expect(screen.getByRole('button', { name: /done/i })).toBeDisabled();
  });

  it('enables Done button when mileage is required and provided', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithMileage}
        vehicleId="v1"
        currentMileage={50000}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Current odometer reading'), {
      target: { value: '52000' },
    });
    expect(screen.getByRole('button', { name: /done/i })).not.toBeDisabled();
  });

  it('enables Done button when mileage is not required (time-only card)', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithoutMileage}
        vehicleId="v1"
        currentMileage={50000}
      />,
    );
    expect(screen.getByRole('button', { name: /done/i })).not.toBeDisabled();
  });

  it('calls mutate with correct payload when Done is clicked', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithMileage}
        vehicleId="v1"
        currentMileage={50000}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Current odometer reading'), {
      target: { value: '52000' },
    });
    fireEvent.change(screen.getByPlaceholderText('Optional notes…'), {
      target: { value: 'Used synthetic oil' },
    });
    fireEvent.click(screen.getByRole('button', { name: /done/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      { doneAtMileage: 52000, notes: 'Used synthetic oil' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('disables Done button when mileage input is non-numeric (NaN)', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithMileage}
        vehicleId="v1"
        currentMileage={50000}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Current odometer reading'), {
      target: { value: 'abc' },
    });
    expect(screen.getByRole('button', { name: /done/i })).toBeDisabled();
  });

  it('truncates decimal mileage input to integer', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithMileage}
        vehicleId="v1"
        currentMileage={50000}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Current odometer reading'), {
      target: { value: '52000.7' },
    });
    fireEvent.click(screen.getByRole('button', { name: /done/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ doneAtMileage: 52000 }),
      expect.any(Object),
    );
  });

  it('calls onOpenChange(false) and shows toast when onSuccess fires', () => {
    const onOpenChange = vi.fn();

    vi.mocked(useMarkDone).mockReturnValue({
      mutate: (_data: unknown, opts: { onSuccess: () => void }) =>
        opts.onSuccess(),
      isPending: false,
    } as ReturnType<typeof useMarkDone>);

    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={onOpenChange}
        card={cardWithoutMileage}
        vehicleId="v1"
        currentMileage={50000}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /done/i }));

    expect(toast.success).toHaveBeenCalledWith('Marked as done');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error toast when markDone mutation fails', () => {
    vi.mocked(useMarkDone).mockReturnValue({
      mutate: (_data: unknown, opts: { onError: (err: Error) => void }) =>
        opts.onError(new Error('Mark done failed')),
      isPending: false,
    } as ReturnType<typeof useMarkDone>);

    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithoutMileage}
        vehicleId="v1"
        currentMileage={14100}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /done/i }));

    expect(toast.error).toHaveBeenCalledWith('Mark done failed');
  });

  it('disables Done button when doneAtMileage is below vehicle current mileage', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithMileage}
        vehicleId="v1"
        currentMileage={14100}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Current odometer reading'), {
      target: { value: '14000' },
    });
    expect(screen.getByRole('button', { name: /done/i })).toBeDisabled();
  });

  it('enables Done button when doneAtMileage equals vehicle current mileage', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithMileage}
        vehicleId="v1"
        currentMileage={14100}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Current odometer reading'), {
      target: { value: '14100' },
    });
    expect(screen.getByRole('button', { name: /done/i })).not.toBeDisabled();
  });

  it('enables Done button when doneAtMileage is above vehicle current mileage', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithMileage}
        vehicleId="v1"
        currentMileage={14100}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Current odometer reading'), {
      target: { value: '15000' },
    });
    expect(screen.getByRole('button', { name: /done/i })).not.toBeDisabled();
  });
});

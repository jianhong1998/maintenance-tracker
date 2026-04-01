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
import { useCreateMaintenanceCard } from '@/hooks/mutations/maintenance-cards/useCreateMaintenanceCard';
import { usePatchMaintenanceCard } from '@/hooks/mutations/maintenance-cards/usePatchMaintenanceCard';
import {
  MaintenanceCardFormDialog,
  calcAutoNextDueDate,
} from './maintenance-card-form-dialog';

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

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  vehicleId: 'v1',
  vehicleMileage: 50000,
  vehicleMileageUnit: 'km',
};

describe('calcAutoNextDueDate', () => {
  it('returns null when months is null', () => {
    expect(calcAutoNextDueDate(null)).toBeNull();
  });

  it('clamps to last valid day when target month is shorter than current day', () => {
    // January 31 + 1 month: setMonth overflows to March 3 in 2026; should clamp to Feb 28
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 31)); // Jan 31, 2026
    expect(calcAutoNextDueDate(1)).toBe('2026-02-28');
    vi.useRealTimers();
  });

  it('preserves day when target month has enough days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15)); // Jan 15, 2026
    expect(calcAutoNextDueDate(1)).toBe('2026-02-15');
    vi.useRealTimers();
  });
});

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
    render(<MaintenanceCardFormDialog {...defaultProps} />);
    expect(
      screen.getByRole('heading', { name: 'New Maintenance Card' }),
    ).toBeInTheDocument();
  });

  it('shows "Edit Maintenance Card" title in edit mode', () => {
    render(
      <MaintenanceCardFormDialog
        {...defaultProps}
        card={mockCard}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Edit Maintenance Card' }),
    ).toBeInTheDocument();
  });

  it('pre-fills all fields from card prop in edit mode', () => {
    render(
      <MaintenanceCardFormDialog
        {...defaultProps}
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

  it('pre-fills nextDueMileage and nextDueDate from card prop in edit mode', () => {
    render(
      <MaintenanceCardFormDialog
        {...defaultProps}
        card={mockCard}
      />,
    );
    // nextDueMileage input has placeholder 'Auto' when no intervalMileage typed
    // In edit mode, the value is 60000
    const nextDueMileageInput = screen.getByDisplayValue('60000');
    expect(nextDueMileageInput).toBeInTheDocument();
    expect(screen.getByDisplayValue('2027-01-01')).toBeInTheDocument();
  });

  it('disables Save when name is empty', () => {
    render(<MaintenanceCardFormDialog {...defaultProps} />);
    // No name, no intervals — Save is disabled
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('disables Save when name is filled but no interval is set', () => {
    render(<MaintenanceCardFormDialog {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'My Card' },
    });
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('enables Save when name and at least one interval are filled', () => {
    render(<MaintenanceCardFormDialog {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'My Card' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 5000'), {
      target: { value: '5000' },
    });
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls createMutation.mutate with correct data in create mode when Save is clicked', () => {
    render(<MaintenanceCardFormDialog {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'Oil Change' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 5000'), {
      target: { value: '5000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task',
        name: 'Oil Change',
        description: null,
        intervalMileage: 5000,
        intervalTimeMonths: null,
        // auto-calculated: 50000 + 5000 = 55000
        nextDueMileage: 55000,
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('auto-calculates nextDueMileage from vehicleMileage + intervalMileage when left blank', () => {
    render(<MaintenanceCardFormDialog {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'Oil Change' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 5000'), {
      target: { value: '5000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const callArg = mockMutate.mock.calls[0]?.[0] as {
      nextDueMileage: number | null;
    };
    expect(callArg.nextDueMileage).toBe(55000); // 50000 + 5000
  });

  it('uses explicit nextDueMileage over auto-calculation when provided', () => {
    render(<MaintenanceCardFormDialog {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'Oil Change' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 5000'), {
      target: { value: '5000' },
    });
    // The next due mileage input placeholder shows the auto-calc value: vehicleMileage + intervalMileage
    const nextDueMileageInput = screen.getByPlaceholderText('55000');
    fireEvent.change(nextDueMileageInput, { target: { value: '60000' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const callArg = mockMutate.mock.calls[0]?.[0] as {
      nextDueMileage: number | null;
    };
    expect(callArg.nextDueMileage).toBe(60000);
  });

  it('calls patchMutation.mutate in edit mode when Save is clicked', () => {
    render(
      <MaintenanceCardFormDialog
        {...defaultProps}
        card={mockCard}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tyre Rotation' }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('includes nextDueMileage and nextDueDate in the patch data', () => {
    render(
      <MaintenanceCardFormDialog
        {...defaultProps}
        card={mockCard}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        nextDueMileage: 60000,
        nextDueDate: '2027-01-01',
      }),
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
        {...defaultProps}
        onOpenChange={onOpenChange}
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
        {...defaultProps}
        onOpenChange={onOpenChange}
        card={mockCard}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(toast.success).toHaveBeenCalledWith('Card updated');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error toast when createMutation fails', () => {
    vi.mocked(useCreateMaintenanceCard).mockReturnValue({
      mutate: (_data: unknown, opts: { onError: (err: Error) => void }) =>
        opts.onError(new Error('Network error')),
      isPending: false,
    } as ReturnType<typeof useCreateMaintenanceCard>);

    render(<MaintenanceCardFormDialog {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'New Card' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 5000'), {
      target: { value: '3000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(toast.error).toHaveBeenCalledWith('Network error');
  });

  it('auto-calculates nextDueDate using local date (not UTC)', () => {
    // Simulate a date where UTC and local date could diverge
    // We stub Date to control what "now" is
    const fakeNow = new Date(2025, 0, 15); // Jan 15 2025 in local time
    vi.setSystemTime(fakeNow);

    render(<MaintenanceCardFormDialog {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'Oil Change' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 6'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const callArg = mockMutate.mock.calls[0]?.[0] as {
      nextDueDate: string | null;
    };
    // 3 months from Jan 15 = Apr 15 in local time
    expect(callArg.nextDueDate).toBe('2025-04-15');

    vi.useRealTimers();
  });

  it('shows error toast when patchMutation fails', () => {
    vi.mocked(usePatchMaintenanceCard).mockReturnValue({
      mutate: (_data: unknown, opts: { onError: (err: Error) => void }) =>
        opts.onError(new Error('Server error')),
      isPending: false,
    } as ReturnType<typeof usePatchMaintenanceCard>);

    render(
      <MaintenanceCardFormDialog
        {...defaultProps}
        card={mockCard}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(toast.error).toHaveBeenCalledWith('Server error');
  });
});

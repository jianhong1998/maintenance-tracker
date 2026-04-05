import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('@/hooks/mutations/vehicles/useRecordMileage', () => ({
  useRecordMileage: vi.fn(),
}));

import { useRecordMileage } from '@/hooks/mutations/vehicles/useRecordMileage';
import {
  MileagePrompt,
  getDismissKey,
  getTodayLocalDateString,
} from './mileage-prompt';

const VEHICLE_ID = 'vehicle-123';

const renderPrompt = (mileageLastUpdatedAt: string | null = null) =>
  render(
    <MileagePrompt
      vehicleId={VEHICLE_ID}
      currentMileage={50000}
      mileageLastUpdatedAt={mileageLastUpdatedAt}
    />,
  );

describe('MileagePrompt', () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useRecordMileage).mockReturnValue({
      mutate: mockMutate,
    } as unknown as ReturnType<typeof useRecordMileage>);
  });

  describe('visibility — DB-driven (mileageLastUpdatedAt)', () => {
    it('renders prompt when mileageLastUpdatedAt is null (never recorded)', async () => {
      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByText("What's your current odometer reading?"),
        ).toBeInTheDocument();
      });
    });

    it('renders prompt when mileageLastUpdatedAt is from a previous day', async () => {
      // Pin "now" to Apr 5 so the previous-day assertion is timezone-safe
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-05T10:00:00Z'));

      renderPrompt('2026-04-04T06:00:00.000Z'); // Apr 4 in any timezone

      await waitFor(() => {
        expect(
          screen.getByText("What's your current odometer reading?"),
        ).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('renders nothing when mileageLastUpdatedAt is today (local date)', async () => {
      // Pin "now" to Apr 5 10:00 UTC
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-05T10:00:00Z'));

      // Apr 5 06:00 UTC is Apr 5 in every timezone from UTC-5 eastward
      const { container } = renderPrompt('2026-04-05T06:00:00.000Z');

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });

      vi.useRealTimers();
    });
  });

  describe('visibility — localStorage-driven (dismiss)', () => {
    it('renders nothing when dismissed today', async () => {
      localStorage.setItem(
        getDismissKey(VEHICLE_ID),
        getTodayLocalDateString(),
      );

      const { container } = renderPrompt(null);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });

    it('renders prompt when dismissed on a previous day', async () => {
      localStorage.setItem(getDismissKey(VEHICLE_ID), '2026-04-04');

      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByText("What's your current odometer reading?"),
        ).toBeInTheDocument();
      });
    });
  });

  describe('dismiss button', () => {
    it('writes today local date string to dismiss key and hides prompt', async () => {
      renderPrompt(null);

      await waitFor(() => {
        expect(screen.getByText('Dismiss')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Dismiss'));

      await waitFor(() => {
        expect(
          screen.queryByText("What's your current odometer reading?"),
        ).not.toBeInTheDocument();
      });

      expect(localStorage.getItem(getDismissKey(VEHICLE_ID))).toBe(
        getTodayLocalDateString(),
      );
    });
  });

  describe('submit button', () => {
    it('calls recordMileage with parsed mileage and onSuccess callback', async () => {
      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter mileage'),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Enter mileage'), {
        target: { value: '60000' },
      });
      fireEvent.click(screen.getByText('Update'));

      expect(mockMutate).toHaveBeenCalledWith(
        { mileage: 60000 },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
      // localStorage must NOT be written on submit (DB is source of truth)
      expect(localStorage.getItem(getDismissKey(VEHICLE_ID))).toBeNull();
      expect(
        screen.queryByText("What's your current odometer reading?"),
      ).toBeInTheDocument();
    });

    it('hides prompt after successful submit without writing localStorage', async () => {
      mockMutate.mockImplementation(
        (_data: unknown, options?: { onSuccess?: () => void }) => {
          options?.onSuccess?.();
        },
      );

      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter mileage'),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Enter mileage'), {
        target: { value: '60000' },
      });
      fireEvent.click(screen.getByText('Update'));

      expect(localStorage.getItem(getDismissKey(VEHICLE_ID))).toBeNull();
      await waitFor(() => {
        expect(
          screen.queryByText("What's your current odometer reading?"),
        ).not.toBeInTheDocument();
      });
    });

    it('disables Update button when entered value is less than currentMileage', async () => {
      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter mileage'),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Enter mileage'), {
        target: { value: '49999' },
      });

      expect(screen.getByRole('button', { name: /update/i })).toBeDisabled();
    });

    it('shows inline validation error when entered value is less than currentMileage', async () => {
      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter mileage'),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Enter mileage'), {
        target: { value: '49999' },
      });

      expect(
        screen.getByText(/mileage cannot be less than current/i),
      ).toBeInTheDocument();
    });

    it('does not call recordMileage when entered value is less than currentMileage', async () => {
      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter mileage'),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Enter mileage'), {
        target: { value: '49999' },
      });

      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('enables Update button when entered value equals currentMileage', async () => {
      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter mileage'),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Enter mileage'), {
        target: { value: '50000' },
      });

      expect(
        screen.getByRole('button', { name: /update/i }),
      ).not.toBeDisabled();
    });
  });

  describe('error state', () => {
    it('shows error message when mutation fails (isError=true)', async () => {
      vi.mocked(useRecordMileage).mockReturnValue({
        mutate: mockMutate,
        isError: true,
      } as unknown as ReturnType<typeof useRecordMileage>);

      renderPrompt(null);

      await waitFor(() => {
        expect(
          screen.getByText('Failed to update mileage. Please try again.'),
        ).toBeInTheDocument();
      });
    });
  });
});

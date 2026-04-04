import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('@/hooks/mutations/vehicles/usePatchVehicle', () => ({
  usePatchVehicle: vi.fn(),
}));

import { usePatchVehicle } from '@/hooks/mutations/vehicles/usePatchVehicle';
import { MileagePrompt, getTodayKey } from './mileage-prompt';

const VEHICLE_ID = 'vehicle-123';

describe('MileagePrompt', () => {
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(usePatchVehicle).mockReturnValue({
      mutate: mockMutate,
    } as unknown as ReturnType<typeof usePatchVehicle>);
  });

  it('renders nothing when localStorage key is already set for today', async () => {
    localStorage.setItem(getTodayKey(VEHICLE_ID), '1');

    const { container } = render(
      <MileagePrompt
        vehicleId={VEHICLE_ID}
        currentMileage={50000}
      />,
    );

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders the prompt when localStorage key is not set', async () => {
    render(
      <MileagePrompt
        vehicleId={VEHICLE_ID}
        currentMileage={50000}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("What's your current odometer reading?"),
      ).toBeInTheDocument();
    });
  });

  it('sets localStorage and hides prompt when Dismiss is clicked', async () => {
    render(
      <MileagePrompt
        vehicleId={VEHICLE_ID}
        currentMileage={50000}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Dismiss'));

    await waitFor(() => {
      expect(
        screen.queryByText("What's your current odometer reading?"),
      ).not.toBeInTheDocument();
    });

    expect(localStorage.getItem(getTodayKey(VEHICLE_ID))).toBe('1');
  });

  it('calls patchVehicle with parsed mileage and onSuccess callback when Update is clicked', async () => {
    render(
      <MileagePrompt
        vehicleId={VEHICLE_ID}
        currentMileage={50000}
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter mileage')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter mileage');
    fireEvent.change(input, { target: { value: '12345' } });

    fireEvent.click(screen.getByText('Update'));

    expect(mockMutate).toHaveBeenCalledWith(
      { mileage: 12345 },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    // dismiss() must NOT fire before mutation settles
    expect(localStorage.getItem(getTodayKey(VEHICLE_ID))).toBeNull();
    expect(
      screen.queryByText("What's your current odometer reading?"),
    ).toBeInTheDocument();
  });

  it('shows error message when mutation fails (isError=true)', async () => {
    vi.mocked(usePatchVehicle).mockReturnValue({
      mutate: mockMutate,
      isError: true,
    } as unknown as ReturnType<typeof usePatchVehicle>);

    render(
      <MileagePrompt
        vehicleId={VEHICLE_ID}
        currentMileage={50000}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText('Failed to update mileage. Please try again.'),
      ).toBeInTheDocument();
    });
  });

  it('dismisses prompt only after successful mutation', async () => {
    mockMutate.mockImplementation(
      (_data: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.();
      },
    );

    render(
      <MileagePrompt
        vehicleId={VEHICLE_ID}
        currentMileage={50000}
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter mileage')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter mileage');
    fireEvent.change(input, { target: { value: '12345' } });
    fireEvent.click(screen.getByText('Update'));

    expect(localStorage.getItem(getTodayKey(VEHICLE_ID))).toBe('1');
    await waitFor(() => {
      expect(
        screen.queryByText("What's your current odometer reading?"),
      ).not.toBeInTheDocument();
    });
  });

  it('disables Update button when entered value is less than currentMileage', async () => {
    render(
      <MileagePrompt
        vehicleId={VEHICLE_ID}
        currentMileage={50000}
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter mileage')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter mileage');
    fireEvent.change(input, { target: { value: '49999' } });

    expect(screen.getByRole('button', { name: /update/i })).toBeDisabled();
  });

  it('shows inline validation error when entered value is less than currentMileage', async () => {
    render(
      <MileagePrompt
        vehicleId={VEHICLE_ID}
        currentMileage={50000}
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter mileage')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter mileage');
    fireEvent.change(input, { target: { value: '49999' } });
    fireEvent.click(screen.getByRole('button', { name: /update/i }));

    expect(
      screen.getByText(/mileage cannot be less than current/i),
    ).toBeInTheDocument();
  });

  it('does not call patchVehicle when entered value is less than currentMileage', async () => {
    render(
      <MileagePrompt
        vehicleId={VEHICLE_ID}
        currentMileage={50000}
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter mileage')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Enter mileage');
    fireEvent.change(input, { target: { value: '49999' } });
    fireEvent.click(screen.getByRole('button', { name: /update/i }));

    expect(mockMutate).not.toHaveBeenCalled();
  });
});

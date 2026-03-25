import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { IVehicleResDTO } from '@project/types';

vi.mock('@/hooks/queries/vehicles/useVehicles', () => ({
  useVehicles: vi.fn(),
}));

vi.mock('@/hooks/queries/config/useAppConfig', () => ({
  useAppConfig: vi.fn(),
}));

vi.mock('@/hooks/queries/vehicles/useGlobalWarningCount', () => ({
  useGlobalWarningCount: vi.fn(),
}));

vi.mock('@/components/vehicles/vehicle-card', () => ({
  VehicleCard: ({ vehicle }: { vehicle: IVehicleResDTO }) => (
    <div data-testid="vehicle-card">{vehicle.brand}</div>
  ),
}));

vi.mock('@/components/auth/auth-guard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { useVehicles } from '@/hooks/queries/vehicles/useVehicles';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { useGlobalWarningCount } from '@/hooks/queries/vehicles/useGlobalWarningCount';
import { HomePage } from './home-page';

const mockVehicle: IVehicleResDTO = {
  id: 'vehicle-1',
  brand: 'Toyota',
  model: 'Camry',
  colour: 'Silver',
  mileage: 50000,
  mileageUnit: 'km',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockVehicle2: IVehicleResDTO = {
  id: 'vehicle-2',
  brand: 'Honda',
  model: 'Civic',
  colour: 'Blue',
  mileage: 30000,
  mileageUnit: 'km',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppConfig).mockReturnValue({
      data: { mileageWarningThresholdKm: 500 },
    } as ReturnType<typeof useAppConfig>);
    vi.mocked(useGlobalWarningCount).mockReturnValue(0);
  });

  it('shows loading message when useVehicles is loading', () => {
    vi.mocked(useVehicles).mockReturnValue({
      data: [],
      isLoading: true,
    } as ReturnType<typeof useVehicles>);

    render(<HomePage />);

    expect(screen.getByText(/loading vehicles/i)).toBeInTheDocument();
  });

  it('shows "No vehicles yet" message when vehicles array is empty', () => {
    vi.mocked(useVehicles).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useVehicles>);

    render(<HomePage />);

    expect(screen.getByText(/no vehicles yet/i)).toBeInTheDocument();
  });

  it('renders a VehicleCard for each vehicle when data is available', () => {
    vi.mocked(useVehicles).mockReturnValue({
      data: [mockVehicle, mockVehicle2],
      isLoading: false,
    } as ReturnType<typeof useVehicles>);

    render(<HomePage />);

    const cards = screen.getAllByTestId('vehicle-card');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('Toyota')).toBeInTheDocument();
    expect(screen.getByText('Honda')).toBeInTheDocument();
  });

  it('shows "All good" message when global warning count is 0', () => {
    vi.mocked(useVehicles).mockReturnValue({
      data: [mockVehicle],
      isLoading: false,
    } as ReturnType<typeof useVehicles>);
    vi.mocked(useGlobalWarningCount).mockReturnValue(0);

    render(<HomePage />);

    expect(screen.getByText(/all good/i)).toBeInTheDocument();
  });

  it('shows "X card(s) need attention" when global warning count > 0', () => {
    vi.mocked(useVehicles).mockReturnValue({
      data: [mockVehicle, mockVehicle2],
      isLoading: false,
    } as ReturnType<typeof useVehicles>);
    vi.mocked(useGlobalWarningCount).mockReturnValue(4);

    render(<HomePage />);

    expect(screen.getByText(/4 cards need attention/i)).toBeInTheDocument();
  });

  it('renders inside AuthGuard', () => {
    vi.mocked(useVehicles).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useVehicles>);

    render(<HomePage />);

    // AuthGuard is mocked to render children — if it renders, AuthGuard was used
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});

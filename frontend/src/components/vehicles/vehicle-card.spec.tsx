import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { IVehicleResDTO, IMaintenanceCardResDTO } from '@project/types';

vi.mock('@/hooks/queries/maintenance-cards/useMaintenanceCards', () => ({
  useMaintenanceCards: vi.fn(),
}));
vi.mock('@/lib/warning', () => ({
  countWarningCards: vi.fn(),
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a
      href={href}
      className={className}
    >
      {children}
    </a>
  ),
}));
vi.mock('./vehicle-status-chip', () => ({
  VehicleStatusChip: ({ count }: { count: number }) => (
    <span data-testid="vehicle-status-chip">
      {count > 0 ? `${count} OVERDUE` : 'ALL GOOD'}
    </span>
  ),
}));

import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import { countWarningCards } from '@/lib/warning';
import { VehicleCard } from './vehicle-card';

const mockVehicle: IVehicleResDTO = {
  id: 'vehicle-1',
  brand: 'Toyota',
  model: 'Camry',
  colour: 'Silver',
  mileage: 50000,
  mileageUnit: 'km',
  mileageLastUpdatedAt: null,
  registrationNumber: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockCards: IMaintenanceCardResDTO[] = [];

describe('VehicleCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMaintenanceCards).mockReturnValue({
      data: mockCards,
    } as ReturnType<typeof useMaintenanceCards>);
    vi.mocked(countWarningCards).mockReturnValue(0);
  });

  it('renders vehicle primary label', () => {
    render(
      <VehicleCard
        vehicle={mockVehicle}
        thresholdKm={500}
        notificationDaysBefore={7}
      />,
    );

    expect(screen.getByText('Toyota Camry')).toBeInTheDocument();
  });

  it('renders the meta line as "colour · mileage unit"', () => {
    render(
      <VehicleCard
        vehicle={mockVehicle}
        thresholdKm={500}
        notificationDaysBefore={7}
      />,
    );

    expect(
      screen.getByText(
        `${mockVehicle.colour} · ${mockVehicle.mileage.toLocaleString()} ${mockVehicle.mileageUnit}`,
      ),
    ).toBeInTheDocument();
  });

  it('shows a warning badge with overdue count when there are warning/overdue cards', () => {
    vi.mocked(countWarningCards).mockReturnValue(3);

    render(
      <VehicleCard
        vehicle={mockVehicle}
        thresholdKm={500}
        notificationDaysBefore={7}
      />,
    );

    expect(screen.getByTestId('vehicle-status-chip')).toHaveTextContent(
      '3 OVERDUE',
    );
  });

  it('shows ALL GOOD chip when warningCount is 0', () => {
    vi.mocked(countWarningCards).mockReturnValue(0);

    render(
      <VehicleCard
        vehicle={mockVehicle}
        thresholdKm={500}
        notificationDaysBefore={7}
      />,
    );

    expect(screen.getByTestId('vehicle-status-chip')).toHaveTextContent(
      'ALL GOOD',
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('links to /vehicles/:id', () => {
    render(
      <VehicleCard
        vehicle={mockVehicle}
        thresholdKm={500}
        notificationDaysBefore={7}
      />,
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/vehicles/vehicle-1');
  });

  it('passes thresholdKm and notificationDaysBefore to countWarningCards', () => {
    const thresholdKm = 750;
    const notificationDaysBefore = 14;

    render(
      <VehicleCard
        vehicle={mockVehicle}
        thresholdKm={thresholdKm}
        notificationDaysBefore={notificationDaysBefore}
      />,
    );

    expect(vi.mocked(countWarningCards)).toHaveBeenCalledWith({
      cards: mockCards,
      vehicleMileage: mockVehicle.mileage,
      mileageUnit: mockVehicle.mileageUnit,
      mileageWarningThresholdKm: thresholdKm,
      notificationDaysBefore,
    });
  });

  it('shows registrationNumber as the primary label when set', () => {
    const vehicleWithReg = { ...mockVehicle, registrationNumber: 'FBA1234Z' };
    render(
      <VehicleCard
        vehicle={vehicleWithReg}
        thresholdKm={500}
        notificationDaysBefore={7}
      />,
    );
    expect(screen.getByText('FBA1234Z')).toBeInTheDocument();
  });

  it('does not render brand+model as a secondary line when registrationNumber is null', () => {
    render(
      <VehicleCard
        vehicle={mockVehicle}
        thresholdKm={500}
        notificationDaysBefore={7}
      />,
    );
    // Toyota Camry appears exactly once (as primary)
    expect(screen.getAllByText('Toyota Camry')).toHaveLength(1);
  });
});

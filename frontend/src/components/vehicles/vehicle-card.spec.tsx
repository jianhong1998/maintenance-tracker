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

  it('renders vehicle brand, model, colour, and mileage', () => {
    render(
      <VehicleCard
        vehicle={mockVehicle}
        thresholdKm={500}
      />,
    );

    expect(screen.getByText('Toyota Camry')).toBeInTheDocument();
    expect(screen.getByText('Silver')).toBeInTheDocument();
    expect(screen.getByText('50,000 km')).toBeInTheDocument();
  });

  it('shows a warning badge with count when there are warning/overdue cards', () => {
    vi.mocked(countWarningCards).mockReturnValue(3);

    render(
      <VehicleCard
        vehicle={mockVehicle}
        thresholdKm={500}
      />,
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does NOT show a badge when warningCount is 0', () => {
    vi.mocked(countWarningCards).mockReturnValue(0);

    render(
      <VehicleCard
        vehicle={mockVehicle}
        thresholdKm={500}
      />,
    );

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('links to /vehicles/:id', () => {
    render(
      <VehicleCard
        vehicle={mockVehicle}
        thresholdKm={500}
      />,
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/vehicles/vehicle-1');
  });

  it('passes thresholdKm to countWarningCards', () => {
    const thresholdKm = 750;

    render(
      <VehicleCard
        vehicle={mockVehicle}
        thresholdKm={thresholdKm}
      />,
    );

    expect(vi.mocked(countWarningCards)).toHaveBeenCalledWith(
      mockCards,
      mockVehicle.mileage,
      mockVehicle.mileageUnit,
      thresholdKm,
    );
  });
});

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@/hooks/queries/vehicles/useVehicles', () => ({
  useVehicles: vi.fn(() => ({
    data: [
      {
        id: 'v1',
        name: 'Civic',
        colour: 'Red',
        mileage: 45000,
        mileageUnit: 'km',
        registrationNumber: 'ABC123',
      },
    ],
    isLoading: false,
  })),
}));
vi.mock('@/hooks/queries/config/useAppConfig', () => ({
  useAppConfig: vi.fn(() => ({ data: { mileageWarningThresholdKm: 500 } })),
}));
vi.mock('@/hooks/queries/maintenance-cards/useMaintenanceCards', () => ({
  useMaintenanceCards: vi.fn(() => ({ data: [] })),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/vehicles/v1',
}));

import { VehiclesLayout } from './vehicles-layout';

describe('VehiclesLayout', () => {
  it('renders children', () => {
    render(
      <VehiclesLayout>
        <div>detail content</div>
      </VehiclesLayout>,
    );
    expect(screen.getByText('detail content')).toBeInTheDocument();
  });

  it('renders the vehicle list panel header', () => {
    render(
      <VehiclesLayout>
        <div>detail content</div>
      </VehiclesLayout>,
    );
    expect(screen.getByText(/your vehicles/i)).toBeInTheDocument();
  });

  it('renders a status chip for each vehicle in the list', () => {
    render(
      <VehiclesLayout>
        <div>detail content</div>
      </VehiclesLayout>,
    );
    // Zero overdue cards in the mock -> "ALL GOOD"
    expect(screen.getByText('ALL GOOD')).toBeInTheDocument();
  });
});

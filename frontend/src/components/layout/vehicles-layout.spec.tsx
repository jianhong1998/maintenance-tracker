import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { IVehicleResDTO, IMaintenanceCardResDTO } from '@project/types';

vi.mock('@/hooks/queries/vehicles/useVehicles', () => ({
  useVehicles: vi.fn(),
}));
vi.mock('@/hooks/queries/config/useAppConfig', () => ({
  useAppConfig: vi.fn(),
}));
vi.mock('@/hooks/queries/maintenance-cards/useMaintenanceCards', () => ({
  useMaintenanceCards: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/vehicles/v1',
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a
      href={href}
      {...props}
    >
      {children}
    </a>
  ),
}));

import { useVehicles } from '@/hooks/queries/vehicles/useVehicles';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import { VehiclesLayout } from './vehicles-layout';

const defaultVehicle: IVehicleResDTO = {
  id: 'v1',
  brand: 'Honda',
  model: 'Civic',
  colour: 'Red',
  mileage: 45000,
  mileageUnit: 'km',
  mileageLastUpdatedAt: null,
  registrationNumber: 'ABC123',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('VehiclesLayout', () => {
  beforeEach(() => {
    vi.mocked(useVehicles).mockReturnValue({
      data: [defaultVehicle],
      isLoading: false,
    } as ReturnType<typeof useVehicles>);
    vi.mocked(useAppConfig).mockReturnValue({
      data: { mileageWarningThresholdKm: 500 },
    } as ReturnType<typeof useAppConfig>);
    vi.mocked(useMaintenanceCards).mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useMaintenanceCards>);
  });

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

  it('shows a loading indicator when vehicles are loading', () => {
    vi.mocked(useVehicles).mockReturnValue({
      data: [],
      isLoading: true,
    } as ReturnType<typeof useVehicles>);
    render(
      <VehiclesLayout>
        <div>child</div>
      </VehiclesLayout>,
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders no vehicle links when vehicles array is empty', () => {
    vi.mocked(useVehicles).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useVehicles>);
    render(
      <VehiclesLayout>
        <div>child</div>
      </VehiclesLayout>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('marks the active vehicle link with aria-current="page"', () => {
    // usePathname is mocked to '/vehicles/v1' and vehicle id is 'v1' → isActive = true
    // registrationNumber 'ABC123' is used as primary label by getVehicleDisplayLabels
    render(
      <VehiclesLayout>
        <div>child</div>
      </VehiclesLayout>,
    );
    const activeLink = screen.getByRole('link', { name: /abc123/i });
    expect(activeLink).toHaveAttribute('aria-current', 'page');
  });

  it('shows overdue chip when vehicle has overdue maintenance cards', () => {
    const overdueCard: IMaintenanceCardResDTO = {
      id: 'card-1',
      vehicleId: 'v1',
      name: 'Oil Change',
      type: 'task',
      description: null,
      intervalMileage: 5000,
      intervalTimeMonths: null,
      nextDueMileage: 44000, // below vehicle mileage 45000 → overdue
      nextDueDate: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    vi.mocked(useMaintenanceCards).mockReturnValue({
      data: [overdueCard],
    } as unknown as ReturnType<typeof useMaintenanceCards>);
    render(
      <VehiclesLayout>
        <div>child</div>
      </VehiclesLayout>,
    );
    expect(screen.getByText('1 OVERDUE')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { IVehicleResDTO, IMaintenanceCardResDTO } from '@project/types';

vi.mock('@/components/auth/auth-guard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/vehicles/mileage-prompt', () => ({
  MileagePrompt: () => null,
}));

vi.mock('@/components/maintenance-cards/maintenance-card-row', () => ({
  MaintenanceCardRow: ({ card }: { card: IMaintenanceCardResDTO }) => (
    <div data-testid="maintenance-card-row">{card.name}</div>
  ),
}));

vi.mock('@/hooks/queries/vehicles/useVehicle', () => ({
  useVehicle: vi.fn(),
}));

vi.mock('@/hooks/queries/maintenance-cards/useMaintenanceCards', () => ({
  useMaintenanceCards: vi.fn(),
}));

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ replace: mockReplace })),
}));

import { useVehicle } from '@/hooks/queries/vehicles/useVehicle';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import { VehicleDashboardPage } from './vehicle-dashboard-page';

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

const mockCard1: IMaintenanceCardResDTO = {
  id: 'card-1',
  vehicleId: 'vehicle-1',
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

const mockCard2: IMaintenanceCardResDTO = {
  id: 'card-2',
  vehicleId: 'vehicle-1',
  type: 'part',
  name: 'Tire Rotation',
  description: null,
  intervalMileage: 10000,
  intervalTimeMonths: null,
  nextDueMileage: 60000,
  nextDueDate: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('VehicleDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReplace.mockReset();
  });

  it('shows loading state when vehicleLoading is true', () => {
    vi.mocked(useVehicle).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useVehicle>);
    vi.mocked(useMaintenanceCards).mockReturnValue({
      data: [] as IMaintenanceCardResDTO[],
      isLoading: false,
    } as unknown as ReturnType<typeof useMaintenanceCards>);

    render(<VehicleDashboardPage vehicleId="vehicle-1" />);

    expect(screen.getByText(/loading…/i)).toBeInTheDocument();
  });

  it('shows vehicle header with brand, model, colour, and mileage when vehicle loads', () => {
    vi.mocked(useVehicle).mockReturnValue({
      data: mockVehicle,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useVehicle>);
    vi.mocked(useMaintenanceCards).mockReturnValue({
      data: [] as IMaintenanceCardResDTO[],
      isLoading: false,
    } as unknown as ReturnType<typeof useMaintenanceCards>);

    render(<VehicleDashboardPage vehicleId="vehicle-1" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Toyota Camry',
    );
    expect(screen.getByText(/silver/i)).toBeInTheDocument();
    expect(screen.getByText(/50,000/)).toBeInTheDocument();
  });

  it('calls useMaintenanceCards with sort=name when Name button is clicked', () => {
    vi.mocked(useVehicle).mockReturnValue({
      data: mockVehicle,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useVehicle>);
    vi.mocked(useMaintenanceCards).mockReturnValue({
      data: [] as IMaintenanceCardResDTO[],
      isLoading: false,
    } as unknown as ReturnType<typeof useMaintenanceCards>);

    render(<VehicleDashboardPage vehicleId="vehicle-1" />);

    fireEvent.click(screen.getByRole('button', { name: /name/i }));

    expect(vi.mocked(useMaintenanceCards)).toHaveBeenCalledWith(
      'vehicle-1',
      'name',
    );
  });

  it('calls useMaintenanceCards with sort=urgency when Urgency button is clicked after switching to name', () => {
    vi.mocked(useVehicle).mockReturnValue({
      data: mockVehicle,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useVehicle>);
    vi.mocked(useMaintenanceCards).mockReturnValue({
      data: [] as IMaintenanceCardResDTO[],
      isLoading: false,
    } as unknown as ReturnType<typeof useMaintenanceCards>);

    render(<VehicleDashboardPage vehicleId="vehicle-1" />);

    // Switch to name first
    fireEvent.click(screen.getByRole('button', { name: /name/i }));
    // Switch back to urgency
    fireEvent.click(screen.getByRole('button', { name: /urgency/i }));

    expect(vi.mocked(useMaintenanceCards)).toHaveBeenCalledWith(
      'vehicle-1',
      'urgency',
    );
  });

  it('renders MaintenanceCardRow for each card when cards are returned', () => {
    vi.mocked(useVehicle).mockReturnValue({
      data: mockVehicle,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useVehicle>);
    vi.mocked(useMaintenanceCards).mockReturnValue({
      data: [mockCard1, mockCard2],
      isLoading: false,
    } as unknown as ReturnType<typeof useMaintenanceCards>);

    render(<VehicleDashboardPage vehicleId="vehicle-1" />);

    const rows = screen.getAllByTestId('maintenance-card-row');
    expect(rows).toHaveLength(2);
    expect(screen.getByText('Oil Change')).toBeInTheDocument();
    expect(screen.getByText('Tire Rotation')).toBeInTheDocument();
  });

  it('shows "No maintenance cards yet." when cards array is empty and not loading', () => {
    vi.mocked(useVehicle).mockReturnValue({
      data: mockVehicle,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useVehicle>);
    vi.mocked(useMaintenanceCards).mockReturnValue({
      data: [] as IMaintenanceCardResDTO[],
      isLoading: false,
    } as unknown as ReturnType<typeof useMaintenanceCards>);

    render(<VehicleDashboardPage vehicleId="vehicle-1" />);

    expect(screen.getByText(/no maintenance cards yet/i)).toBeInTheDocument();
  });

  it('shows "Loading cards…" when cardsLoading is true', () => {
    vi.mocked(useVehicle).mockReturnValue({
      data: mockVehicle,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useVehicle>);
    vi.mocked(useMaintenanceCards).mockReturnValue({
      data: [] as IMaintenanceCardResDTO[],
      isLoading: true,
    } as unknown as ReturnType<typeof useMaintenanceCards>);

    render(<VehicleDashboardPage vehicleId="vehicle-1" />);

    expect(screen.getByText(/loading cards…/i)).toBeInTheDocument();
  });

  it('calls router.replace("/") when isError is true and vehicleLoading is false', () => {
    vi.mocked(useVehicle).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as ReturnType<typeof useVehicle>);
    vi.mocked(useMaintenanceCards).mockReturnValue({
      data: [] as IMaintenanceCardResDTO[],
      isLoading: false,
    } as unknown as ReturnType<typeof useMaintenanceCards>);

    render(<VehicleDashboardPage vehicleId="vehicle-1" />);

    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});

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
  MaintenanceCardRow: ({
    card,
    onEdit,
    onMarkDone,
    onDelete,
  }: {
    card: IMaintenanceCardResDTO;
    isDropdownOpen: boolean;
    onDropdownToggle: (id: string | null) => void;
    onEdit: (card: IMaintenanceCardResDTO) => void;
    onMarkDone: (card: IMaintenanceCardResDTO) => void;
    onDelete: (card: IMaintenanceCardResDTO) => void;
  }) => (
    <div data-testid="maintenance-card-row">
      {card.name}
      <button onClick={() => onEdit(card)}>edit-{card.id}</button>
      <button onClick={() => onMarkDone(card)}>markdone-{card.id}</button>
      <button onClick={() => onDelete(card)}>delete-{card.id}</button>
    </div>
  ),
}));
vi.mock('@/components/maintenance-cards/maintenance-card-form-dialog', () => ({
  MaintenanceCardFormDialog: ({
    open,
    card,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    vehicleId: string;
    vehicleMileage: number;
    vehicleMileageUnit: string;
    card?: IMaintenanceCardResDTO;
  }) =>
    open ? (
      <div data-testid="form-dialog">{card ? `edit:${card.id}` : 'create'}</div>
    ) : null,
}));
vi.mock('@/components/maintenance-cards/mark-done-dialog', () => ({
  MarkDoneDialog: ({
    open,
    card,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    card: IMaintenanceCardResDTO;
    vehicleId: string;
  }) => (open ? <div data-testid="mark-done-dialog">{card.id}</div> : null),
}));
vi.mock('@/components/maintenance-cards/delete-confirm-dialog', () => ({
  DeleteConfirmDialog: ({
    open,
    card,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    card: IMaintenanceCardResDTO;
    vehicleId: string;
  }) => (open ? <div data-testid="delete-dialog">{card.id}</div> : null),
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

function setupVehicleLoaded(cards: IMaintenanceCardResDTO[] = []) {
  vi.mocked(useVehicle).mockReturnValue({
    data: mockVehicle,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useVehicle>);
  vi.mocked(useMaintenanceCards).mockReturnValue({
    data: cards,
    isLoading: false,
  } as unknown as ReturnType<typeof useMaintenanceCards>);
}

describe('VehicleDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReplace.mockReset();
  });

  // ── existing tests ──────────────────────────────────────────────────
  it('shows loading state when vehicleLoading is true', () => {
    vi.mocked(useVehicle).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useVehicle>);
    vi.mocked(useMaintenanceCards).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useMaintenanceCards>);

    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    expect(screen.getByText(/loading…/i)).toBeInTheDocument();
  });

  it('shows vehicle header when vehicle loads', () => {
    setupVehicleLoaded();
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Toyota Camry',
    );
    expect(screen.getByText(/silver/i)).toBeInTheDocument();
  });

  it('calls useMaintenanceCards with sort=name when Name button is clicked', () => {
    setupVehicleLoaded();
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    fireEvent.click(screen.getByRole('button', { name: /^name$/i }));
    expect(vi.mocked(useMaintenanceCards)).toHaveBeenCalledWith(
      'vehicle-1',
      'name',
    );
  });

  it('renders MaintenanceCardRow for each card', () => {
    setupVehicleLoaded([mockCard1, mockCard2]);
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    expect(screen.getAllByTestId('maintenance-card-row')).toHaveLength(2);
  });

  it('shows "No maintenance cards yet." when cards array is empty', () => {
    setupVehicleLoaded([]);
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    expect(screen.getByText(/no maintenance cards yet/i)).toBeInTheDocument();
  });

  it('calls router.replace("/") when isError is true', () => {
    vi.mocked(useVehicle).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as ReturnType<typeof useVehicle>);
    vi.mocked(useMaintenanceCards).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useMaintenanceCards>);

    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  // ── new FAB + dialog tests ──────────────────────────────────────────
  it('form dialog is not visible on initial render', () => {
    setupVehicleLoaded();
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    expect(screen.queryByTestId('form-dialog')).not.toBeInTheDocument();
  });

  it('renders the FAB button with aria-label "Add maintenance card"', () => {
    setupVehicleLoaded();
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    expect(
      screen.getByRole('button', { name: /add maintenance card/i }),
    ).toBeInTheDocument();
  });

  it('opens create form dialog when FAB is clicked', () => {
    setupVehicleLoaded();
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    fireEvent.click(
      screen.getByRole('button', { name: /add maintenance card/i }),
    );
    expect(screen.getByTestId('form-dialog')).toHaveTextContent('create');
  });

  it('opens edit form dialog with card when onEdit fires from a row', () => {
    setupVehicleLoaded([mockCard1]);
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    fireEvent.click(screen.getByText('edit-card-1'));
    const dialog = screen.getByTestId('form-dialog');
    expect(dialog).toHaveTextContent('edit:card-1');
  });

  it('opens mark-done dialog with card when onMarkDone fires from a row', () => {
    setupVehicleLoaded([mockCard1]);
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    fireEvent.click(screen.getByText('markdone-card-1'));
    expect(screen.getByTestId('mark-done-dialog')).toHaveTextContent('card-1');
  });

  it('opens delete dialog with card when onDelete fires from a row', () => {
    setupVehicleLoaded([mockCard1]);
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    fireEvent.click(screen.getByText('delete-card-1'));
    expect(screen.getByTestId('delete-dialog')).toHaveTextContent('card-1');
  });
});

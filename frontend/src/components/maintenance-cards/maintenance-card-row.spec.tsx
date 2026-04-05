import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { IMaintenanceCardResDTO, IVehicleResDTO } from '@project/types';

vi.mock('@/hooks/queries/config/useAppConfig', () => ({
  useAppConfig: vi.fn(),
}));
vi.mock('@/lib/warning', () => ({
  getCardWarningStatus: vi.fn(),
}));

import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { getCardWarningStatus } from '@/lib/warning';
import { MaintenanceCardRow } from './maintenance-card-row';

const mockVehicle: IVehicleResDTO = {
  id: 'vehicle-1',
  brand: 'Toyota',
  model: 'Camry',
  colour: 'Silver',
  mileage: 50000,
  mileageUnit: 'km',
  mileageLastUpdatedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockCard: IMaintenanceCardResDTO = {
  id: 'card-1',
  vehicleId: 'vehicle-1',
  name: 'Oil Change',
  type: 'task',
  description: null,
  intervalMileage: 5000,
  intervalTimeMonths: null,
  nextDueMileage: 51000,
  nextDueDate: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const defaultProps = {
  card: mockCard,
  vehicle: mockVehicle,
  isDropdownOpen: false,
  onDropdownToggle: vi.fn(),
  onEdit: vi.fn(),
  onMarkDone: vi.fn(),
  onDelete: vi.fn(),
};

describe('MaintenanceCardRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppConfig).mockReturnValue({
      data: { mileageWarningThresholdKm: 500 },
    } as ReturnType<typeof useAppConfig>);
    vi.mocked(getCardWarningStatus).mockReturnValue('ok');
  });

  it('renders card name and type badge', () => {
    render(<MaintenanceCardRow {...defaultProps} />);
    expect(screen.getByText('Oil Change')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
  });

  it('renders type badge for part type', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, type: 'part' }}
      />,
    );
    expect(screen.getByText('Part')).toBeInTheDocument();
  });

  it('renders type badge for item type', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, type: 'item' }}
      />,
    );
    expect(screen.getByText('Item')).toBeInTheDocument();
  });

  it('applies overdue classes when status is overdue', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('overdue');
    const { container } = render(<MaintenanceCardRow {...defaultProps} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('bg-destructive/10');
    expect(row.className).toContain('border-destructive/40');
  });

  it('applies warning classes when status is warning', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('warning');
    const { container } = render(<MaintenanceCardRow {...defaultProps} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('bg-yellow-50');
    expect(row.className).toContain('border-yellow-300');
  });

  it('does not apply overdue or warning classes when status is ok', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('ok');
    const { container } = render(<MaintenanceCardRow {...defaultProps} />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).not.toContain('bg-destructive/10');
    expect(row.className).not.toContain('bg-yellow-50');
  });

  it('shows remaining mileage label when nextDueMileage is set and remaining > 0', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 51000 }}
      />,
    );
    expect(screen.getByText('1,000 km left')).toBeInTheDocument();
  });

  it('shows OVERDUE label when remaining <= 0', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('overdue');
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 49000 }}
      />,
    );
    expect(screen.getByText('OVERDUE')).toBeInTheDocument();
  });

  it('shows no mileage label when nextDueMileage is null', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null }}
      />,
    );
    expect(screen.queryByText(/left/)).not.toBeInTheDocument();
    expect(screen.queryByText('OVERDUE')).not.toBeInTheDocument();
  });

  it('uses mileageWarningThresholdKm from config when calling getCardWarningStatus', () => {
    vi.mocked(useAppConfig).mockReturnValue({
      data: { mileageWarningThresholdKm: 750 },
    } as ReturnType<typeof useAppConfig>);
    render(<MaintenanceCardRow {...defaultProps} />);
    expect(vi.mocked(getCardWarningStatus)).toHaveBeenCalledWith(
      mockCard,
      mockVehicle.mileage,
      mockVehicle.mileageUnit,
      750,
    );
  });

  it('falls back to 500 threshold when config is undefined', () => {
    vi.mocked(useAppConfig).mockReturnValue({
      data: undefined,
    } as ReturnType<typeof useAppConfig>);
    render(<MaintenanceCardRow {...defaultProps} />);
    expect(vi.mocked(getCardWarningStatus)).toHaveBeenCalledWith(
      mockCard,
      mockVehicle.mileage,
      mockVehicle.mileageUnit,
      500,
    );
  });

  // ⋮ dropdown tests
  it('renders the ⋮ menu button', () => {
    render(<MaintenanceCardRow {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /actions/i }),
    ).toBeInTheDocument();
  });

  it('does not show dropdown items when isDropdownOpen is false', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        isDropdownOpen={false}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /mark done/i }),
    ).not.toBeInTheDocument();
  });

  it('shows Mark Done, Edit, Delete when isDropdownOpen is true', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        isDropdownOpen={true}
      />,
    );
    expect(
      screen.getByRole('button', { name: /mark done/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('calls onDropdownToggle with cardId when ⋮ button is clicked and dropdown is closed', () => {
    const onDropdownToggle = vi.fn();
    render(
      <MaintenanceCardRow
        {...defaultProps}
        isDropdownOpen={false}
        onDropdownToggle={onDropdownToggle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    expect(onDropdownToggle).toHaveBeenCalledWith('card-1');
  });

  it('calls onDropdownToggle with null when ⋮ button is clicked and dropdown is open', () => {
    const onDropdownToggle = vi.fn();
    render(
      <MaintenanceCardRow
        {...defaultProps}
        isDropdownOpen={true}
        onDropdownToggle={onDropdownToggle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    expect(onDropdownToggle).toHaveBeenCalledWith(null);
  });

  it('calls onMarkDone with the card when Mark Done is clicked', () => {
    const onMarkDone = vi.fn();
    render(
      <MaintenanceCardRow
        {...defaultProps}
        isDropdownOpen={true}
        onMarkDone={onMarkDone}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /mark done/i }));
    expect(onMarkDone).toHaveBeenCalledWith(mockCard);
  });

  it('calls onEdit with the card when Edit is clicked', () => {
    const onEdit = vi.fn();
    render(
      <MaintenanceCardRow
        {...defaultProps}
        isDropdownOpen={true}
        onEdit={onEdit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(mockCard);
  });

  it('calls onDelete with the card when Delete is clicked', () => {
    const onDelete = vi.fn();
    render(
      <MaintenanceCardRow
        {...defaultProps}
        isDropdownOpen={true}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(mockCard);
  });
});

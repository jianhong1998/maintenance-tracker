import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('MaintenanceCardRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppConfig).mockReturnValue({
      data: { mileageWarningThresholdKm: 500 },
    } as ReturnType<typeof useAppConfig>);
    vi.mocked(getCardWarningStatus).mockReturnValue('ok');
  });

  it('renders card name and type badge', () => {
    render(
      <MaintenanceCardRow
        card={mockCard}
        vehicle={mockVehicle}
      />,
    );

    expect(screen.getByText('Oil Change')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
  });

  it('renders type badge for part type', () => {
    const partCard = { ...mockCard, type: 'part' as const };
    render(
      <MaintenanceCardRow
        card={partCard}
        vehicle={mockVehicle}
      />,
    );

    expect(screen.getByText('Part')).toBeInTheDocument();
  });

  it('renders type badge for item type', () => {
    const itemCard = { ...mockCard, type: 'item' as const };
    render(
      <MaintenanceCardRow
        card={itemCard}
        vehicle={mockVehicle}
      />,
    );

    expect(screen.getByText('Item')).toBeInTheDocument();
  });

  it('applies overdue classes when status is overdue', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('overdue');

    const { container } = render(
      <MaintenanceCardRow
        card={mockCard}
        vehicle={mockVehicle}
      />,
    );

    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('bg-destructive/10');
    expect(row.className).toContain('border-destructive/40');
  });

  it('applies warning classes when status is warning', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('warning');

    const { container } = render(
      <MaintenanceCardRow
        card={mockCard}
        vehicle={mockVehicle}
      />,
    );

    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('bg-yellow-50');
    expect(row.className).toContain('border-yellow-300');
  });

  it('does not apply overdue or warning classes when status is ok', () => {
    vi.mocked(getCardWarningStatus).mockReturnValue('ok');

    const { container } = render(
      <MaintenanceCardRow
        card={mockCard}
        vehicle={mockVehicle}
      />,
    );

    const row = container.firstChild as HTMLElement;
    expect(row.className).not.toContain('bg-destructive/10');
    expect(row.className).not.toContain('bg-yellow-50');
  });

  it('shows remaining mileage label when nextDueMileage is set and remaining > 0', () => {
    const card = { ...mockCard, nextDueMileage: 51000 }; // 51000 - 50000 = 1000 km left
    render(
      <MaintenanceCardRow
        card={card}
        vehicle={mockVehicle}
      />,
    );

    expect(screen.getByText('1,000 km left')).toBeInTheDocument();
  });

  it('shows remaining mileage label with mile unit', () => {
    const mileVehicle = {
      ...mockVehicle,
      mileage: 30000,
      mileageUnit: 'mile' as const,
    };
    const card = { ...mockCard, nextDueMileage: 31000 }; // 1000 miles left
    render(
      <MaintenanceCardRow
        card={card}
        vehicle={mileVehicle}
      />,
    );

    expect(screen.getByText('1,000 mile left')).toBeInTheDocument();
  });

  it('shows OVERDUE label when remaining <= 0', () => {
    const card = { ...mockCard, nextDueMileage: 49000 }; // 49000 - 50000 = -1000 (overdue)
    vi.mocked(getCardWarningStatus).mockReturnValue('overdue');

    render(
      <MaintenanceCardRow
        card={card}
        vehicle={mockVehicle}
      />,
    );

    expect(screen.getByText('OVERDUE')).toBeInTheDocument();
  });

  it('shows no mileage label when nextDueMileage is null', () => {
    const card = { ...mockCard, nextDueMileage: null };
    render(
      <MaintenanceCardRow
        card={card}
        vehicle={mockVehicle}
      />,
    );

    expect(screen.queryByText(/left/)).not.toBeInTheDocument();
    expect(screen.queryByText('OVERDUE')).not.toBeInTheDocument();
  });

  it('uses mileageWarningThresholdKm from config when calling getCardWarningStatus', () => {
    vi.mocked(useAppConfig).mockReturnValue({
      data: { mileageWarningThresholdKm: 750 },
    } as ReturnType<typeof useAppConfig>);

    render(
      <MaintenanceCardRow
        card={mockCard}
        vehicle={mockVehicle}
      />,
    );

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

    render(
      <MaintenanceCardRow
        card={mockCard}
        vehicle={mockVehicle}
      />,
    );

    expect(vi.mocked(getCardWarningStatus)).toHaveBeenCalledWith(
      mockCard,
      mockVehicle.mileage,
      mockVehicle.mileageUnit,
      500,
    );
  });
});

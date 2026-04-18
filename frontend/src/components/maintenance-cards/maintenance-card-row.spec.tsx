import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { IMaintenanceCardResDTO, IVehicleResDTO } from '@project/types';

vi.mock('@/hooks/queries/config/useAppConfig', () => ({
  useAppConfig: vi.fn(),
}));

import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { MaintenanceCardRow } from './maintenance-card-row';

const FIXED_TODAY = new Date('2026-04-18T12:00:00');

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_TODAY);
  vi.mocked(useAppConfig).mockReturnValue({
    data: { mileageWarningThresholdKm: 500, notificationDaysBefore: 7 },
  } as ReturnType<typeof useAppConfig>);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MaintenanceCardRow — card chrome', () => {
  it('renders card name and type badge', () => {
    render(<MaintenanceCardRow {...defaultProps} />);
    expect(screen.getByText('Oil Change')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
  });

  it('applies overdue container classes when either axis is overdue', () => {
    const { container } = render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 49000 }}
      />,
    );
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('bg-[#ff44440a]');
    expect(row.className).toContain('border-[#ff444328]');
  });

  it('applies warning container classes when overall tier is warning', () => {
    const { container } = render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 50400 }}
      />,
    );
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('border-[#f59e0b28]');
  });

  it('applies healthy container classes when overall tier is ok', () => {
    const { container } = render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 60000 }}
      />,
    );
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('border-[#00e5ff15]');
  });
});

describe('MaintenanceCardRow — mileage label', () => {
  it('shows "N unit left" when mileage is ok/warning', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 51000 }}
      />,
    );
    expect(screen.getByText('1,000 km left')).toBeInTheDocument();
  });

  it('shows "N unit past due" when mileage is overdue', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 49000 }}
      />,
    );
    expect(screen.getByText('1,000 km past due')).toBeInTheDocument();
  });

  it('omits mileage label when nextDueMileage is null', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null }}
      />,
    );
    expect(screen.queryByText(/km left/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/km past due/i)).not.toBeInTheDocument();
  });

  it('uses mile unit for mile-unit vehicles', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        vehicle={{ ...mockVehicle, mileageUnit: 'mile', mileage: 31000 }}
        card={{ ...mockCard, nextDueMileage: 32000 }}
      />,
    );
    expect(screen.getByText('1,000 mile left')).toBeInTheDocument();
  });
});

describe('MaintenanceCardRow — date label', () => {
  it('shows "5 days left" when daysUntilDue is 5', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-23' }}
      />,
    );
    expect(screen.getByText('5 days left')).toBeInTheDocument();
  });

  it('shows "1 day left" (singular) when daysUntilDue is 1', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-19' }}
      />,
    );
    expect(screen.getByText('1 day left')).toBeInTheDocument();
  });

  it('shows "Due today" when daysUntilDue is 0', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-18' }}
      />,
    );
    expect(screen.getByText('Due today')).toBeInTheDocument();
  });

  it('shows "3 days overdue" when daysUntilDue is -3', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-15' }}
      />,
    );
    expect(screen.getByText('3 days overdue')).toBeInTheDocument();
  });

  it('shows "1 day overdue" (singular) when daysUntilDue is -1', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-17' }}
      />,
    );
    expect(screen.getByText('1 day overdue')).toBeInTheDocument();
  });

  it('omits date label when nextDueDate is null', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueDate: null }}
      />,
    );
    expect(screen.queryByText(/days left/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/due today/i)).not.toBeInTheDocument();
  });
});

describe('MaintenanceCardRow — per-axis label colours', () => {
  it('uses cyan for date label when daysUntilDue is within 3× threshold but > threshold', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-05-02' }}
      />,
    );
    const label = screen.getByText('14 days left');
    expect(label.className).toContain('text-[#00e5ff]');
  });

  it('uses muted grey for date label when daysUntilDue > 3× threshold', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-05-10' }}
      />,
    );
    const label = screen.getByText('22 days left');
    expect(label.className).toContain('text-[#555]');
  });

  it('uses destructive red for overdue date label', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-10' }}
      />,
    );
    const label = screen.getByText('8 days overdue');
    expect(label.className).toContain('text-[#ff4444]');
  });

  it('uses amber for warning date label', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-22' }}
      />,
    );
    const label = screen.getByText('4 days left');
    expect(label.className).toContain('text-[#f59e0b]');
  });

  it('colours the two labels independently when one axis is ok and the other is overdue', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{
          ...mockCard,
          nextDueMileage: 60000,
          nextDueDate: '2020-01-01',
        }}
      />,
    );
    const mileageLabel = screen.getByText('10,000 km left');
    const dateLabel = screen.getByText(/days overdue/i);
    expect(mileageLabel.className).toContain('text-[#555]');
    expect(dateLabel.className).toContain('text-[#ff4444]');
  });
});

describe('MaintenanceCardRow — progress bar', () => {
  it('renders a progress bar track when nextDueMileage is set', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 51000 }}
      />,
    );
    expect(screen.getByTestId('progress-bar-track')).toBeInTheDocument();
  });

  it('does not render a progress bar when nextDueMileage is null', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-05-01' }}
      />,
    );
    expect(screen.queryByTestId('progress-bar-track')).not.toBeInTheDocument();
  });

  it('bar colour follows the mileage axis even when overall is overdue due to date', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{
          ...mockCard,
          nextDueMileage: 60000,
          nextDueDate: '2020-01-01',
        }}
      />,
    );
    const fill = document.querySelector(
      '[data-testid="progress-bar-track"] > div',
    ) as HTMLElement;
    expect(fill.className).toContain('from-[#00e5ff40]');
    expect(fill.className).not.toContain('bg-[#ff4444]');
  });
});

describe('MaintenanceCardRow — no-axis card', () => {
  it('renders neither label stack nor progress bar when both axes are null', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: null }}
      />,
    );
    expect(
      screen.queryByText(/left|overdue|today|past due/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('progress-bar-track')).not.toBeInTheDocument();
  });
});

describe('MaintenanceCardRow — config fallbacks', () => {
  it('falls back to 500 km threshold when config is undefined', () => {
    vi.mocked(useAppConfig).mockReturnValue({
      data: undefined,
    } as ReturnType<typeof useAppConfig>);
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: 50400 }}
      />,
    );
    const label = screen.getByText('400 km left');
    expect(label.className).toContain('text-[#f59e0b]');
  });

  it('falls back to 7-day threshold when config is undefined', () => {
    vi.mocked(useAppConfig).mockReturnValue({
      data: undefined,
    } as ReturnType<typeof useAppConfig>);
    render(
      <MaintenanceCardRow
        {...defaultProps}
        card={{ ...mockCard, nextDueMileage: null, nextDueDate: '2026-04-25' }}
      />,
    );
    const label = screen.getByText('7 days left');
    expect(label.className).toContain('text-[#f59e0b]');
  });
});

describe('MaintenanceCardRow — dropdown', () => {
  it('renders the ⋮ menu button', () => {
    render(<MaintenanceCardRow {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /actions/i }),
    ).toBeInTheDocument();
  });

  it('shows Mark Done, Edit, Delete when isDropdownOpen is true', () => {
    render(
      <MaintenanceCardRow
        {...defaultProps}
        isDropdownOpen={true}
      />,
    );
    expect(
      screen.getByRole('menuitem', { name: /mark done/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /edit/i })).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /delete/i }),
    ).toBeInTheDocument();
  });

  it('calls onDropdownToggle with cardId when ⋮ clicked and closed', () => {
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

  it('calls onMarkDone when Mark Done is clicked', () => {
    const onMarkDone = vi.fn();
    render(
      <MaintenanceCardRow
        {...defaultProps}
        isDropdownOpen={true}
        onMarkDone={onMarkDone}
      />,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: /mark done/i }));
    expect(onMarkDone).toHaveBeenCalledWith(mockCard);
  });
});

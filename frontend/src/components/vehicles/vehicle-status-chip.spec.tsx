import { render, screen } from '@testing-library/react';
import { VehicleStatusChip } from './vehicle-status-chip';

describe('VehicleStatusChip', () => {
  it('renders "ALL GOOD" when count is 0', () => {
    render(<VehicleStatusChip count={0} />);
    expect(screen.getByText('ALL GOOD')).toBeInTheDocument();
  });

  it('renders "{count} AT RISK" when count is greater than 0', () => {
    render(<VehicleStatusChip count={3} />);
    expect(screen.getByText('3 AT RISK')).toBeInTheDocument();
  });

  it('renders with warning testid when count is greater than 0', () => {
    render(<VehicleStatusChip count={1} />);
    expect(screen.getByTestId('status-chip-warning')).toBeInTheDocument();
  });

  it('renders with ok testid when count is 0', () => {
    render(<VehicleStatusChip count={0} />);
    expect(screen.getByTestId('status-chip-ok')).toBeInTheDocument();
  });
});

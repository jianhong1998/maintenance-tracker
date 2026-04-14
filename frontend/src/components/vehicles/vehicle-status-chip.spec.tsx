import { render, screen } from '@testing-library/react';
import { VehicleStatusChip } from './vehicle-status-chip';

describe('VehicleStatusChip', () => {
  it('renders "ALL GOOD" when count is 0', () => {
    render(<VehicleStatusChip count={0} />);
    expect(screen.getByText('ALL GOOD')).toBeInTheDocument();
  });

  it('renders "{count} OVERDUE" when count is greater than 0', () => {
    render(<VehicleStatusChip count={3} />);
    expect(screen.getByText('3 OVERDUE')).toBeInTheDocument();
  });

  it('applies danger classes when overdue', () => {
    const { container } = render(<VehicleStatusChip count={1} />);
    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toContain('text-[#ff4444]');
  });

  it('applies primary classes when all good', () => {
    const { container } = render(<VehicleStatusChip count={0} />);
    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toContain('text-[#00e5ff]');
  });
});

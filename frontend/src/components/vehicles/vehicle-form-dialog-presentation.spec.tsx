import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    onOpenChange: (v: boolean) => void;
    children: React.ReactNode;
  }) =>
    open ? (
      <div
        role="dialog"
        aria-label={title}
      >
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

import { VehicleFormDialogPresentation } from './vehicle-form-dialog-presentation';

type Props = React.ComponentProps<typeof VehicleFormDialogPresentation>;

const defaultProps: Props = {
  open: true,
  onOpenChange: vi.fn(),
  registrationNumber: '',
  brand: '',
  model: '',
  colour: '',
  mileage: '',
  mileageUnit: 'km',
  onRegistrationNumberChange: vi.fn(),
  onBrandChange: vi.fn(),
  onModelChange: vi.fn(),
  onColourChange: vi.fn(),
  onMileageChange: vi.fn(),
  onMileageUnitChange: vi.fn(),
  isEdit: false,
  isValid: false,
  isPending: false,
  unitLocked: false,
  isMileageBelowCurrent: false,
  currentVehicleMileage: undefined,
  handleSave: vi.fn(),
};

describe('VehicleFormDialogPresentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dialog title', () => {
    it('shows "Add Vehicle" when isEdit is false', () => {
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          isEdit={false}
        />,
      );
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
        'Add Vehicle',
      );
    });

    it('shows "Edit Vehicle" when isEdit is true', () => {
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          isEdit={true}
        />,
      );
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
        'Edit Vehicle',
      );
    });
  });

  describe('registration number field', () => {
    it('renders the registration number field', () => {
      render(<VehicleFormDialogPresentation {...defaultProps} />);
      expect(
        screen.getByLabelText(/vehicle registration number/i),
      ).toBeInTheDocument();
    });

    it('shows (0/15) counter when registrationNumber is empty', () => {
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          registrationNumber=""
        />,
      );
      expect(screen.getByText(/\(0\/15\)/)).toBeInTheDocument();
    });

    it('shows (8/15) counter when registrationNumber has 8 characters', () => {
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          registrationNumber="FBA1234A"
        />,
      );
      expect(screen.getByText(/\(8\/15\)/)).toBeInTheDocument();
    });

    it('calls onRegistrationNumberChange when field changes', () => {
      const onRegistrationNumberChange = vi.fn();
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          onRegistrationNumberChange={onRegistrationNumberChange}
        />,
      );
      fireEvent.change(screen.getByLabelText(/vehicle registration number/i), {
        target: { value: 'SBC1234Z' },
      });
      expect(onRegistrationNumberChange).toHaveBeenCalledWith('SBC1234Z');
    });
  });

  describe('mileage validation error', () => {
    it('shows mileage error when isMileageBelowCurrent is true', () => {
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          isMileageBelowCurrent={true}
          currentVehicleMileage={85000}
          mileage="80000"
        />,
      );
      expect(
        screen.getByText(
          /cannot reduce mileage below current value \(85000\)/i,
        ),
      ).toBeInTheDocument();
    });

    it('does not show mileage error when isMileageBelowCurrent is false', () => {
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          isMileageBelowCurrent={false}
          currentVehicleMileage={85000}
        />,
      );
      expect(
        screen.queryByText(/cannot reduce mileage below current value/i),
      ).not.toBeInTheDocument();
    });
  });

  describe('Save button', () => {
    it('is disabled when isValid is false', () => {
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          isValid={false}
        />,
      );
      expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    });

    it('is enabled when isValid is true', () => {
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          isValid={true}
        />,
      );
      expect(
        screen.getByRole('button', { name: /^save$/i }),
      ).not.toBeDisabled();
    });

    it('is disabled when isPending is true even if isValid is true', () => {
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          isValid={true}
          isPending={true}
        />,
      );
      expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    });

    it('calls handleSave when clicked and form is valid', () => {
      const handleSave = vi.fn();
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          isValid={true}
          handleSave={handleSave}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      expect(handleSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cancel button', () => {
    it('calls onOpenChange(false) when clicked', () => {
      const onOpenChange = vi.fn();
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          onOpenChange={onOpenChange}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('is disabled when isPending is true', () => {
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          isPending={true}
        />,
      );
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    });
  });

  describe('unit selector', () => {
    it('unit buttons are enabled when unitLocked is false', () => {
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          unitLocked={false}
        />,
      );
      expect(screen.getByRole('button', { name: 'km' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'mile' })).not.toBeDisabled();
    });

    it('unit buttons are disabled when unitLocked is true', () => {
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          unitLocked={true}
        />,
      );
      expect(screen.getByRole('button', { name: 'km' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'mile' })).toBeDisabled();
    });

    it('shows locked hint text when unitLocked is true', () => {
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          unitLocked={true}
        />,
      );
      expect(
        screen.getByText(/delete all maintenance cards to edit this/i),
      ).toBeInTheDocument();
    });

    it('does not show locked hint text when unitLocked is false', () => {
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          unitLocked={false}
        />,
      );
      expect(
        screen.queryByText(/delete all maintenance cards to edit this/i),
      ).not.toBeInTheDocument();
    });

    it('calls onMileageUnitChange when a unit button is clicked', () => {
      const onMileageUnitChange = vi.fn();
      render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          onMileageUnitChange={onMileageUnitChange}
          mileageUnit="km"
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'mile' }));
      expect(onMileageUnitChange).toHaveBeenCalledWith('mile');
    });
  });

  describe('renders nothing when closed', () => {
    it('renders null when open is false', () => {
      const { container } = render(
        <VehicleFormDialogPresentation
          {...defaultProps}
          open={false}
        />,
      );
      expect(
        container.querySelector('[role="dialog"]'),
      ).not.toBeInTheDocument();
    });
  });
});

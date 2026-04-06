# VehicleFormDialog Container/Presentation Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `VehicleFormDialog` into a `useVehicleForm` hook (state + logic), a `VehicleFormDialogPresentation` component (pure rendering), and a thin container connector — satisfying the project's single-responsibility frontend convention.

**Architecture:** Extract all state, effects, mutations, and derived values into `useVehicleForm`. Move all JSX into `VehicleFormDialogPresentation` which accepts a flat props surface. `VehicleFormDialog` becomes a 10-line connector that wires the two together. No behavioral change — existing `vehicle-form-dialog.spec.tsx` tests must continue to pass unchanged.

**Tech Stack:** React, TypeScript, Vitest, `@testing-library/react` (`renderHook`, `act`, `render`, `fireEvent`), TanStack Query mutation hooks (mocked in tests).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/components/vehicles/use-vehicle-form.ts` | **Create** | All state, effects, mutations, derived values, `handleSave` |
| `frontend/src/components/vehicles/use-vehicle-form.spec.ts` | **Create** | Unit tests for hook logic |
| `frontend/src/components/vehicles/vehicle-form-dialog-presentation.tsx` | **Create** | Pure JSX rendering, no hooks |
| `frontend/src/components/vehicles/vehicle-form-dialog-presentation.spec.tsx` | **Create** | Rendering tests with mocked props |
| `frontend/src/components/vehicles/vehicle-form-dialog.tsx` | **Modify** | Thin connector only |
| `frontend/src/components/vehicles/vehicle-form-dialog.spec.tsx` | **Unchanged** | Integration tests — must pass as-is |

---

## Task 1: Create `useVehicleForm` hook (TDD)

**Files:**
- Create: `frontend/src/components/vehicles/use-vehicle-form.ts`
- Create: `frontend/src/components/vehicles/use-vehicle-form.spec.ts`

---

- [ ] **Step 1.1: Write failing tests for hook initialization and field reset**

Create `frontend/src/components/vehicles/use-vehicle-form.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { IVehicleResDTO } from '@project/types';

vi.mock('@/hooks/mutations/vehicles/useCreateVehicle', () => ({
  useCreateVehicle: vi.fn(),
}));
vi.mock('@/hooks/mutations/vehicles/usePatchVehicle', () => ({
  usePatchVehicle: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useCreateVehicle } from '@/hooks/mutations/vehicles/useCreateVehicle';
import { usePatchVehicle } from '@/hooks/mutations/vehicles/usePatchVehicle';
import { toast } from 'sonner';
import { useVehicleForm } from './use-vehicle-form';

const mockCreateMutate = vi.fn();
const mockPatchMutate = vi.fn();

const mockVehicle: IVehicleResDTO = {
  id: 'v1',
  brand: 'Toyota',
  model: 'Corolla',
  colour: 'Silver',
  mileage: 85000,
  mileageUnit: 'km',
  mileageLastUpdatedAt: null,
  registrationNumber: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('useVehicleForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateVehicle).mockReturnValue({
      mutate: mockCreateMutate,
      isPending: false,
    } as ReturnType<typeof useCreateVehicle>);
    vi.mocked(usePatchVehicle).mockReturnValue({
      mutate: mockPatchMutate,
      isPending: false,
    } as ReturnType<typeof usePatchVehicle>);
  });

  describe('initialization', () => {
    it('starts with empty fields when no vehicle is provided and open becomes true', () => {
      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: undefined, hasCards: false, onOpenChange: vi.fn() }),
      );
      expect(result.current.brand).toBe('');
      expect(result.current.model).toBe('');
      expect(result.current.colour).toBe('');
      expect(result.current.mileage).toBe('');
      expect(result.current.registrationNumber).toBe('');
      expect(result.current.mileageUnit).toBe('km');
    });

    it('pre-fills fields from vehicle when open becomes true in edit mode', () => {
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({ open, vehicle: mockVehicle, hasCards: false, onOpenChange: vi.fn() }),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      expect(result.current.brand).toBe('Toyota');
      expect(result.current.model).toBe('Corolla');
      expect(result.current.colour).toBe('Silver');
      expect(result.current.mileage).toBe('85000');
      expect(result.current.mileageUnit).toBe('km');
    });

    it('pre-fills registrationNumber from vehicle when present', () => {
      const vehicleWithReg = { ...mockVehicle, registrationNumber: 'FBA1234Z' };
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({ open, vehicle: vehicleWithReg, hasCards: false, onOpenChange: vi.fn() }),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      expect(result.current.registrationNumber).toBe('FBA1234Z');
    });

    it('does not reset fields when open is false', () => {
      const { result } = renderHook(() =>
        useVehicleForm({ open: false, vehicle: mockVehicle, hasCards: false, onOpenChange: vi.fn() }),
      );
      // open=false → useEffect condition `if (open)` skipped → fields stay at initial empty
      expect(result.current.brand).toBe('');
    });
  });

  describe('isEdit', () => {
    it('returns false when no vehicle is provided', () => {
      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: undefined, hasCards: false, onOpenChange: vi.fn() }),
      );
      expect(result.current.isEdit).toBe(false);
    });

    it('returns true when a vehicle is provided', () => {
      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: mockVehicle, hasCards: false, onOpenChange: vi.fn() }),
      );
      expect(result.current.isEdit).toBe(true);
    });
  });

  describe('isValid', () => {
    it('is false when required fields are empty', () => {
      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: undefined, hasCards: false, onOpenChange: vi.fn() }),
      );
      expect(result.current.isValid).toBe(false);
    });

    it('is true when all required fields are filled with valid mileage', () => {
      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: undefined, hasCards: false, onOpenChange: vi.fn() }),
      );
      act(() => {
        result.current.onBrandChange('Toyota');
        result.current.onModelChange('Corolla');
        result.current.onColourChange('Silver');
        result.current.onMileageChange('85000');
      });
      expect(result.current.isValid).toBe(true);
    });

    it('is false when mileage is non-numeric', () => {
      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: undefined, hasCards: false, onOpenChange: vi.fn() }),
      );
      act(() => {
        result.current.onBrandChange('Toyota');
        result.current.onModelChange('Corolla');
        result.current.onColourChange('Silver');
        result.current.onMileageChange('abc');
      });
      expect(result.current.isValid).toBe(false);
    });

    it('is false when mileage is below current vehicle mileage in edit mode', () => {
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({ open, vehicle: mockVehicle, hasCards: false, onOpenChange: vi.fn() }),
        { initialProps: { open: false } },
      );
      rerender({ open: true }); // pre-fills mileage to '85000'
      act(() => {
        result.current.onMileageChange('80000');
      });
      expect(result.current.isValid).toBe(false);
    });
  });

  describe('isMileageBelowCurrent', () => {
    it('is false in create mode regardless of mileage', () => {
      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: undefined, hasCards: false, onOpenChange: vi.fn() }),
      );
      act(() => {
        result.current.onMileageChange('0');
      });
      expect(result.current.isMileageBelowCurrent).toBe(false);
    });

    it('is true when mileage is below current vehicle mileage in edit mode', () => {
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({ open, vehicle: mockVehicle, hasCards: false, onOpenChange: vi.fn() }),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      act(() => {
        result.current.onMileageChange('80000');
      });
      expect(result.current.isMileageBelowCurrent).toBe(true);
    });

    it('is false when mileage equals current vehicle mileage in edit mode', () => {
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({ open, vehicle: mockVehicle, hasCards: false, onOpenChange: vi.fn() }),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      expect(result.current.isMileageBelowCurrent).toBe(false);
    });
  });

  describe('unitLocked', () => {
    it('is false in create mode', () => {
      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: undefined, hasCards: true, onOpenChange: vi.fn() }),
      );
      expect(result.current.unitLocked).toBe(false);
    });

    it('is false in edit mode when hasCards is false', () => {
      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: mockVehicle, hasCards: false, onOpenChange: vi.fn() }),
      );
      expect(result.current.unitLocked).toBe(false);
    });

    it('is true in edit mode when hasCards is true', () => {
      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: mockVehicle, hasCards: true, onOpenChange: vi.fn() }),
      );
      expect(result.current.unitLocked).toBe(true);
    });
  });

  describe('currentVehicleMileage', () => {
    it('is undefined in create mode', () => {
      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: undefined, hasCards: false, onOpenChange: vi.fn() }),
      );
      expect(result.current.currentVehicleMileage).toBeUndefined();
    });

    it('returns vehicle mileage in edit mode', () => {
      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: mockVehicle, hasCards: false, onOpenChange: vi.fn() }),
      );
      expect(result.current.currentVehicleMileage).toBe(85000);
    });
  });

  describe('handleSave', () => {
    it('calls createMutation.mutate with correct payload in create mode', () => {
      const onOpenChange = vi.fn();
      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: undefined, hasCards: false, onOpenChange }),
      );
      act(() => {
        result.current.onBrandChange('Toyota');
        result.current.onModelChange('Corolla');
        result.current.onColourChange('Silver');
        result.current.onMileageChange('85000');
      });
      act(() => {
        result.current.handleSave();
      });
      expect(mockCreateMutate).toHaveBeenCalledWith(
        {
          brand: 'Toyota',
          model: 'Corolla',
          colour: 'Silver',
          mileage: 85000,
          mileageUnit: 'km',
          registrationNumber: undefined,
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
      expect(mockPatchMutate).not.toHaveBeenCalled();
    });

    it('sends registrationNumber as string in create mode when field is filled', () => {
      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: undefined, hasCards: false, onOpenChange: vi.fn() }),
      );
      act(() => {
        result.current.onRegistrationNumberChange('ABC123');
        result.current.onBrandChange('Toyota');
        result.current.onModelChange('Corolla');
        result.current.onColourChange('Silver');
        result.current.onMileageChange('85000');
      });
      act(() => {
        result.current.handleSave();
      });
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ registrationNumber: 'ABC123' }),
        expect.any(Object),
      );
    });

    it('calls patchMutation.mutate with correct payload in edit mode', () => {
      const onOpenChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({ open, vehicle: mockVehicle, hasCards: false, onOpenChange }),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      act(() => {
        result.current.handleSave();
      });
      expect(mockPatchMutate).toHaveBeenCalledWith(
        {
          brand: 'Toyota',
          model: 'Corolla',
          colour: 'Silver',
          mileage: 85000,
          mileageUnit: 'km',
          registrationNumber: null,
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
      expect(mockCreateMutate).not.toHaveBeenCalled();
    });

    it('sends registrationNumber as null in edit mode when field is empty', () => {
      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({ open, vehicle: { ...mockVehicle, registrationNumber: 'FBA1234Z' }, hasCards: false, onOpenChange: vi.fn() }),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      act(() => {
        result.current.onRegistrationNumberChange('');
      });
      act(() => {
        result.current.handleSave();
      });
      expect(mockPatchMutate).toHaveBeenCalledWith(
        expect.objectContaining({ registrationNumber: null }),
        expect.any(Object),
      );
    });

    it('calls toast.success and onOpenChange(false) on create success', () => {
      const onOpenChange = vi.fn();
      vi.mocked(useCreateVehicle).mockReturnValue({
        mutate: (_data: unknown, opts: { onSuccess: () => void }) => opts.onSuccess(),
        isPending: false,
      } as ReturnType<typeof useCreateVehicle>);

      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: undefined, hasCards: false, onOpenChange }),
      );
      act(() => {
        result.current.onBrandChange('Toyota');
        result.current.onModelChange('Corolla');
        result.current.onColourChange('Silver');
        result.current.onMileageChange('85000');
      });
      act(() => {
        result.current.handleSave();
      });
      expect(toast.success).toHaveBeenCalledWith('Vehicle created');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('calls toast.success("Vehicle updated") and onOpenChange(false) on edit success', () => {
      const onOpenChange = vi.fn();
      vi.mocked(usePatchVehicle).mockReturnValue({
        mutate: (_data: unknown, opts: { onSuccess: () => void }) => opts.onSuccess(),
        isPending: false,
      } as ReturnType<typeof usePatchVehicle>);

      const { result, rerender } = renderHook(
        ({ open }: { open: boolean }) =>
          useVehicleForm({ open, vehicle: mockVehicle, hasCards: false, onOpenChange }),
        { initialProps: { open: false } },
      );
      rerender({ open: true });
      act(() => {
        result.current.handleSave();
      });
      expect(toast.success).toHaveBeenCalledWith('Vehicle updated');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('calls toast.error with error message on mutation failure', () => {
      vi.mocked(useCreateVehicle).mockReturnValue({
        mutate: (_data: unknown, opts: { onError: (err: Error) => void }) =>
          opts.onError(new Error('Server error')),
        isPending: false,
      } as ReturnType<typeof useCreateVehicle>);

      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: undefined, hasCards: false, onOpenChange: vi.fn() }),
      );
      act(() => {
        result.current.onBrandChange('Toyota');
        result.current.onModelChange('Corolla');
        result.current.onColourChange('Silver');
        result.current.onMileageChange('85000');
      });
      act(() => {
        result.current.handleSave();
      });
      expect(toast.error).toHaveBeenCalledWith('Server error');
    });

    it('falls back to "Something went wrong" when error message is empty', () => {
      vi.mocked(useCreateVehicle).mockReturnValue({
        mutate: (_data: unknown, opts: { onError: (err: Error) => void }) =>
          opts.onError(new Error('')),
        isPending: false,
      } as ReturnType<typeof useCreateVehicle>);

      const { result } = renderHook(() =>
        useVehicleForm({ open: true, vehicle: undefined, hasCards: false, onOpenChange: vi.fn() }),
      );
      act(() => {
        result.current.onBrandChange('Toyota');
        result.current.onModelChange('Corolla');
        result.current.onColourChange('Silver');
        result.current.onMileageChange('85000');
      });
      act(() => {
        result.current.handleSave();
      });
      expect(toast.error).toHaveBeenCalledWith('Something went wrong');
    });
  });
});
```

- [ ] **Step 1.2: Run the failing test to verify it fails**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/use-vehicle-form.spec.ts
```

Expected: FAIL — `Cannot find module './use-vehicle-form'`

- [ ] **Step 1.3: Create `use-vehicle-form.ts` with the implementation**

Create `frontend/src/components/vehicles/use-vehicle-form.ts`:

```typescript
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { IVehicleResDTO } from '@project/types';
import { MILEAGE_UNITS } from '@project/types';
import { useCreateVehicle } from '@/hooks/mutations/vehicles/useCreateVehicle';
import { usePatchVehicle } from '@/hooks/mutations/vehicles/usePatchVehicle';

type UseVehicleFormParams = {
  open: boolean;
  vehicle?: IVehicleResDTO;
  hasCards?: boolean;
  onOpenChange: (open: boolean) => void;
};

export const useVehicleForm = ({
  open,
  vehicle,
  hasCards = false,
  onOpenChange,
}: UseVehicleFormParams) => {
  const isEdit = !!vehicle;

  const [registrationNumber, setRegistrationNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [colour, setColour] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageUnit, setMileageUnit] = useState<'km' | 'mile'>(MILEAGE_UNITS.KM);

  useEffect(() => {
    if (open) {
      setRegistrationNumber(vehicle?.registrationNumber ?? '');
      setBrand(vehicle?.brand ?? '');
      setModel(vehicle?.model ?? '');
      setColour(vehicle?.colour ?? '');
      setMileage(vehicle?.mileage?.toString() ?? '');
      setMileageUnit(vehicle?.mileageUnit ?? MILEAGE_UNITS.KM);
    }
  }, [open, vehicle]);

  // Both hooks must be called unconditionally (Rules of Hooks).
  // Only one fires per save depending on isEdit.
  const createMutation = useCreateVehicle();
  const patchMutation = usePatchVehicle(vehicle?.id ?? '');

  const parsedMileage = parseFloat(mileage);
  const isMileageBelowCurrent =
    isEdit && !isNaN(parsedMileage) && parsedMileage < vehicle!.mileage;

  const isValid =
    brand.trim().length > 0 &&
    model.trim().length > 0 &&
    colour.trim().length > 0 &&
    !isNaN(parsedMileage) &&
    parsedMileage >= 0 &&
    !isMileageBelowCurrent;

  const isPending = createMutation.isPending || patchMutation.isPending;
  const unitLocked = isEdit && hasCards;

  const handleSave = () => {
    const trimmedReg = registrationNumber.trim();
    const commonPayload = {
      brand: brand.trim(),
      model: model.trim(),
      colour: colour.trim(),
      mileage: parsedMileage,
      mileageUnit,
    };
    const callbacks = {
      onSuccess: () => {
        toast.success(isEdit ? 'Vehicle updated' : 'Vehicle created');
        onOpenChange(false);
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Something went wrong');
      },
    };

    if (isEdit) {
      patchMutation.mutate(
        { ...commonPayload, registrationNumber: trimmedReg || null },
        callbacks,
      );
    } else {
      createMutation.mutate(
        { ...commonPayload, registrationNumber: trimmedReg || undefined },
        callbacks,
      );
    }
  };

  return {
    registrationNumber,
    brand,
    model,
    colour,
    mileage,
    mileageUnit,
    onRegistrationNumberChange: setRegistrationNumber,
    onBrandChange: setBrand,
    onModelChange: setModel,
    onColourChange: setColour,
    onMileageChange: setMileage,
    onMileageUnitChange: setMileageUnit,
    isEdit,
    isValid,
    isPending,
    unitLocked,
    isMileageBelowCurrent,
    currentVehicleMileage: vehicle?.mileage,
    handleSave,
  };
};
```

- [ ] **Step 1.4: Run the test to verify it passes**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/use-vehicle-form.spec.ts
```

Expected: all tests PASS

- [ ] **Step 1.5: Commit**

```bash
git add frontend/src/components/vehicles/use-vehicle-form.ts \
        frontend/src/components/vehicles/use-vehicle-form.spec.ts
git commit -m "extract useVehicleForm hook from VehicleFormDialog"
```

---

## Task 2: Create `VehicleFormDialogPresentation` (TDD)

**Files:**
- Create: `frontend/src/components/vehicles/vehicle-form-dialog-presentation.tsx`
- Create: `frontend/src/components/vehicles/vehicle-form-dialog-presentation.spec.tsx`

---

- [ ] **Step 2.1: Write failing tests for the presentation component**

Create `frontend/src/components/vehicles/vehicle-form-dialog-presentation.spec.tsx`:

```typescript
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
      <div role="dialog" aria-label={title}>
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
      render(<VehicleFormDialogPresentation {...defaultProps} isEdit={false} />);
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Add Vehicle');
    });

    it('shows "Edit Vehicle" when isEdit is true', () => {
      render(<VehicleFormDialogPresentation {...defaultProps} isEdit={true} />);
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Edit Vehicle');
    });
  });

  describe('registration number field', () => {
    it('renders the registration number field', () => {
      render(<VehicleFormDialogPresentation {...defaultProps} />);
      expect(screen.getByLabelText(/vehicle registration number/i)).toBeInTheDocument();
    });

    it('shows (0/15) counter when registrationNumber is empty', () => {
      render(<VehicleFormDialogPresentation {...defaultProps} registrationNumber="" />);
      expect(screen.getByText(/\(0\/15\)/)).toBeInTheDocument();
    });

    it('shows (8/15) counter when registrationNumber has 8 characters', () => {
      render(<VehicleFormDialogPresentation {...defaultProps} registrationNumber="FBA1234A" />);
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
        screen.getByText(/cannot reduce mileage below current value \(85000\)/i),
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
      render(<VehicleFormDialogPresentation {...defaultProps} isValid={false} />);
      expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    });

    it('is enabled when isValid is true', () => {
      render(<VehicleFormDialogPresentation {...defaultProps} isValid={true} />);
      expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled();
    });

    it('is disabled when isPending is true even if isValid is true', () => {
      render(
        <VehicleFormDialogPresentation {...defaultProps} isValid={true} isPending={true} />,
      );
      expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    });

    it('calls handleSave when clicked and form is valid', () => {
      const handleSave = vi.fn();
      render(
        <VehicleFormDialogPresentation {...defaultProps} isValid={true} handleSave={handleSave} />,
      );
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      expect(handleSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cancel button', () => {
    it('calls onOpenChange(false) when clicked', () => {
      const onOpenChange = vi.fn();
      render(<VehicleFormDialogPresentation {...defaultProps} onOpenChange={onOpenChange} />);
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('is disabled when isPending is true', () => {
      render(<VehicleFormDialogPresentation {...defaultProps} isPending={true} />);
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    });
  });

  describe('unit selector', () => {
    it('unit buttons are enabled when unitLocked is false', () => {
      render(<VehicleFormDialogPresentation {...defaultProps} unitLocked={false} />);
      expect(screen.getByRole('button', { name: 'km' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'mile' })).not.toBeDisabled();
    });

    it('unit buttons are disabled when unitLocked is true', () => {
      render(<VehicleFormDialogPresentation {...defaultProps} unitLocked={true} />);
      expect(screen.getByRole('button', { name: 'km' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'mile' })).toBeDisabled();
    });

    it('shows locked hint text when unitLocked is true', () => {
      render(<VehicleFormDialogPresentation {...defaultProps} unitLocked={true} />);
      expect(
        screen.getByText(/delete all maintenance cards to edit this/i),
      ).toBeInTheDocument();
    });

    it('does not show locked hint text when unitLocked is false', () => {
      render(<VehicleFormDialogPresentation {...defaultProps} unitLocked={false} />);
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
        <VehicleFormDialogPresentation {...defaultProps} open={false} />,
      );
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2.2: Run the failing test to verify it fails**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-form-dialog-presentation.spec.tsx
```

Expected: FAIL — `Cannot find module './vehicle-form-dialog-presentation'`

- [ ] **Step 2.3: Create `vehicle-form-dialog-presentation.tsx`**

Create `frontend/src/components/vehicles/vehicle-form-dialog-presentation.tsx`:

```typescript
import { FC } from 'react';
import type { IVehicleResDTO } from '@project/types';
import { MILEAGE_UNITS } from '@project/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

type VehicleFormDialogPresentationProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationNumber: string;
  brand: string;
  model: string;
  colour: string;
  mileage: string;
  mileageUnit: 'km' | 'mile';
  onRegistrationNumberChange: (v: string) => void;
  onBrandChange: (v: string) => void;
  onModelChange: (v: string) => void;
  onColourChange: (v: string) => void;
  onMileageChange: (v: string) => void;
  onMileageUnitChange: (unit: 'km' | 'mile') => void;
  isEdit: boolean;
  isValid: boolean;
  isPending: boolean;
  unitLocked: boolean;
  isMileageBelowCurrent: boolean;
  currentVehicleMileage: number | undefined;
  handleSave: () => void;
};

export const VehicleFormDialogPresentation: FC<VehicleFormDialogPresentationProps> = ({
  open,
  onOpenChange,
  registrationNumber,
  brand,
  model,
  colour,
  mileage,
  mileageUnit,
  onRegistrationNumberChange,
  onBrandChange,
  onModelChange,
  onColourChange,
  onMileageChange,
  onMileageUnitChange,
  isEdit,
  isValid,
  isPending,
  unitLocked,
  isMileageBelowCurrent,
  currentVehicleMileage,
  handleSave,
}) => {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit Vehicle' : 'Add Vehicle'}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="vehicle-reg-number"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Vehicle Registration Number{' '}
            <span className="font-normal normal-case tracking-normal">
              ({registrationNumber.length}/15)
            </span>
          </label>
          <input
            id="vehicle-reg-number"
            type="text"
            maxLength={15}
            value={registrationNumber}
            onChange={(e) => onRegistrationNumberChange(e.target.value)}
            placeholder="e.g. SBC1234Z"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="vehicle-brand"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Brand <span className="text-destructive">*</span>
            </label>
            <input
              id="vehicle-brand"
              type="text"
              value={brand}
              onChange={(e) => onBrandChange(e.target.value)}
              placeholder="e.g. Toyota"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="vehicle-model"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Model <span className="text-destructive">*</span>
            </label>
            <input
              id="vehicle-model"
              type="text"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder="e.g. Corolla"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="vehicle-colour"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Colour <span className="text-destructive">*</span>
          </label>
          <input
            id="vehicle-colour"
            type="text"
            value={colour}
            onChange={(e) => onColourChange(e.target.value)}
            placeholder="e.g. Silver"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="vehicle-mileage"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Mileage <span className="text-destructive">*</span>
            </label>
            <input
              id="vehicle-mileage"
              type="number"
              min={0}
              value={mileage}
              onChange={(e) => onMileageChange(e.target.value)}
              placeholder="e.g. 85000"
              className={inputClass}
            />
            {isMileageBelowCurrent && (
              <p className="text-destructive text-xs mt-1">
                Cannot reduce mileage below current value ({currentVehicleMileage})
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Unit {!unitLocked && <span className="text-destructive">*</span>}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                {([MILEAGE_UNITS.KM, MILEAGE_UNITS.MILE] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    disabled={unitLocked}
                    onClick={() => onMileageUnitChange(unit)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs',
                      mileageUnit === unit
                        ? 'border-transparent bg-primary text-primary-foreground'
                        : 'border-input bg-background',
                      unitLocked && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    {unit}
                  </button>
                ))}
              </div>
              {unitLocked && (
                <span className="text-xs italic text-muted-foreground">
                  Delete all maintenance cards to edit this
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isValid || isPending}
          >
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
```

- [ ] **Step 2.4: Run the test to verify it passes**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-form-dialog-presentation.spec.tsx
```

Expected: all tests PASS

- [ ] **Step 2.5: Commit**

```bash
git add frontend/src/components/vehicles/vehicle-form-dialog-presentation.tsx \
        frontend/src/components/vehicles/vehicle-form-dialog-presentation.spec.tsx
git commit -m "add VehicleFormDialogPresentation pure rendering component"
```

---

## Task 3: Refactor `VehicleFormDialog` to thin connector

**Files:**
- Modify: `frontend/src/components/vehicles/vehicle-form-dialog.tsx`
- Verify: `frontend/src/components/vehicles/vehicle-form-dialog.spec.tsx` (no changes — must still pass)

---

- [ ] **Step 3.1: Replace `vehicle-form-dialog.tsx` with the thin connector**

Replace the entire contents of `frontend/src/components/vehicles/vehicle-form-dialog.tsx`:

```typescript
'use client';

import { FC } from 'react';
import type { IVehicleResDTO } from '@project/types';
import { useVehicleForm } from './use-vehicle-form';
import { VehicleFormDialogPresentation } from './vehicle-form-dialog-presentation';

type VehicleFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: IVehicleResDTO;
  hasCards?: boolean;
};

export const VehicleFormDialog: FC<VehicleFormDialogProps> = ({
  open,
  onOpenChange,
  vehicle,
  hasCards = false,
}) => {
  const form = useVehicleForm({ open, vehicle, hasCards, onOpenChange });
  return (
    <VehicleFormDialogPresentation
      open={open}
      onOpenChange={onOpenChange}
      {...form}
    />
  );
};
```

- [ ] **Step 3.2: Run existing integration tests to verify no behavioral change**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-form-dialog.spec.tsx
```

Expected: all tests PASS — no test changes required

- [ ] **Step 3.3: Run full test suite**

```bash
just test-unit
```

Expected: all tests PASS

- [ ] **Step 3.4: Format and lint**

```bash
just format
just lint
```

Expected: no errors

- [ ] **Step 3.5: Commit**

```bash
git add frontend/src/components/vehicles/vehicle-form-dialog.tsx
git commit -m "refactor VehicleFormDialog to thin connector using useVehicleForm"
```

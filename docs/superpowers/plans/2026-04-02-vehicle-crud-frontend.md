# Vehicle CRUD Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add create, edit, and delete vehicle UI to the frontend — "Add Vehicle" button on the home page, and a ⋮ dropdown on the vehicle dashboard for edit/delete.

**Architecture:** Two new mutation hooks (`useCreateVehicle`, `useDeleteVehicle`), two new dialog components (`VehicleFormDialog`, `VehicleDeleteConfirmDialog`), and targeted modifications to `home-page.tsx` and `vehicle-dashboard-page.tsx`. All state lifted to page level following the existing pattern in `VehicleDashboardPage`. TDD throughout.

**Tech Stack:** Next.js 15, TanStack Query, Vitest + React Testing Library, sonner toasts, `@project/types` shared DTOs.

---

## File Map

| Action | File |
|---|---|
| Create | `frontend/src/hooks/mutations/vehicles/useCreateVehicle.ts` |
| Create | `frontend/src/hooks/mutations/vehicles/useCreateVehicle.spec.ts` |
| Create | `frontend/src/hooks/mutations/vehicles/useDeleteVehicle.ts` |
| Create | `frontend/src/hooks/mutations/vehicles/useDeleteVehicle.spec.ts` |
| Create | `frontend/src/components/vehicles/vehicle-form-dialog.tsx` |
| Create | `frontend/src/components/vehicles/vehicle-form-dialog.spec.tsx` |
| Create | `frontend/src/components/vehicles/vehicle-delete-confirm-dialog.tsx` |
| Create | `frontend/src/components/vehicles/vehicle-delete-confirm-dialog.spec.tsx` |
| Modify | `frontend/src/components/pages/home-page.tsx` |
| Modify | `frontend/src/components/pages/home-page.spec.tsx` |
| Modify | `frontend/src/components/pages/vehicle-dashboard-page.tsx` |
| Modify | `frontend/src/components/pages/vehicle-dashboard-page.spec.tsx` |

---

## Task 1: `useCreateVehicle` hook

**Files:**
- Create: `frontend/src/hooks/mutations/vehicles/useCreateVehicle.ts`
- Create: `frontend/src/hooks/mutations/vehicles/useCreateVehicle.spec.ts`

- [x] **Step 1: Write the failing tests**

```typescript
// frontend/src/hooks/mutations/vehicles/useCreateVehicle.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCreateVehicle } from './useCreateVehicle';
import { QueryGroup } from '../../queries/keys';
import { createWrapperWithClient } from '../../queries/test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';

const mockVehicle = {
  id: 'v1',
  brand: 'Toyota',
  model: 'Corolla',
  colour: 'Silver',
  mileage: 85000,
  mileageUnit: 'km' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const createData = {
  brand: 'Toyota',
  model: 'Corolla',
  colour: 'Silver',
  mileage: 85000,
  mileageUnit: 'km' as const,
};

describe('useCreateVehicle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs to /vehicles with the provided data', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockVehicle);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useCreateVehicle(), { wrapper });

    act(() => {
      result.current.mutate(createData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.post).toHaveBeenCalledWith('/vehicles', createData);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('returns the created vehicle on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockVehicle);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useCreateVehicle(), { wrapper });

    act(() => {
      result.current.mutate(createData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockVehicle);
  });

  it('invalidates [VEHICLES] on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockVehicle);
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateVehicle(), { wrapper });

    act(() => {
      result.current.mutate(createData);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({
      queryKey: [QueryGroup.VEHICLES],
    });
  });

  it('sets isError and does not invalidate cache when POST fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('fail'));
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateVehicle(), { wrapper });

    act(() => {
      result.current.mutate(createData);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd frontend && pnpm exec vitest run src/hooks/mutations/vehicles/useCreateVehicle.spec.ts
```

Expected: FAIL — `useCreateVehicle` is not defined.

- [x] **Step 3: Implement the hook**

```typescript
// frontend/src/hooks/mutations/vehicles/useCreateVehicle.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ICreateVehicleReqDTO, IVehicleResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const useCreateVehicle = () => {
  const queryClient = useQueryClient();

  return useMutation<IVehicleResDTO, Error, ICreateVehicleReqDTO>({
    mutationFn: (data) => apiClient.post<IVehicleResDTO>('/vehicles', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.VEHICLES],
      });
    },
  });
};
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/hooks/mutations/vehicles/useCreateVehicle.spec.ts
```

Expected: PASS — 4 tests passing.

- [x] **Step 5: Commit**

```bash
git add frontend/src/hooks/mutations/vehicles/useCreateVehicle.ts frontend/src/hooks/mutations/vehicles/useCreateVehicle.spec.ts
git commit -m "add useCreateVehicle mutation hook"
```

---

## Task 2: `useDeleteVehicle` hook

**Files:**
- Create: `frontend/src/hooks/mutations/vehicles/useDeleteVehicle.ts`
- Create: `frontend/src/hooks/mutations/vehicles/useDeleteVehicle.spec.ts`

- [x] **Step 1: Write the failing tests**

```typescript
// frontend/src/hooks/mutations/vehicles/useDeleteVehicle.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDeleteVehicle } from './useDeleteVehicle';
import { QueryGroup } from '../../queries/keys';
import { createWrapperWithClient } from '../../queries/test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: { delete: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';

describe('useDeleteVehicle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DELETEs /vehicles/:vehicleId using the mutation variable as vehicleId', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useDeleteVehicle(), { wrapper });

    act(() => {
      result.current.mutate('v1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.delete).toHaveBeenCalledWith('/vehicles/v1');
  });

  it('invalidates [VEHICLES] on success', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteVehicle(), { wrapper });

    act(() => {
      result.current.mutate('v1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({
      queryKey: [QueryGroup.VEHICLES],
    });
  });

  it('sets isError and does not invalidate cache when DELETE fails', async () => {
    vi.mocked(apiClient.delete).mockRejectedValue(new Error('fail'));
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteVehicle(), { wrapper });

    act(() => {
      result.current.mutate('v1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd frontend && pnpm exec vitest run src/hooks/mutations/vehicles/useDeleteVehicle.spec.ts
```

Expected: FAIL — `useDeleteVehicle` is not defined.

- [x] **Step 3: Implement the hook**

```typescript
// frontend/src/hooks/mutations/vehicles/useDeleteVehicle.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const useDeleteVehicle = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (vehicleId) => apiClient.delete<void>(`/vehicles/${vehicleId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.VEHICLES],
      });
    },
  });
};
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/hooks/mutations/vehicles/useDeleteVehicle.spec.ts
```

Expected: PASS — 3 tests passing.

- [x] **Step 5: Commit**

```bash
git add frontend/src/hooks/mutations/vehicles/useDeleteVehicle.ts frontend/src/hooks/mutations/vehicles/useDeleteVehicle.spec.ts
git commit -m "add useDeleteVehicle mutation hook"
```

---

## Task 3: `VehicleFormDialog` component

**Files:**
- Create: `frontend/src/components/vehicles/vehicle-form-dialog.tsx`
- Create: `frontend/src/components/vehicles/vehicle-form-dialog.spec.tsx`

- [x] **Step 1: Write the failing tests**

```typescript
// frontend/src/components/vehicles/vehicle-form-dialog.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { IVehicleResDTO } from '@project/types';

vi.mock('@/hooks/mutations/vehicles/useCreateVehicle', () => ({
  useCreateVehicle: vi.fn(),
}));
vi.mock('@/hooks/mutations/vehicles/usePatchVehicle', () => ({
  usePatchVehicle: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
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

import { toast } from 'sonner';
import { useCreateVehicle } from '@/hooks/mutations/vehicles/useCreateVehicle';
import { usePatchVehicle } from '@/hooks/mutations/vehicles/usePatchVehicle';
import { VehicleFormDialog } from './vehicle-form-dialog';

const mockMutate = vi.fn();

const mockVehicle: IVehicleResDTO = {
  id: 'v1',
  brand: 'Toyota',
  model: 'Corolla',
  colour: 'Silver',
  mileage: 85000,
  mileageUnit: 'km',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('VehicleFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateVehicle).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof useCreateVehicle>);
    vi.mocked(usePatchVehicle).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof usePatchVehicle>);
  });

  it('shows "Add Vehicle" title in create mode (no vehicle prop)', () => {
    render(
      <VehicleFormDialog open={true} onOpenChange={vi.fn()} />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Add Vehicle',
    );
  });

  it('shows "Edit Vehicle" title in edit mode (vehicle prop provided)', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Edit Vehicle',
    );
  });

  it('pre-fills fields with vehicle data in edit mode', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    expect(screen.getByPlaceholderText(/toyota/i)).toHaveValue('Toyota');
    expect(screen.getByPlaceholderText(/corolla/i)).toHaveValue('Corolla');
    expect(screen.getByPlaceholderText(/silver/i)).toHaveValue('Silver');
  });

  it('Save button is disabled when required fields are empty', () => {
    render(
      <VehicleFormDialog open={true} onOpenChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('Save button is enabled when all required fields are filled', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled();
  });

  it('unit toggle buttons are enabled when hasCards is false', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
        hasCards={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'km' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'mile' })).not.toBeDisabled();
  });

  it('unit toggle buttons are disabled and hint text shown when hasCards is true', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
        hasCards={true}
      />,
    );
    expect(screen.getByRole('button', { name: 'km' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'mile' })).toBeDisabled();
    expect(
      screen.getByText(/delete all maintenance cards to edit this/i),
    ).toBeInTheDocument();
  });

  it('calls createMutation.mutate with correct data on Save in create mode', () => {
    render(
      <VehicleFormDialog open={true} onOpenChange={vi.fn()} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/toyota/i), {
      target: { value: 'Toyota' },
    });
    fireEvent.change(screen.getByPlaceholderText(/corolla/i), {
      target: { value: 'Corolla' },
    });
    fireEvent.change(screen.getByPlaceholderText(/silver/i), {
      target: { value: 'Silver' },
    });
    fireEvent.change(screen.getByPlaceholderText(/85000/i), {
      target: { value: '85000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      { brand: 'Toyota', model: 'Corolla', colour: 'Silver', mileage: 85000, mileageUnit: 'km' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('calls patchMutation.mutate with correct data on Save in edit mode', () => {
    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      { brand: 'Toyota', model: 'Corolla', colour: 'Silver', mileage: 85000, mileageUnit: 'km' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('shows success toast and closes dialog on create success', () => {
    const onOpenChange = vi.fn();
    vi.mocked(useCreateVehicle).mockReturnValue({
      mutate: (_data: unknown, opts: { onSuccess: () => void }) =>
        opts.onSuccess(),
      isPending: false,
    } as ReturnType<typeof useCreateVehicle>);

    render(
      <VehicleFormDialog open={true} onOpenChange={onOpenChange} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/toyota/i), {
      target: { value: 'Toyota' },
    });
    fireEvent.change(screen.getByPlaceholderText(/corolla/i), {
      target: { value: 'Corolla' },
    });
    fireEvent.change(screen.getByPlaceholderText(/silver/i), {
      target: { value: 'Silver' },
    });
    fireEvent.change(screen.getByPlaceholderText(/85000/i), {
      target: { value: '85000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(toast.success).toHaveBeenCalledWith('Vehicle created');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows success toast and closes dialog on edit success', () => {
    const onOpenChange = vi.fn();
    vi.mocked(usePatchVehicle).mockReturnValue({
      mutate: (_data: unknown, opts: { onSuccess: () => void }) =>
        opts.onSuccess(),
      isPending: false,
    } as ReturnType<typeof usePatchVehicle>);

    render(
      <VehicleFormDialog
        open={true}
        onOpenChange={onOpenChange}
        vehicle={mockVehicle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(toast.success).toHaveBeenCalledWith('Vehicle updated');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error toast when mutation fails', () => {
    vi.mocked(useCreateVehicle).mockReturnValue({
      mutate: (_data: unknown, opts: { onError: (err: Error) => void }) =>
        opts.onError(new Error('Server error')),
      isPending: false,
    } as ReturnType<typeof useCreateVehicle>);

    render(
      <VehicleFormDialog open={true} onOpenChange={vi.fn()} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/toyota/i), {
      target: { value: 'Toyota' },
    });
    fireEvent.change(screen.getByPlaceholderText(/corolla/i), {
      target: { value: 'Corolla' },
    });
    fireEvent.change(screen.getByPlaceholderText(/silver/i), {
      target: { value: 'Silver' },
    });
    fireEvent.change(screen.getByPlaceholderText(/85000/i), {
      target: { value: '85000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(toast.error).toHaveBeenCalledWith('Server error');
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-form-dialog.spec.tsx
```

Expected: FAIL — `VehicleFormDialog` is not defined.

- [x] **Step 3: Implement the component**

```typescript
// frontend/src/components/vehicles/vehicle-form-dialog.tsx
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { IVehicleResDTO } from '@project/types';
import { MILEAGE_UNITS } from '@project/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCreateVehicle } from '@/hooks/mutations/vehicles/useCreateVehicle';
import { usePatchVehicle } from '@/hooks/mutations/vehicles/usePatchVehicle';
import { cn } from '@/lib/utils';

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: IVehicleResDTO;
  hasCards?: boolean;
}

export function VehicleFormDialog({
  open,
  onOpenChange,
  vehicle,
  hasCards = false,
}: VehicleFormDialogProps) {
  const isEdit = !!vehicle;

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [colour, setColour] = useState('');
  const [mileage, setMileage] = useState('');
  const [mileageUnit, setMileageUnit] = useState<'km' | 'mile'>(MILEAGE_UNITS.KM);

  useEffect(() => {
    if (open) {
      setBrand(vehicle?.brand ?? '');
      setModel(vehicle?.model ?? '');
      setColour(vehicle?.colour ?? '');
      setMileage(vehicle?.mileage?.toString() ?? '');
      setMileageUnit(vehicle?.mileageUnit ?? MILEAGE_UNITS.KM);
    }
  }, [open, vehicle]);

  const createMutation = useCreateVehicle();
  const patchMutation = usePatchVehicle(vehicle?.id ?? '');

  const parsedMileage = parseFloat(mileage);
  const isValid =
    brand.trim().length > 0 &&
    model.trim().length > 0 &&
    colour.trim().length > 0 &&
    !isNaN(parsedMileage) &&
    parsedMileage >= 0;

  const isPending = createMutation.isPending || patchMutation.isPending;
  const unitLocked = isEdit && hasCards;

  const handleSave = () => {
    const data = {
      brand: brand.trim(),
      model: model.trim(),
      colour: colour.trim(),
      mileage: parsedMileage,
      mileageUnit,
    };

    if (isEdit) {
      patchMutation.mutate(data, {
        onSuccess: () => {
          toast.success('Vehicle updated');
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err.message ?? 'Something went wrong');
        },
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success('Vehicle created');
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err.message ?? 'Something went wrong');
        },
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit Vehicle' : 'Add Vehicle'}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Brand <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Toyota"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Model <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Corolla"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Colour <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={colour}
            onChange={(e) => setColour(e.target.value)}
            placeholder="e.g. Silver"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Mileage <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              min={0}
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="e.g. 85000"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Unit {!unitLocked && <span className="text-destructive">*</span>}
            </label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                {([MILEAGE_UNITS.KM, MILEAGE_UNITS.MILE] as const).map(
                  (unit) => (
                    <button
                      key={unit}
                      type="button"
                      disabled={unitLocked}
                      onClick={() => setMileageUnit(unit)}
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
                  ),
                )}
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
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-form-dialog.spec.tsx
```

Expected: PASS — 11 tests passing.

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/vehicles/vehicle-form-dialog.tsx frontend/src/components/vehicles/vehicle-form-dialog.spec.tsx
git commit -m "add VehicleFormDialog component"
```

---

## Task 4: `VehicleDeleteConfirmDialog` component

**Files:**
- Create: `frontend/src/components/vehicles/vehicle-delete-confirm-dialog.tsx`
- Create: `frontend/src/components/vehicles/vehicle-delete-confirm-dialog.spec.tsx`

- [x] **Step 1: Write the failing tests**

```typescript
// frontend/src/components/vehicles/vehicle-delete-confirm-dialog.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { IVehicleResDTO } from '@project/types';

vi.mock('@/hooks/mutations/vehicles/useDeleteVehicle', () => ({
  useDeleteVehicle: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
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

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ replace: mockReplace })),
}));

import { useDeleteVehicle } from '@/hooks/mutations/vehicles/useDeleteVehicle';
import { toast } from 'sonner';
import { VehicleDeleteConfirmDialog } from './vehicle-delete-confirm-dialog';

const mockMutate = vi.fn();

const mockVehicle: IVehicleResDTO = {
  id: 'v1',
  brand: 'Toyota',
  model: 'Corolla',
  colour: 'Silver',
  mileage: 85000,
  mileageUnit: 'km',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('VehicleDeleteConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReplace.mockReset();
    vi.mocked(useDeleteVehicle).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof useDeleteVehicle>);
  });

  it('shows vehicle brand and model in the confirmation message', () => {
    render(
      <VehicleDeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    expect(screen.getByText(/Toyota Corolla/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('calls onOpenChange(false) without mutating when Cancel is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <VehicleDeleteConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        vehicle={mockVehicle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockMutate).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls mutate with vehicleId when Delete is clicked', () => {
    render(
      <VehicleDeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('shows success toast, closes dialog, and redirects to "/" on success', () => {
    const onOpenChange = vi.fn();
    vi.mocked(useDeleteVehicle).mockReturnValue({
      mutate: (_id: string, opts: { onSuccess: () => void }) =>
        opts.onSuccess(),
      isPending: false,
    } as ReturnType<typeof useDeleteVehicle>);

    render(
      <VehicleDeleteConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        vehicle={mockVehicle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(toast.success).toHaveBeenCalledWith('Vehicle deleted');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('shows error toast when deleteMutation fails', () => {
    vi.mocked(useDeleteVehicle).mockReturnValue({
      mutate: (_id: string, opts: { onError: (err: Error) => void }) =>
        opts.onError(new Error('Delete failed')),
      isPending: false,
    } as ReturnType<typeof useDeleteVehicle>);

    render(
      <VehicleDeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicle={mockVehicle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(toast.error).toHaveBeenCalledWith('Delete failed');
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-delete-confirm-dialog.spec.tsx
```

Expected: FAIL — `VehicleDeleteConfirmDialog` is not defined.

- [x] **Step 3: Implement the component**

```typescript
// frontend/src/components/vehicles/vehicle-delete-confirm-dialog.tsx
'use client';

import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { IVehicleResDTO } from '@project/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeleteVehicle } from '@/hooks/mutations/vehicles/useDeleteVehicle';

interface VehicleDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: IVehicleResDTO;
}

export function VehicleDeleteConfirmDialog({
  open,
  onOpenChange,
  vehicle,
}: VehicleDeleteConfirmDialogProps) {
  const deleteMutation = useDeleteVehicle();
  const router = useRouter();

  const handleDelete = () => {
    deleteMutation.mutate(vehicle.id, {
      onSuccess: () => {
        toast.success('Vehicle deleted');
        onOpenChange(false);
        router.replace('/');
      },
      onError: (err) => {
        toast.error(err.message ?? 'Something went wrong');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Delete Vehicle">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Delete &ldquo;{vehicle.brand} {vehicle.model}&rdquo;? This cannot be
          undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm exec vitest run src/components/vehicles/vehicle-delete-confirm-dialog.spec.tsx
```

Expected: PASS — 5 tests passing.

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/vehicles/vehicle-delete-confirm-dialog.tsx frontend/src/components/vehicles/vehicle-delete-confirm-dialog.spec.tsx
git commit -m "add VehicleDeleteConfirmDialog component"
```

---

## Task 5: Update `home-page.tsx` — "Add Vehicle" button and create dialog

**Files:**
- Modify: `frontend/src/components/pages/home-page.tsx`
- Modify: `frontend/src/components/pages/home-page.spec.tsx`

**What changes:**
- Move the `<h1>Your Vehicles</h1>` from `HomePage` into `HomeContent` so it can sit next to the `+ Add Vehicle` button.
- Add `createOpen` state and `VehicleFormDialog` to `HomeContent`.
- `HomePage` becomes just the `AuthGuard` + `<main>` wrapper.

- [x] **Step 1: Write the failing tests**

Add the following new tests to `home-page.spec.tsx`. First, add `fireEvent` to the import and add the `VehicleFormDialog` mock at the top of the file alongside the existing mocks:

```typescript
// Add to the vi.mock block at top of home-page.spec.tsx:
vi.mock('@/components/vehicles/vehicle-form-dialog', () => ({
  VehicleFormDialog: ({ open }: { open: boolean; onOpenChange: (v: boolean) => void }) =>
    open ? <div data-testid="vehicle-form-dialog" /> : null,
}));
```

Add `fireEvent` to the `@testing-library/react` import line:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
```

Add these test cases inside the existing `describe('HomePage', ...)` block:

```typescript
it('renders "Add Vehicle" button', () => {
  vi.mocked(useVehicles).mockReturnValue({
    data: [] as IVehicleResDTO[],
    isLoading: false,
  } as ReturnType<typeof useVehicles>);

  render(<HomePage />);

  expect(
    screen.getByRole('button', { name: /add vehicle/i }),
  ).toBeInTheDocument();
});

it('renders "Add Vehicle" button even while loading', () => {
  vi.mocked(useVehicles).mockReturnValue({
    data: undefined,
    isLoading: true,
  } as ReturnType<typeof useVehicles>);

  render(<HomePage />);

  expect(
    screen.getByRole('button', { name: /add vehicle/i }),
  ).toBeInTheDocument();
});

it('opens VehicleFormDialog when "Add Vehicle" button is clicked', () => {
  vi.mocked(useVehicles).mockReturnValue({
    data: [] as IVehicleResDTO[],
    isLoading: false,
  } as ReturnType<typeof useVehicles>);

  render(<HomePage />);
  fireEvent.click(screen.getByRole('button', { name: /add vehicle/i }));

  expect(screen.getByTestId('vehicle-form-dialog')).toBeInTheDocument();
});
```

- [x] **Step 2: Run tests to verify new tests fail**

```bash
cd frontend && pnpm exec vitest run src/components/pages/home-page.spec.tsx
```

Expected: The 3 new tests FAIL (no "Add Vehicle" button exists yet). Existing tests still pass.

- [x] **Step 3: Update `home-page.tsx`**

Replace the entire file contents:

```typescript
// frontend/src/components/pages/home-page.tsx
'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { VehicleCard } from '@/components/vehicles/vehicle-card';
import { VehicleFormDialog } from '@/components/vehicles/vehicle-form-dialog';
import { Button } from '@/components/ui/button';
import { useVehicles } from '@/hooks/queries/vehicles/useVehicles';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { useGlobalWarningCount } from '@/hooks/queries/vehicles/useGlobalWarningCount';

function HomeContent() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: config } = useAppConfig();
  const thresholdKm = config?.mileageWarningThresholdKm ?? 0;
  const globalWarningCount = useGlobalWarningCount(vehicles, thresholdKm);

  const renderVehicles = () => {
    if (isLoading) {
      return (
        <p className="text-muted-foreground text-sm">Loading vehicles…</p>
      );
    }
    if (vehicles.length === 0) {
      return (
        <p className="text-muted-foreground text-sm">
          No vehicles yet. Add your first vehicle to get started.
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        {globalWarningCount === 0 ? (
          <p className="text-sm font-medium text-green-600">
            ✓ All good — no upcoming or overdue maintenance
          </p>
        ) : (
          <p className="text-sm font-medium text-destructive">
            {globalWarningCount} card
            {globalWarningCount !== 1 ? 's' : ''} need attention
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              thresholdKm={thresholdKm}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your Vehicles</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Add Vehicle
        </Button>
      </div>
      {renderVehicles()}
      <VehicleFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

export function HomePage() {
  return (
    <AuthGuard>
      <main className="p-6">
        <HomeContent />
      </main>
    </AuthGuard>
  );
}
```

- [x] **Step 4: Run all home-page tests**

```bash
cd frontend && pnpm exec vitest run src/components/pages/home-page.spec.tsx
```

Expected: PASS — all tests passing (existing + 3 new).

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/pages/home-page.tsx frontend/src/components/pages/home-page.spec.tsx
git commit -m "add Add Vehicle button and create dialog to home page"
```

---

## Task 6: Update `vehicle-dashboard-page.tsx` — ⋮ dropdown and vehicle edit/delete dialogs

**Files:**
- Modify: `frontend/src/components/pages/vehicle-dashboard-page.tsx`
- Modify: `frontend/src/components/pages/vehicle-dashboard-page.spec.tsx`

**What changes:**
- Add `vehicleDropdownOpen`, `editVehicleOpen`, `deleteVehicleOpen` state to `DashboardContent`.
- Wrap the vehicle header `<div>` in a flex row with the ⋮ dropdown on the right.
- Extend the existing document click handler to also close `vehicleDropdownOpen`.
- Render `VehicleFormDialog` (edit mode) and `VehicleDeleteConfirmDialog` at the bottom of `DashboardContent`.

- [x] **Step 1: Write the failing tests**

Add the following mocks at the top of `vehicle-dashboard-page.spec.tsx`, alongside the existing mocks:

```typescript
vi.mock('@/components/vehicles/vehicle-form-dialog', () => ({
  VehicleFormDialog: ({
    open,
    vehicle,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    vehicle?: IVehicleResDTO;
    hasCards?: boolean;
  }) =>
    open ? (
      <div data-testid="vehicle-form-dialog">
        {vehicle ? `edit:${vehicle.id}` : 'create'}
      </div>
    ) : null,
}));
vi.mock('@/components/vehicles/vehicle-delete-confirm-dialog', () => ({
  VehicleDeleteConfirmDialog: ({
    open,
    vehicle,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    vehicle: IVehicleResDTO;
  }) =>
    open ? (
      <div data-testid="vehicle-delete-dialog">{vehicle.id}</div>
    ) : null,
}));
```

Add these test cases inside the existing `describe('VehicleDashboardPage', ...)` block:

```typescript
it('renders the ⋮ vehicle actions button', () => {
  setupVehicleLoaded();
  render(<VehicleDashboardPage vehicleId="vehicle-1" />);
  expect(
    screen.getByRole('button', { name: /vehicle actions/i }),
  ).toBeInTheDocument();
});

it('opens vehicle edit dialog when Edit is clicked in the ⋮ dropdown', () => {
  setupVehicleLoaded();
  render(<VehicleDashboardPage vehicleId="vehicle-1" />);
  fireEvent.click(screen.getByRole('button', { name: /vehicle actions/i }));
  fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
  expect(screen.getByTestId('vehicle-form-dialog')).toHaveTextContent(
    'edit:vehicle-1',
  );
});

it('opens vehicle delete dialog when Delete is clicked in the ⋮ dropdown', () => {
  setupVehicleLoaded();
  render(<VehicleDashboardPage vehicleId="vehicle-1" />);
  fireEvent.click(screen.getByRole('button', { name: /vehicle actions/i }));
  fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
  expect(screen.getByTestId('vehicle-delete-dialog')).toHaveTextContent(
    'vehicle-1',
  );
});
```

- [x] **Step 2: Run tests to verify new tests fail**

```bash
cd frontend && pnpm exec vitest run src/components/pages/vehicle-dashboard-page.spec.tsx
```

Expected: The 3 new tests FAIL (no ⋮ button or vehicle dialogs yet). Existing tests still pass.

- [x] **Step 3: Update `vehicle-dashboard-page.tsx`**

Replace the entire file contents:

```typescript
// frontend/src/components/pages/vehicle-dashboard-page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth/auth-guard';
import { MileagePrompt } from '@/components/vehicles/mileage-prompt';
import { MaintenanceCardRow } from '@/components/maintenance-cards/maintenance-card-row';
import { MaintenanceCardFormDialog } from '@/components/maintenance-cards/maintenance-card-form-dialog';
import { MarkDoneDialog } from '@/components/maintenance-cards/mark-done-dialog';
import { DeleteConfirmDialog } from '@/components/maintenance-cards/delete-confirm-dialog';
import { VehicleFormDialog } from '@/components/vehicles/vehicle-form-dialog';
import { VehicleDeleteConfirmDialog } from '@/components/vehicles/vehicle-delete-confirm-dialog';
import { Button } from '@/components/ui/button';
import { useVehicle } from '@/hooks/queries/vehicles/useVehicle';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import type { IMaintenanceCardResDTO } from '@project/types';

interface VehicleDashboardPageProps {
  vehicleId: string;
}

function DashboardContent({ vehicleId }: VehicleDashboardPageProps) {
  const [sort, setSort] = useState<'urgency' | 'name'>('urgency');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<IMaintenanceCardResDTO | null>(
    null,
  );
  const [markingDoneCard, setMarkingDoneCard] =
    useState<IMaintenanceCardResDTO | null>(null);
  const [deletingCard, setDeletingCard] =
    useState<IMaintenanceCardResDTO | null>(null);
  const [editVehicleOpen, setEditVehicleOpen] = useState(false);
  const [deleteVehicleOpen, setDeleteVehicleOpen] = useState(false);

  const router = useRouter();

  const {
    data: vehicle,
    isLoading: vehicleLoading,
    isError,
  } = useVehicle(vehicleId);
  const { data: cards = [], isLoading: cardsLoading } = useMaintenanceCards(
    vehicleId,
    sort,
  );

  useEffect(() => {
    const close = () => {
      setActiveDropdownId(null);
      setVehicleDropdownOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    if (!vehicleLoading && (isError || !vehicle)) {
      router.replace('/');
    }
  }, [vehicleLoading, isError, vehicle, router]);

  if (vehicleLoading) {
    return <p className="text-muted-foreground p-6 text-sm">Loading…</p>;
  }

  if (isError || !vehicle) {
    return null;
  }

  const handleEdit = (card: IMaintenanceCardResDTO) => {
    setActiveDropdownId(null);
    setEditingCard(card);
  };

  const handleMarkDone = (card: IMaintenanceCardResDTO) => {
    setActiveDropdownId(null);
    setMarkingDoneCard(card);
  };

  const handleDelete = (card: IMaintenanceCardResDTO) => {
    setActiveDropdownId(null);
    setDeletingCard(card);
  };

  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {vehicle.brand} {vehicle.model}
          </h1>
          <p className="text-muted-foreground text-sm">
            {vehicle.colour} &middot; {vehicle.mileage.toLocaleString()}{' '}
            {vehicle.mileageUnit}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label="Vehicle actions"
            onClick={(e) => {
              e.stopPropagation();
              setVehicleDropdownOpen((prev) => !prev);
            }}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm hover:bg-accent"
          >
            ⋮
          </button>
          {vehicleDropdownOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-[100px] rounded-md border bg-background shadow-md">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  setVehicleDropdownOpen(false);
                  setEditVehicleOpen(true);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  setVehicleDropdownOpen(false);
                  setDeleteVehicleOpen(true);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <MileagePrompt vehicleId={vehicleId} />

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={sort === 'urgency' ? 'default' : 'outline'}
          onClick={() => setSort('urgency')}
        >
          Urgency
        </Button>
        <Button
          size="sm"
          variant={sort === 'name' ? 'default' : 'outline'}
          onClick={() => setSort('name')}
        >
          Name
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-label="Add maintenance card"
          onClick={() => setCreateOpen(true)}
          className="flex w-full items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/30 py-4 text-muted-foreground hover:bg-muted"
        >
          <span className="text-2xl font-light leading-none">+</span>
        </button>

        {cardsLoading ? (
          <p className="text-muted-foreground text-sm">Loading cards…</p>
        ) : cards.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No maintenance cards yet.
          </p>
        ) : (
          cards.map((card) => (
            <MaintenanceCardRow
              key={card.id}
              card={card}
              vehicle={vehicle}
              isDropdownOpen={activeDropdownId === card.id}
              onDropdownToggle={setActiveDropdownId}
              onEdit={handleEdit}
              onMarkDone={handleMarkDone}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Maintenance card dialogs */}
      <MaintenanceCardFormDialog
        open={createOpen || !!editingCard}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditingCard(null);
          }
        }}
        vehicleId={vehicleId}
        vehicleMileage={vehicle.mileage}
        vehicleMileageUnit={vehicle.mileageUnit}
        card={editingCard ?? undefined}
      />

      {markingDoneCard && (
        <MarkDoneDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setMarkingDoneCard(null);
          }}
          card={markingDoneCard}
          vehicleId={vehicleId}
        />
      )}

      {deletingCard && (
        <DeleteConfirmDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setDeletingCard(null);
          }}
          card={deletingCard}
          vehicleId={vehicleId}
        />
      )}

      {/* Vehicle dialogs */}
      <VehicleFormDialog
        open={editVehicleOpen}
        onOpenChange={setEditVehicleOpen}
        vehicle={vehicle}
        hasCards={cards.length > 0}
      />

      <VehicleDeleteConfirmDialog
        open={deleteVehicleOpen}
        onOpenChange={setDeleteVehicleOpen}
        vehicle={vehicle}
      />
    </main>
  );
}

export function VehicleDashboardPage({ vehicleId }: VehicleDashboardPageProps) {
  return (
    <AuthGuard>
      <DashboardContent vehicleId={vehicleId} />
    </AuthGuard>
  );
}
```

- [x] **Step 4: Run all vehicle-dashboard-page tests**

```bash
cd frontend && pnpm exec vitest run src/components/pages/vehicle-dashboard-page.spec.tsx
```

Expected: PASS — all tests passing (existing + 3 new).

- [x] **Step 5: Run full frontend test suite**

```bash
just test-unit
```

Expected: All tests passing.

- [x] **Step 6: Format and lint**

```bash
just format && just lint
```

Expected: No errors.

- [x] **Step 7: Commit**

```bash
git add frontend/src/components/pages/vehicle-dashboard-page.tsx frontend/src/components/pages/vehicle-dashboard-page.spec.tsx
git commit -m "add vehicle edit and delete actions to dashboard"
```

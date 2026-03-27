# Maintenance Card CRUD — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add create, edit, delete, and mark-done entry points for maintenance cards on the vehicle dashboard.

**Architecture:** Four mutation hooks feed three new dialog components (`MaintenanceCardFormDialog`, `MarkDoneDialog`, `DeleteConfirmDialog`) and a shared `Dialog` UI primitive. `MaintenanceCardRow` gains a ⋮ context-menu dropdown. `VehicleDashboardPage` owns all dialog/dropdown state and a FAB "+" button for creating cards.

**Tech Stack:** TanStack Query v5 (`useMutation`, `useQueryClient`), Next.js 15 App Router, `@project/types`, Tailwind CSS, sonner (toasts), Vitest + React Testing Library

**Spec reference:** `docs/superpowers/specs/2026-03-26-maintenance-card-crud-frontend-design.md`

---

## Task 1: `useCreateMaintenanceCard` hook

**Files:**
- Create: `frontend/src/hooks/mutations/maintenance-cards/useCreateMaintenanceCard.ts`
- Create: `frontend/src/hooks/mutations/maintenance-cards/useCreateMaintenanceCard.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/mutations/maintenance-cards/useCreateMaintenanceCard.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCreateMaintenanceCard } from './useCreateMaintenanceCard';
import { QueryGroup } from '../../queries/keys';
import { createWrapperWithClient } from '../../queries/test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';

const mockCard = {
  id: 'card-1',
  vehicleId: 'v1',
  type: 'task' as const,
  name: 'Oil Change',
  description: null,
  intervalMileage: 5000,
  intervalTimeMonths: null,
  nextDueMileage: null,
  nextDueDate: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const createData = { type: 'task' as const, name: 'Oil Change', intervalMileage: 5000 };

describe('useCreateMaintenanceCard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('POSTs to /vehicles/:vehicleId/maintenance-cards with the provided data', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockCard);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useCreateMaintenanceCard('v1'), { wrapper });

    act(() => { result.current.mutate(createData); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.post).toHaveBeenCalledWith('/vehicles/v1/maintenance-cards', createData);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('returns the created card on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockCard);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useCreateMaintenanceCard('v1'), { wrapper });

    act(() => { result.current.mutate(createData); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockCard);
  });

  it('invalidates [MAINTENANCE_CARDS, vehicleId] on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockCard);
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateMaintenanceCard('v1'), { wrapper });

    act(() => { result.current.mutate(createData); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: [QueryGroup.MAINTENANCE_CARDS, 'v1'] });
  });

  it('sets isError and does not invalidate cache when POST fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('fail'));
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateMaintenanceCard('v1'), { wrapper });

    act(() => { result.current.mutate(createData); });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

```bash
cd frontend && pnpm exec vitest run src/hooks/mutations/maintenance-cards/useCreateMaintenanceCard.spec.ts
```

Expected: fails with "Cannot find module './useCreateMaintenanceCard'".

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/mutations/maintenance-cards/useCreateMaintenanceCard.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ICreateMaintenanceCardReqDTO,
  IMaintenanceCardResDTO,
} from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const useCreateMaintenanceCard = (vehicleId: string) => {
  const queryClient = useQueryClient();

  return useMutation<IMaintenanceCardResDTO, Error, ICreateMaintenanceCardReqDTO>({
    mutationFn: (data) =>
      apiClient.post<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards`,
        data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId],
      });
    },
  });
};
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd frontend && pnpm exec vitest run src/hooks/mutations/maintenance-cards/useCreateMaintenanceCard.spec.ts
```

Expected: 4 tests passing.

- [ ] **Step 5: Format and lint**

```bash
just format && just lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/mutations/maintenance-cards/useCreateMaintenanceCard.ts \
        frontend/src/hooks/mutations/maintenance-cards/useCreateMaintenanceCard.spec.ts
git commit -m "add useCreateMaintenanceCard mutation hook"
```

---

## Task 2: `usePatchMaintenanceCard` hook

**Files:**
- Create: `frontend/src/hooks/mutations/maintenance-cards/usePatchMaintenanceCard.ts`
- Create: `frontend/src/hooks/mutations/maintenance-cards/usePatchMaintenanceCard.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/mutations/maintenance-cards/usePatchMaintenanceCard.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePatchMaintenanceCard } from './usePatchMaintenanceCard';
import { QueryGroup } from '../../queries/keys';
import { createWrapperWithClient } from '../../queries/test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: { patch: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';

const mockCard = {
  id: 'card-1',
  vehicleId: 'v1',
  type: 'task' as const,
  name: 'Oil Change Updated',
  description: null,
  intervalMileage: 7000,
  intervalTimeMonths: null,
  nextDueMileage: null,
  nextDueDate: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-06-01T00:00:00.000Z',
};

const patchData = { name: 'Oil Change Updated', intervalMileage: 7000 };

describe('usePatchMaintenanceCard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('PATCHes /vehicles/:vehicleId/maintenance-cards/:cardId with the provided data', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockCard);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(
      () => usePatchMaintenanceCard('v1', 'card-1'),
      { wrapper },
    );

    act(() => { result.current.mutate(patchData); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/vehicles/v1/maintenance-cards/card-1',
      patchData,
    );
  });

  it('invalidates [MAINTENANCE_CARDS, vehicleId] on success', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockCard);
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () => usePatchMaintenanceCard('v1', 'card-1'),
      { wrapper },
    );

    act(() => { result.current.mutate(patchData); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: [QueryGroup.MAINTENANCE_CARDS, 'v1'] });
  });

  it('sets isError and does not invalidate cache when PATCH fails', async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(new Error('fail'));
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () => usePatchMaintenanceCard('v1', 'card-1'),
      { wrapper },
    );

    act(() => { result.current.mutate(patchData); });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && pnpm exec vitest run src/hooks/mutations/maintenance-cards/usePatchMaintenanceCard.spec.ts
```

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/mutations/maintenance-cards/usePatchMaintenanceCard.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  IUpdateMaintenanceCardReqDTO,
  IMaintenanceCardResDTO,
} from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const usePatchMaintenanceCard = (vehicleId: string, cardId: string) => {
  const queryClient = useQueryClient();

  return useMutation<IMaintenanceCardResDTO, Error, IUpdateMaintenanceCardReqDTO>({
    mutationFn: (data) =>
      apiClient.patch<IMaintenanceCardResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
        data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId],
      });
    },
  });
};
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd frontend && pnpm exec vitest run src/hooks/mutations/maintenance-cards/usePatchMaintenanceCard.spec.ts
```

Expected: 3 tests passing.

- [ ] **Step 5: Format, lint, commit**

```bash
just format && just lint
git add frontend/src/hooks/mutations/maintenance-cards/usePatchMaintenanceCard.ts \
        frontend/src/hooks/mutations/maintenance-cards/usePatchMaintenanceCard.spec.ts
git commit -m "add usePatchMaintenanceCard mutation hook"
```

---

## Task 3: `useDeleteMaintenanceCard` hook

**Files:**
- Create: `frontend/src/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard.ts`
- Create: `frontend/src/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard.spec.ts`

`cardId` is the mutation variable (not a hook param) so one hook instance handles any card.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDeleteMaintenanceCard } from './useDeleteMaintenanceCard';
import { QueryGroup } from '../../queries/keys';
import { createWrapperWithClient } from '../../queries/test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: { delete: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';

describe('useDeleteMaintenanceCard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('DELETEs /vehicles/:vehicleId/maintenance-cards/:cardId using the mutation variable as cardId', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useDeleteMaintenanceCard('v1'), { wrapper });

    act(() => { result.current.mutate('card-99'); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.delete).toHaveBeenCalledWith(
      '/vehicles/v1/maintenance-cards/card-99',
    );
  });

  it('invalidates [MAINTENANCE_CARDS, vehicleId] on success', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteMaintenanceCard('v1'), { wrapper });

    act(() => { result.current.mutate('card-99'); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: [QueryGroup.MAINTENANCE_CARDS, 'v1'] });
  });

  it('sets isError and does not invalidate cache when DELETE fails', async () => {
    vi.mocked(apiClient.delete).mockRejectedValue(new Error('fail'));
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteMaintenanceCard('v1'), { wrapper });

    act(() => { result.current.mutate('card-99'); });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && pnpm exec vitest run src/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard.spec.ts
```

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const useDeleteMaintenanceCard = (vehicleId: string) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (cardId) =>
      apiClient.delete<void>(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId],
      });
    },
  });
};
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd frontend && pnpm exec vitest run src/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard.spec.ts
```

Expected: 3 tests passing.

- [ ] **Step 5: Format, lint, commit**

```bash
just format && just lint
git add frontend/src/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard.ts \
        frontend/src/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard.spec.ts
git commit -m "add useDeleteMaintenanceCard mutation hook"
```

---

## Task 4: `useMarkDone` hook

**Files:**
- Create: `frontend/src/hooks/mutations/maintenance-cards/useMarkDone.ts`
- Create: `frontend/src/hooks/mutations/maintenance-cards/useMarkDone.spec.ts`

On success, invalidates both the cards list (prefix match) and the individual vehicle entry (exact match) because mark-done may update `vehicle.mileage`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/mutations/maintenance-cards/useMarkDone.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMarkDone } from './useMarkDone';
import { QueryGroup } from '../../queries/keys';
import { createWrapperWithClient } from '../../queries/test-utils';

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';

const mockHistory = {
  id: 'hist-1',
  maintenanceCardId: 'card-1',
  doneAtMileage: 52000,
  doneAtDate: '2026-03-27',
  notes: null,
  createdAt: '2026-03-27T00:00:00.000Z',
};

describe('useMarkDone', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('POSTs to /vehicles/:vehicleId/maintenance-cards/:cardId/mark-done', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockHistory);
    const { wrapper } = createWrapperWithClient();
    const { result } = renderHook(() => useMarkDone('v1', 'card-1'), { wrapper });

    act(() => { result.current.mutate({ doneAtMileage: 52000, notes: null }); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.post).toHaveBeenCalledWith(
      '/vehicles/v1/maintenance-cards/card-1/mark-done',
      { doneAtMileage: 52000, notes: null },
    );
  });

  it('invalidates [MAINTENANCE_CARDS, vehicleId] on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockHistory);
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useMarkDone('v1', 'card-1'), { wrapper });

    act(() => { result.current.mutate({ doneAtMileage: 52000 }); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: [QueryGroup.MAINTENANCE_CARDS, 'v1'] });
  });

  it('invalidates [VEHICLES, vehicleId] with exact:true on success', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockHistory);
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useMarkDone('v1', 'card-1'), { wrapper });

    act(() => { result.current.mutate({ doneAtMileage: 52000 }); });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({
      queryKey: [QueryGroup.VEHICLES, 'v1'],
      exact: true,
    });
  });

  it('sets isError and does not invalidate cache when POST fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('fail'));
    const { wrapper, queryClient } = createWrapperWithClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useMarkDone('v1', 'card-1'), { wrapper });

    act(() => { result.current.mutate({ doneAtMileage: 52000 }); });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && pnpm exec vitest run src/hooks/mutations/maintenance-cards/useMarkDone.spec.ts
```

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/mutations/maintenance-cards/useMarkDone.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { IMarkDoneReqDTO, IMaintenanceHistoryResDTO } from '@project/types';
import { apiClient } from '@/lib/api-client';
import { QueryGroup } from '@/hooks/queries/keys';

export const useMarkDone = (vehicleId: string, cardId: string) => {
  const queryClient = useQueryClient();

  return useMutation<IMaintenanceHistoryResDTO, Error, IMarkDoneReqDTO>({
    mutationFn: (data) =>
      apiClient.post<IMaintenanceHistoryResDTO>(
        `/vehicles/${vehicleId}/maintenance-cards/${cardId}/mark-done`,
        data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.MAINTENANCE_CARDS, vehicleId],
      });
      void queryClient.invalidateQueries({
        queryKey: [QueryGroup.VEHICLES, vehicleId],
        exact: true,
      });
    },
  });
};
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd frontend && pnpm exec vitest run src/hooks/mutations/maintenance-cards/useMarkDone.spec.ts
```

Expected: 4 tests passing.

- [ ] **Step 5: Format, lint, commit**

```bash
just format && just lint
git add frontend/src/hooks/mutations/maintenance-cards/useMarkDone.ts \
        frontend/src/hooks/mutations/maintenance-cards/useMarkDone.spec.ts
git commit -m "add useMarkDone mutation hook"
```

---

## Task 5: `Dialog` UI primitive

**Files:**
- Create: `frontend/src/components/ui/dialog.tsx`
- Create: `frontend/src/components/ui/dialog.spec.tsx`

Shared by all three dialog components. Backdrop click and Escape key close. No Radix dependency needed.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/ui/dialog.spec.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Dialog } from './dialog';

describe('Dialog', () => {
  it('renders children and title when open is true', () => {
    render(
      <Dialog open={true} onOpenChange={vi.fn()} title="Test Dialog">
        <p>Dialog content</p>
      </Dialog>,
    );
    expect(screen.getByText('Test Dialog')).toBeInTheDocument();
    expect(screen.getByText('Dialog content')).toBeInTheDocument();
  });

  it('renders nothing when open is false', () => {
    render(
      <Dialog open={false} onOpenChange={vi.fn()} title="Test Dialog">
        <p>Dialog content</p>
      </Dialog>,
    );
    expect(screen.queryByText('Dialog content')).not.toBeInTheDocument();
  });

  it('calls onOpenChange(false) when the backdrop is clicked', () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <Dialog open={true} onOpenChange={onOpenChange} title="Test Dialog">
        <p>content</p>
      </Dialog>,
    );
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not call onOpenChange when clicking inside the dialog panel', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open={true} onOpenChange={onOpenChange} title="Test Dialog">
        <p>content</p>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('dialog'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('calls onOpenChange(false) when Escape key is pressed', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open={true} onOpenChange={onOpenChange} title="Test Dialog">
        <p>content</p>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not register Escape listener when closed', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open={false} onOpenChange={onOpenChange} title="Test Dialog">
        <p>content</p>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && pnpm exec vitest run src/components/ui/dialog.spec.tsx
```

- [ ] **Step 3: Implement the Dialog primitive**

Create `frontend/src/components/ui/dialog.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: DialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    if (open) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'w-full max-w-sm rounded-xl bg-background p-6 shadow-xl',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd frontend && pnpm exec vitest run src/components/ui/dialog.spec.tsx
```

Expected: 6 tests passing.

- [ ] **Step 5: Format, lint, commit**

```bash
just format && just lint
git add frontend/src/components/ui/dialog.tsx \
        frontend/src/components/ui/dialog.spec.tsx
git commit -m "add Dialog UI primitive"
```

---

## Task 6: `MaintenanceCardFormDialog`

**Files:**
- Create: `frontend/src/components/maintenance-cards/maintenance-card-form-dialog.tsx`
- Create: `frontend/src/components/maintenance-cards/maintenance-card-form-dialog.spec.tsx`

Used for both create (no `card` prop) and edit (`card` prop present). Calls `useCreateMaintenanceCard` or `usePatchMaintenanceCard` depending on mode.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/maintenance-cards/maintenance-card-form-dialog.spec.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { IMaintenanceCardResDTO } from '@project/types';

vi.mock('@/hooks/mutations/maintenance-cards/useCreateMaintenanceCard', () => ({
  useCreateMaintenanceCard: vi.fn(),
}));
vi.mock('@/hooks/mutations/maintenance-cards/usePatchMaintenanceCard', () => ({
  usePatchMaintenanceCard: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
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

import { useCreateMaintenanceCard } from '@/hooks/mutations/maintenance-cards/useCreateMaintenanceCard';
import { usePatchMaintenanceCard } from '@/hooks/mutations/maintenance-cards/usePatchMaintenanceCard';
import { MaintenanceCardFormDialog } from './maintenance-card-form-dialog';

const mockCard: IMaintenanceCardResDTO = {
  id: 'card-1',
  vehicleId: 'v1',
  type: 'part',
  name: 'Tyre Rotation',
  description: 'Front and rear',
  intervalMileage: 10000,
  intervalTimeMonths: 12,
  nextDueMileage: 60000,
  nextDueDate: '2027-01-01',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockMutate = vi.fn();

describe('MaintenanceCardFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateMaintenanceCard).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof useCreateMaintenanceCard>);
    vi.mocked(usePatchMaintenanceCard).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof usePatchMaintenanceCard>);
  });

  it('shows "New Maintenance Card" title in create mode', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
      />,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-label',
      'New Maintenance Card',
    );
  });

  it('shows "Edit Maintenance Card" title in edit mode', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
        card={mockCard}
      />,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-label',
      'Edit Maintenance Card',
    );
  });

  it('pre-fills all fields from card prop in edit mode', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
        card={mockCard}
      />,
    );
    expect(screen.getByPlaceholderText('e.g. Oil Change')).toHaveValue(
      'Tyre Rotation',
    );
    expect(screen.getByPlaceholderText('Optional notes…')).toHaveValue(
      'Front and rear',
    );
    expect(screen.getByPlaceholderText('e.g. 5000')).toHaveValue(10000);
    expect(screen.getByPlaceholderText('e.g. 6')).toHaveValue(12);
  });

  it('disables Save when name is empty', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
      />,
    );
    // No name, no intervals — Save is disabled
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('disables Save when name is filled but no interval is set', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'My Card' },
    });
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('enables Save when name and at least one interval are filled', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'My Card' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 5000'), {
      target: { value: '5000' },
    });
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls createMutation.mutate with correct data in create mode when Save is clicked', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'Oil Change' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 5000'), {
      target: { value: '5000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      {
        type: 'task',
        name: 'Oil Change',
        description: null,
        intervalMileage: 5000,
        intervalTimeMonths: null,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('calls patchMutation.mutate in edit mode when Save is clicked', () => {
    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={vi.fn()}
        vehicleId="v1"
        card={mockCard}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tyre Rotation' }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('calls onOpenChange(false) and shows toast when onSuccess fires in create mode', () => {
    const onOpenChange = vi.fn();
    const { toast } = require('sonner');

    vi.mocked(useCreateMaintenanceCard).mockReturnValue({
      mutate: (
        _data: unknown,
        opts: { onSuccess: () => void },
      ) => opts.onSuccess(),
      isPending: false,
    } as ReturnType<typeof useCreateMaintenanceCard>);

    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={onOpenChange}
        vehicleId="v1"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('e.g. Oil Change'), {
      target: { value: 'New Card' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. 5000'), {
      target: { value: '3000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(toast.success).toHaveBeenCalledWith('Card created');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) and shows toast when onSuccess fires in edit mode', () => {
    const onOpenChange = vi.fn();
    const { toast } = require('sonner');

    vi.mocked(usePatchMaintenanceCard).mockReturnValue({
      mutate: (
        _data: unknown,
        opts: { onSuccess: () => void },
      ) => opts.onSuccess(),
      isPending: false,
    } as ReturnType<typeof usePatchMaintenanceCard>);

    render(
      <MaintenanceCardFormDialog
        open={true}
        onOpenChange={onOpenChange}
        vehicleId="v1"
        card={mockCard}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(toast.success).toHaveBeenCalledWith('Card updated');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && pnpm exec vitest run src/components/maintenance-cards/maintenance-card-form-dialog.spec.tsx
```

- [ ] **Step 3: Implement `MaintenanceCardFormDialog`**

Create `frontend/src/components/maintenance-cards/maintenance-card-form-dialog.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { IMaintenanceCardResDTO } from '@project/types';
import { MAINTENANCE_CARD_TYPES } from '@project/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCreateMaintenanceCard } from '@/hooks/mutations/maintenance-cards/useCreateMaintenanceCard';
import { usePatchMaintenanceCard } from '@/hooks/mutations/maintenance-cards/usePatchMaintenanceCard';
import { cn } from '@/lib/utils';

interface MaintenanceCardFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  card?: IMaintenanceCardResDTO;
}

const TYPES = [
  { value: MAINTENANCE_CARD_TYPES.TASK, label: 'Task' },
  { value: MAINTENANCE_CARD_TYPES.PART, label: 'Part' },
  { value: MAINTENANCE_CARD_TYPES.ITEM, label: 'Item' },
] as const;

export function MaintenanceCardFormDialog({
  open,
  onOpenChange,
  vehicleId,
  card,
}: MaintenanceCardFormDialogProps) {
  const isEdit = !!card;

  const [type, setType] = useState<IMaintenanceCardResDTO['type']>(
    MAINTENANCE_CARD_TYPES.TASK,
  );
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [intervalMileage, setIntervalMileage] = useState('');
  const [intervalTimeMonths, setIntervalTimeMonths] = useState('');

  useEffect(() => {
    if (open) {
      setType(card?.type ?? MAINTENANCE_CARD_TYPES.TASK);
      setName(card?.name ?? '');
      setDescription(card?.description ?? '');
      setIntervalMileage(card?.intervalMileage?.toString() ?? '');
      setIntervalTimeMonths(card?.intervalTimeMonths?.toString() ?? '');
    }
  }, [open, card]);

  const createMutation = useCreateMaintenanceCard(vehicleId);
  const patchMutation = usePatchMaintenanceCard(vehicleId, card?.id ?? '');

  const parsedIntervalMileage = intervalMileage.trim()
    ? parseInt(intervalMileage, 10)
    : null;
  const parsedIntervalTimeMonths = intervalTimeMonths.trim()
    ? parseInt(intervalTimeMonths, 10)
    : null;

  const isValid =
    name.trim().length > 0 &&
    (parsedIntervalMileage !== null || parsedIntervalTimeMonths !== null) &&
    (parsedIntervalMileage === null || parsedIntervalMileage > 0) &&
    (parsedIntervalTimeMonths === null || parsedIntervalTimeMonths > 0);

  const isPending = createMutation.isPending || patchMutation.isPending;

  const handleSave = () => {
    const data = {
      type,
      name: name.trim(),
      description: description.trim() || null,
      intervalMileage: parsedIntervalMileage,
      intervalTimeMonths: parsedIntervalTimeMonths,
    };

    if (isEdit) {
      patchMutation.mutate(data, {
        onSuccess: () => {
          toast.success('Card updated');
          onOpenChange(false);
        },
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success('Card created');
          onOpenChange(false);
        },
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit Maintenance Card' : 'New Maintenance Card'}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Type
          </label>
          <div className="flex gap-1.5">
            {TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-xs',
                  type === value
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : 'border-input bg-background',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Oil Change"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes…"
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Every (km)
            </label>
            <input
              type="number"
              min={1}
              value={intervalMileage}
              onChange={(e) => setIntervalMileage(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Every (months)
            </label>
            <input
              type="number"
              min={1}
              value={intervalTimeMonths}
              onChange={(e) => setIntervalTimeMonths(e.target.value)}
              placeholder="e.g. 6"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          At least one interval is required.
        </p>

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

- [ ] **Step 4: Run test — expect PASS**

```bash
cd frontend && pnpm exec vitest run src/components/maintenance-cards/maintenance-card-form-dialog.spec.tsx
```

Expected: 9 tests passing.

- [ ] **Step 5: Format, lint, commit**

```bash
just format && just lint
git add frontend/src/components/maintenance-cards/maintenance-card-form-dialog.tsx \
        frontend/src/components/maintenance-cards/maintenance-card-form-dialog.spec.tsx
git commit -m "add MaintenanceCardFormDialog for create and edit"
```

---

## Task 7: `MarkDoneDialog`

**Files:**
- Create: `frontend/src/components/maintenance-cards/mark-done-dialog.tsx`
- Create: `frontend/src/components/maintenance-cards/mark-done-dialog.spec.tsx`

Mileage field appears only when `card.intervalMileage !== null` and is required when shown.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/maintenance-cards/mark-done-dialog.spec.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { IMaintenanceCardResDTO } from '@project/types';

vi.mock('@/hooks/mutations/maintenance-cards/useMarkDone', () => ({
  useMarkDone: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
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
        {children}
      </div>
    ) : null,
}));

import { useMarkDone } from '@/hooks/mutations/maintenance-cards/useMarkDone';
import { MarkDoneDialog } from './mark-done-dialog';

const mockMutate = vi.fn();

const cardWithMileage: IMaintenanceCardResDTO = {
  id: 'card-1',
  vehicleId: 'v1',
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

const cardWithoutMileage: IMaintenanceCardResDTO = {
  ...cardWithMileage,
  intervalMileage: null,
  nextDueMileage: null,
};

describe('MarkDoneDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMarkDone).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof useMarkDone>);
  });

  it('shows mileage input when card.intervalMileage is not null', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithMileage}
        vehicleId="v1"
      />,
    );
    expect(
      screen.getByPlaceholderText('Current odometer reading'),
    ).toBeInTheDocument();
  });

  it('hides mileage input when card.intervalMileage is null', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithoutMileage}
        vehicleId="v1"
      />,
    );
    expect(
      screen.queryByPlaceholderText('Current odometer reading'),
    ).not.toBeInTheDocument();
  });

  it('disables Done button when mileage is required but empty', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithMileage}
        vehicleId="v1"
      />,
    );
    expect(screen.getByRole('button', { name: /done/i })).toBeDisabled();
  });

  it('enables Done button when mileage is required and provided', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithMileage}
        vehicleId="v1"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Current odometer reading'), {
      target: { value: '52000' },
    });
    expect(screen.getByRole('button', { name: /done/i })).not.toBeDisabled();
  });

  it('enables Done button when mileage is not required (time-only card)', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithoutMileage}
        vehicleId="v1"
      />,
    );
    expect(screen.getByRole('button', { name: /done/i })).not.toBeDisabled();
  });

  it('calls mutate with correct payload when Done is clicked', () => {
    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={vi.fn()}
        card={cardWithMileage}
        vehicleId="v1"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Current odometer reading'), {
      target: { value: '52000' },
    });
    fireEvent.change(screen.getByPlaceholderText('Optional notes…'), {
      target: { value: 'Used synthetic oil' },
    });
    fireEvent.click(screen.getByRole('button', { name: /done/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      { doneAtMileage: 52000, notes: 'Used synthetic oil' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('calls onOpenChange(false) and shows toast when onSuccess fires', () => {
    const onOpenChange = vi.fn();
    const { toast } = require('sonner');

    vi.mocked(useMarkDone).mockReturnValue({
      mutate: (_data: unknown, opts: { onSuccess: () => void }) =>
        opts.onSuccess(),
      isPending: false,
    } as ReturnType<typeof useMarkDone>);

    render(
      <MarkDoneDialog
        open={true}
        onOpenChange={onOpenChange}
        card={cardWithoutMileage}
        vehicleId="v1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /done/i }));

    expect(toast.success).toHaveBeenCalledWith('Marked as done');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && pnpm exec vitest run src/components/maintenance-cards/mark-done-dialog.spec.tsx
```

- [ ] **Step 3: Implement `MarkDoneDialog`**

Create `frontend/src/components/maintenance-cards/mark-done-dialog.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { IMaintenanceCardResDTO } from '@project/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMarkDone } from '@/hooks/mutations/maintenance-cards/useMarkDone';

interface MarkDoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: IMaintenanceCardResDTO;
  vehicleId: string;
}

export function MarkDoneDialog({
  open,
  onOpenChange,
  card,
  vehicleId,
}: MarkDoneDialogProps) {
  const [doneAtMileage, setDoneAtMileage] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setDoneAtMileage('');
      setNotes('');
    }
  }, [open]);

  const markDone = useMarkDone(vehicleId, card.id);
  const requiresMileage = card.intervalMileage !== null;
  const parsedMileage = doneAtMileage.trim() ? parseFloat(doneAtMileage) : null;
  const isValid = !requiresMileage || (parsedMileage !== null && parsedMileage > 0);

  const handleDone = () => {
    markDone.mutate(
      { doneAtMileage: parsedMileage, notes: notes.trim() || null },
      {
        onSuccess: () => {
          toast.success('Marked as done');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Mark as Done">
      <div className="flex flex-col gap-4">
        {requiresMileage && (
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Done at mileage <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={doneAtMileage}
              onChange={(e) => setDoneAtMileage(e.target.value)}
              placeholder="Current odometer reading"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…"
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={markDone.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleDone}
            disabled={!isValid || markDone.isPending}
          >
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd frontend && pnpm exec vitest run src/components/maintenance-cards/mark-done-dialog.spec.tsx
```

Expected: 7 tests passing.

- [ ] **Step 5: Format, lint, commit**

```bash
just format && just lint
git add frontend/src/components/maintenance-cards/mark-done-dialog.tsx \
        frontend/src/components/maintenance-cards/mark-done-dialog.spec.tsx
git commit -m "add MarkDoneDialog"
```

---

## Task 8: `DeleteConfirmDialog`

**Files:**
- Create: `frontend/src/components/maintenance-cards/delete-confirm-dialog.tsx`
- Create: `frontend/src/components/maintenance-cards/delete-confirm-dialog.spec.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/maintenance-cards/delete-confirm-dialog.spec.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { IMaintenanceCardResDTO } from '@project/types';

vi.mock('@/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard', () => ({
  useDeleteMaintenanceCard: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    title: string;
    children: React.ReactNode;
  }) => (open ? <div role="dialog">{children}</div> : null),
}));

import { useDeleteMaintenanceCard } from '@/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard';
import { DeleteConfirmDialog } from './delete-confirm-dialog';

const mockMutate = vi.fn();

const mockCard: IMaintenanceCardResDTO = {
  id: 'card-1',
  vehicleId: 'v1',
  type: 'task',
  name: 'Oil Change',
  description: null,
  intervalMileage: 5000,
  intervalTimeMonths: null,
  nextDueMileage: null,
  nextDueDate: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('DeleteConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeleteMaintenanceCard).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as ReturnType<typeof useDeleteMaintenanceCard>);
  });

  it('shows the card name in the confirmation message', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCard}
        vehicleId="v1"
      />,
    );
    expect(screen.getByText(/Oil Change/)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('calls Cancel without mutating when Cancel is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <DeleteConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        card={mockCard}
        vehicleId="v1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockMutate).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls mutate with cardId when Delete is clicked', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCard}
        vehicleId="v1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      'card-1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('calls onOpenChange(false) and shows toast when onSuccess fires', () => {
    const onOpenChange = vi.fn();
    const { toast } = require('sonner');

    vi.mocked(useDeleteMaintenanceCard).mockReturnValue({
      mutate: (_cardId: string, opts: { onSuccess: () => void }) =>
        opts.onSuccess(),
      isPending: false,
    } as ReturnType<typeof useDeleteMaintenanceCard>);

    render(
      <DeleteConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        card={mockCard}
        vehicleId="v1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(toast.success).toHaveBeenCalledWith('Card deleted');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd frontend && pnpm exec vitest run src/components/maintenance-cards/delete-confirm-dialog.spec.tsx
```

- [ ] **Step 3: Implement `DeleteConfirmDialog`**

Create `frontend/src/components/maintenance-cards/delete-confirm-dialog.tsx`:

```typescript
'use client';

import { toast } from 'sonner';
import type { IMaintenanceCardResDTO } from '@project/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeleteMaintenanceCard } from '@/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: IMaintenanceCardResDTO;
  vehicleId: string;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  card,
  vehicleId,
}: DeleteConfirmDialogProps) {
  const deleteMutation = useDeleteMaintenanceCard(vehicleId);

  const handleDelete = () => {
    deleteMutation.mutate(card.id, {
      onSuccess: () => {
        toast.success('Card deleted');
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Delete Card">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Delete &ldquo;{card.name}&rdquo;? This cannot be undone.
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

- [ ] **Step 4: Run test — expect PASS**

```bash
cd frontend && pnpm exec vitest run src/components/maintenance-cards/delete-confirm-dialog.spec.tsx
```

Expected: 4 tests passing.

- [ ] **Step 5: Format, lint, commit**

```bash
just format && just lint
git add frontend/src/components/maintenance-cards/delete-confirm-dialog.tsx \
        frontend/src/components/maintenance-cards/delete-confirm-dialog.spec.tsx
git commit -m "add DeleteConfirmDialog"
```

---

## Task 9: Update `MaintenanceCardRow` — add ⋮ dropdown

**Files:**
- Modify: `frontend/src/components/maintenance-cards/maintenance-card-row.tsx`
- Modify: `frontend/src/components/maintenance-cards/maintenance-card-row.spec.tsx`

Adds four new props. The ⋮ button calls `onDropdownToggle` with `e.stopPropagation()` so the page-level document click listener doesn't immediately close the dropdown.

- [ ] **Step 1: Add new tests to the spec**

Replace the contents of `frontend/src/components/maintenance-cards/maintenance-card-row.spec.tsx` with the full updated spec — keep all existing tests and append the new ones:

```typescript
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
    expect(screen.getByRole('button', { name: /actions/i })).toBeInTheDocument();
  });

  it('does not show dropdown items when isDropdownOpen is false', () => {
    render(<MaintenanceCardRow {...defaultProps} isDropdownOpen={false} />);
    expect(screen.queryByRole('button', { name: /mark done/i })).not.toBeInTheDocument();
  });

  it('shows Mark Done, Edit, Delete when isDropdownOpen is true', () => {
    render(<MaintenanceCardRow {...defaultProps} isDropdownOpen={true} />);
    expect(screen.getByRole('button', { name: /mark done/i })).toBeInTheDocument();
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
```

- [ ] **Step 2: Run test — expect FAIL on new tests**

```bash
cd frontend && pnpm exec vitest run src/components/maintenance-cards/maintenance-card-row.spec.tsx
```

Expected: existing tests pass, new dropdown tests fail (missing props/elements).

- [ ] **Step 3: Update `MaintenanceCardRow`**

Replace the contents of `frontend/src/components/maintenance-cards/maintenance-card-row.tsx`:

```typescript
'use client';

import type { IMaintenanceCardResDTO, IVehicleResDTO } from '@project/types';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { getCardWarningStatus } from '@/lib/warning';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<IMaintenanceCardResDTO['type'], string> = {
  task: 'Task',
  part: 'Part',
  item: 'Item',
};

interface MaintenanceCardRowProps {
  card: IMaintenanceCardResDTO;
  vehicle: IVehicleResDTO;
  isDropdownOpen: boolean;
  onDropdownToggle: (cardId: string | null) => void;
  onEdit: (card: IMaintenanceCardResDTO) => void;
  onMarkDone: (card: IMaintenanceCardResDTO) => void;
  onDelete: (card: IMaintenanceCardResDTO) => void;
}

export function MaintenanceCardRow({
  card,
  vehicle,
  isDropdownOpen,
  onDropdownToggle,
  onEdit,
  onMarkDone,
  onDelete,
}: MaintenanceCardRowProps) {
  const { data: config } = useAppConfig();
  const thresholdKm = config?.mileageWarningThresholdKm ?? 500;

  const status = getCardWarningStatus(
    card,
    vehicle.mileage,
    vehicle.mileageUnit,
    thresholdKm,
  );

  const remaining =
    card.nextDueMileage !== null ? card.nextDueMileage - vehicle.mileage : null;

  const mileageLabel = (() => {
    if (remaining === null) return null;
    if (remaining <= 0) return 'OVERDUE';
    return `${Math.round(remaining).toLocaleString()} ${vehicle.mileageUnit} left`;
  })();

  return (
    <div
      className={cn(
        'relative flex items-center justify-between rounded-md border px-4 py-3',
        status === 'overdue' && 'border-destructive/40 bg-destructive/10',
        status === 'warning' &&
          'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{card.name}</span>
        <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
          {TYPE_LABELS[card.type]}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {mileageLabel && (
          <span
            className={cn(
              'text-xs font-semibold',
              status === 'overdue' && 'text-destructive',
              status === 'warning' && 'text-yellow-700 dark:text-yellow-400',
            )}
          >
            {mileageLabel}
          </span>
        )}

        <div className="relative">
          <button
            type="button"
            aria-label="actions"
            onClick={(e) => {
              e.stopPropagation();
              onDropdownToggle(isDropdownOpen ? null : card.id);
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            ⋮
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 top-7 z-10 min-w-[140px] rounded-lg border bg-background shadow-md">
              <button
                type="button"
                onClick={() => onMarkDone(card)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                Mark Done
              </button>
              <button
                type="button"
                onClick={() => onEdit(card)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(card)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-accent"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test — expect all PASS**

```bash
cd frontend && pnpm exec vitest run src/components/maintenance-cards/maintenance-card-row.spec.tsx
```

Expected: all tests passing (including existing ones).

- [ ] **Step 5: Format, lint, commit**

```bash
just format && just lint
git add frontend/src/components/maintenance-cards/maintenance-card-row.tsx \
        frontend/src/components/maintenance-cards/maintenance-card-row.spec.tsx
git commit -m "update MaintenanceCardRow with dropdown actions"
```

---

## Task 10: Update `VehicleDashboardPage` — state, FAB, dialogs

**Files:**
- Modify: `frontend/src/components/pages/vehicle-dashboard-page.tsx`
- Modify: `frontend/src/components/pages/vehicle-dashboard-page.spec.tsx`

- [ ] **Step 1: Add new tests to the spec**

Replace the full contents of `frontend/src/components/pages/vehicle-dashboard-page.spec.tsx`:

```typescript
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
  }) =>
    open ? <div data-testid="mark-done-dialog">{card.id}</div> : null,
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
  }) =>
    open ? <div data-testid="delete-dialog">{card.id}</div> : null,
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
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Toyota Camry');
    expect(screen.getByText(/silver/i)).toBeInTheDocument();
  });

  it('calls useMaintenanceCards with sort=name when Name button is clicked', () => {
    setupVehicleLoaded();
    render(<VehicleDashboardPage vehicleId="vehicle-1" />);
    fireEvent.click(screen.getByRole('button', { name: /^name$/i }));
    expect(vi.mocked(useMaintenanceCards)).toHaveBeenCalledWith('vehicle-1', 'name');
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
    fireEvent.click(screen.getByRole('button', { name: /add maintenance card/i }));
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
```

- [ ] **Step 2: Run test — expect FAIL on new tests**

```bash
cd frontend && pnpm exec vitest run src/components/pages/vehicle-dashboard-page.spec.tsx
```

Expected: existing tests pass, new FAB/dialog tests fail.

- [ ] **Step 3: Update `VehicleDashboardPage`**

Replace the contents of `frontend/src/components/pages/vehicle-dashboard-page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth/auth-guard';
import { MileagePrompt } from '@/components/vehicles/mileage-prompt';
import { MaintenanceCardRow } from '@/components/maintenance-cards/maintenance-card-row';
import { MaintenanceCardFormDialog } from '@/components/maintenance-cards/maintenance-card-form-dialog';
import { MarkDoneDialog } from '@/components/maintenance-cards/mark-done-dialog';
import { DeleteConfirmDialog } from '@/components/maintenance-cards/delete-confirm-dialog';
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
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<IMaintenanceCardResDTO | null>(
    null,
  );
  const [markingDoneCard, setMarkingDoneCard] =
    useState<IMaintenanceCardResDTO | null>(null);
  const [deletingCard, setDeletingCard] =
    useState<IMaintenanceCardResDTO | null>(null);

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

  // Close dropdown when user clicks anywhere on the document
  useEffect(() => {
    const close = () => setActiveDropdownId(null);
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
    <main className="relative flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">
          {vehicle.brand} {vehicle.model}
        </h1>
        <p className="text-muted-foreground text-sm">
          {vehicle.colour} &middot; {vehicle.mileage.toLocaleString()}{' '}
          {vehicle.mileageUnit}
        </p>
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

      {cardsLoading ? (
        <p className="text-muted-foreground text-sm">Loading cards…</p>
      ) : cards.length === 0 ? (
        <p className="text-muted-foreground text-sm">No maintenance cards yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {cards.map((card) => (
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
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        aria-label="Add maintenance card"
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
      >
        <span className="text-2xl font-light leading-none">+</span>
      </button>

      {/* Dialogs */}
      <MaintenanceCardFormDialog
        open={createOpen || !!editingCard}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditingCard(null);
          }
        }}
        vehicleId={vehicleId}
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

- [ ] **Step 4: Run test — expect all PASS**

```bash
cd frontend && pnpm exec vitest run src/components/pages/vehicle-dashboard-page.spec.tsx
```

Expected: all tests passing.

- [ ] **Step 5: Run full frontend test suite**

```bash
cd frontend && pnpm exec vitest run
```

Expected: all tests passing across the full frontend suite.

- [ ] **Step 6: Format and lint**

```bash
just format && just lint
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/pages/vehicle-dashboard-page.tsx \
        frontend/src/components/pages/vehicle-dashboard-page.spec.tsx
git commit -m "update VehicleDashboardPage with FAB, dialogs, and dropdown wiring"
```

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
  vehicleMileage: number;
  vehicleMileageUnit: string;
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
  vehicleMileage,
  vehicleMileageUnit,
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
  const [nextDueMileage, setNextDueMileage] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');

  useEffect(() => {
    if (open) {
      setType(card?.type ?? MAINTENANCE_CARD_TYPES.TASK);
      setName(card?.name ?? '');
      setDescription(card?.description ?? '');
      setIntervalMileage(card?.intervalMileage?.toString() ?? '');
      setIntervalTimeMonths(card?.intervalTimeMonths?.toString() ?? '');
      setNextDueMileage(card?.nextDueMileage?.toString() ?? '');
      setNextDueDate(card?.nextDueDate ?? '');
    }
  }, [open, card]);

  const createMutation = useCreateMaintenanceCard(vehicleId);
  const patchMutation = usePatchMaintenanceCard(vehicleId, card?.id ?? '');

  const parsedIntervalMileage = (() => {
    const n = parseInt(intervalMileage, 10);
    return intervalMileage.trim() && !isNaN(n) ? n : null;
  })();
  const parsedIntervalTimeMonths = (() => {
    const n = parseInt(intervalTimeMonths, 10);
    return intervalTimeMonths.trim() && !isNaN(n) ? n : null;
  })();
  const parsedNextDueMileage = (() => {
    const n = parseInt(nextDueMileage, 10);
    return nextDueMileage.trim() && !isNaN(n) ? n : null;
  })();

  const isValid =
    name.trim().length > 0 &&
    (parsedIntervalMileage !== null || parsedIntervalTimeMonths !== null) &&
    (parsedIntervalMileage === null || parsedIntervalMileage > 0) &&
    (parsedIntervalTimeMonths === null || parsedIntervalTimeMonths > 0);

  const isPending = createMutation.isPending || patchMutation.isPending;

  const handleSave = () => {
    const finalNextDueMileage =
      parsedNextDueMileage !== null
        ? parsedNextDueMileage
        : parsedIntervalMileage !== null
          ? vehicleMileage + parsedIntervalMileage
          : null;

    const finalNextDueDate =
      nextDueDate.trim() ||
      (() => {
        if (parsedIntervalTimeMonths !== null) {
          const d = new Date();
          d.setMonth(d.getMonth() + parsedIntervalTimeMonths);
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }
        return null;
      })();

    const data = {
      type,
      name: name.trim(),
      description: description.trim() || null,
      intervalMileage: parsedIntervalMileage,
      intervalTimeMonths: parsedIntervalTimeMonths,
      nextDueMileage: finalNextDueMileage,
      nextDueDate: finalNextDueDate,
    };

    if (isEdit) {
      patchMutation.mutate(data, {
        onSuccess: () => {
          toast.success('Card updated');
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err.message ?? 'Something went wrong');
        },
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success('Card created');
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
              Every ({vehicleMileageUnit})
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Next due ({vehicleMileageUnit})
            </label>
            <input
              type="number"
              min={1}
              value={nextDueMileage}
              onChange={(e) => setNextDueMileage(e.target.value)}
              placeholder={
                parsedIntervalMileage !== null
                  ? String(vehicleMileage + parsedIntervalMileage)
                  : 'Auto'
              }
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Next due (date)
            </label>
            <input
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leave next due blank to auto-calculate from intervals.
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

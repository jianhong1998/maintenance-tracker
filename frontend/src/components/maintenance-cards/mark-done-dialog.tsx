'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { IMaintenanceCardResDTO } from '@project/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMarkDone } from '@/hooks/mutations/maintenance-cards/useMarkDone';
import { parsePositiveInteger } from '@/lib/utils';

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
  const parsedMileage = parsePositiveInteger(doneAtMileage);
  const isValid = !requiresMileage || parsedMileage !== null;

  const handleDone = () => {
    markDone.mutate(
      { doneAtMileage: parsedMileage, notes: notes.trim() || null },
      {
        onSuccess: () => {
          toast.success('Marked as done');
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err.message ?? 'Something went wrong');
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Mark as Done"
    >
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

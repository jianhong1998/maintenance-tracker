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
  currentMileage: number;
}

export function MarkDoneDialog({
  open,
  onOpenChange,
  card,
  vehicleId,
  currentMileage,
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
  const isValid =
    !requiresMileage ||
    (parsedMileage !== null && parsedMileage >= currentMileage);

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
            <label className="text-eyebrow mb-1 block">
              Done at mileage <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={doneAtMileage}
              onChange={(e) => setDoneAtMileage(e.target.value)}
              placeholder="Current odometer reading"
              className="w-full rounded-lg border border-primary-dim bg-[color:var(--bg-base)] px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:ring-2 focus:ring-[#00e5ff40]"
            />
          </div>
        )}

        <div>
          <label className="text-eyebrow mb-1 block">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…"
            rows={2}
            className="w-full rounded-lg border border-primary-dim bg-[color:var(--bg-base)] px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:ring-2 focus:ring-[#00e5ff40]"
          />
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={markDone.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
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

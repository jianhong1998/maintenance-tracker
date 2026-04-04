'use client';

import { useEffect, useState } from 'react';
import { usePatchVehicle } from '@/hooks/mutations/vehicles/usePatchVehicle';
import { Button } from '@/components/ui/button';

interface MileagePromptProps {
  vehicleId: string;
  currentMileage: number;
}

export function getTodayKey(vehicleId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `mileage_prompted_${vehicleId}_${today}`;
}

export function MileagePrompt({
  vehicleId,
  currentMileage,
}: MileagePromptProps) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const { mutate: patchVehicle, isError } = usePatchVehicle(vehicleId);

  useEffect(() => {
    const key = getTodayKey(vehicleId);
    if (!localStorage.getItem(key)) {
      setVisible(true);
    }
  }, [vehicleId]);

  const dismiss = () => {
    localStorage.setItem(getTodayKey(vehicleId), '1');
    setVisible(false);
  };

  const parsedValue = parseFloat(value.trim());
  const isBelowCurrent = !isNaN(parsedValue) && parsedValue < currentMileage;

  const handleSubmit = () => {
    if (isNaN(parsedValue) || isBelowCurrent) return;
    patchVehicle({ mileage: parsedValue }, { onSuccess: dismiss });
  };

  if (!visible) return null;

  return (
    <div className="rounded-lg border bg-muted p-4">
      <p className="mb-2 text-sm font-medium">
        What&apos;s your current odometer reading?
      </p>
      {isError && (
        <p className="text-destructive mb-2 text-xs">
          Failed to update mileage. Please try again.
        </p>
      )}
      {isBelowCurrent && (
        <p className="text-destructive mb-2 text-xs">
          Mileage cannot be less than current ({currentMileage})
        </p>
      )}
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter mileage"
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!value.trim() || isNaN(parseFloat(value)) || isBelowCurrent}
        >
          Update
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={dismiss}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

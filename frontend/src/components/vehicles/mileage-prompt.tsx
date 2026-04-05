'use client';

import { FC, useEffect, useState } from 'react';
import { useRecordMileage } from '@/hooks/mutations/vehicles/useRecordMileage';
import { Button } from '@/components/ui/button';

interface MileagePromptProps {
  vehicleId: string;
  currentMileage: number;
  mileageLastUpdatedAt: string | null;
}

const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const getTodayLocalDateString = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const getDismissKey = (vehicleId: string): string =>
  `dismissMileagePromptDate_${vehicleId}`;

export const MileagePrompt: FC<MileagePromptProps> = ({
  vehicleId,
  currentMileage,
  mileageLastUpdatedAt,
}) => {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const { mutate: recordMileage, isError } = useRecordMileage(vehicleId);

  useEffect(() => {
    const updatedToday =
      mileageLastUpdatedAt !== null &&
      isSameLocalDay(new Date(mileageLastUpdatedAt), new Date());

    const dismissedDate = localStorage.getItem(getDismissKey(vehicleId));
    const dismissedToday = dismissedDate === getTodayLocalDateString();

    if (!updatedToday && !dismissedToday) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [vehicleId, mileageLastUpdatedAt]);

  const dismiss = () => {
    localStorage.setItem(getDismissKey(vehicleId), getTodayLocalDateString());
    setVisible(false);
  };

  const parsedValue = parseFloat(value.trim());
  const isBelowCurrent = !isNaN(parsedValue) && parsedValue < currentMileage;

  const handleSubmit = () => {
    if (isNaN(parsedValue) || isBelowCurrent) return;
    recordMileage(
      { mileage: parsedValue },
      { onSuccess: () => setVisible(false) },
    );
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
          disabled={!value.trim() || isNaN(parsedValue) || isBelowCurrent}
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
};

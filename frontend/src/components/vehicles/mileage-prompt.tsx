'use client';

import { FC, useEffect, useState } from 'react';
import { useRecordMileage } from '@/hooks/mutations/vehicles/useRecordMileage';
import { MileagePromptPresentation } from './mileage-prompt-presentation';

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
    recordMileage(
      { mileage: parsedValue },
      { onSuccess: () => setVisible(false) },
    );
  };

  if (!visible) return null;

  return (
    <MileagePromptPresentation
      currentMileage={currentMileage}
      value={value}
      isError={isError}
      isBelowCurrent={isBelowCurrent}
      onValueChange={setValue}
      onSubmit={handleSubmit}
      onDismiss={dismiss}
    />
  );
};

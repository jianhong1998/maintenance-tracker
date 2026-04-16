import type { FC } from 'react';
import { Button } from '@/components/ui/button';

type MileagePromptPresentationProps = {
  currentMileage: number;
  value: string;
  isError: boolean;
  isBelowCurrent: boolean;
  isSubmitDisabled: boolean;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onDismiss: () => void;
};

export const MileagePromptPresentation: FC<MileagePromptPresentationProps> = ({
  currentMileage,
  value,
  isError,
  isBelowCurrent,
  isSubmitDisabled,
  onValueChange,
  onSubmit,
  onDismiss,
}) => {
  return (
    <div className="mx-[10px] mb-[6px] rounded-lg border border-primary-dim bg-[color:var(--bg-card)] p-2">
      <p className="text-eyebrow-primary mb-2">UPDATE ODOMETER</p>
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
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="Enter mileage"
          className="flex-1 rounded-lg border border-primary-dim bg-[color:var(--bg-base)] px-3 py-2 text-sm text-white placeholder:text-[#444] focus:outline-none focus:ring-2 focus:ring-[#00e5ff40]"
        />
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={isSubmitDisabled}
          className="text-xs tracking-widest"
        >
          OK
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="text-[#555] text-xs"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
};

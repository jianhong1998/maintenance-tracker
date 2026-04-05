import { FC } from 'react';
import { Button } from '@/components/ui/button';

type MileagePromptPresentationProps = {
  currentMileage: number;
  value: string;
  isError: boolean;
  isBelowCurrent: boolean;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onDismiss: () => void;
};

export const MileagePromptPresentation: FC<MileagePromptPresentationProps> = ({
  currentMileage,
  value,
  isError,
  isBelowCurrent,
  onValueChange,
  onSubmit,
  onDismiss,
}) => {
  const parsedValue = parseFloat(value.trim());

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
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="Enter mileage"
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={!value.trim() || isNaN(parsedValue) || isBelowCurrent}
        >
          Update
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
};

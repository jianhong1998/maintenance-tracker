import type { FC } from 'react';
import { cn } from '@/lib/utils';

type VehicleStatusChipProps = {
  count: number;
  className?: string;
};

export const VehicleStatusChip: FC<VehicleStatusChipProps> = ({
  count,
  className,
}) => {
  const hasWarning = count > 0;

  return (
    <span
      data-testid={hasWarning ? 'status-chip-warning' : 'status-chip-ok'}
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-status-chip border',
        hasWarning
          ? 'bg-[#ff444418] border-[#ff444440] text-[#ff4444]'
          : 'bg-[#00e5ff10] border-[#00e5ff25] text-[#00e5ff]',
        className,
      )}
    >
      {hasWarning ? `${count} AT RISK` : 'ALL GOOD'}
    </span>
  );
};

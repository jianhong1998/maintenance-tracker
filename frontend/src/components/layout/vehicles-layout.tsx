'use client';

import type { FC, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { IVehicleResDTO } from '@project/types';
import { useVehicles } from '@/hooks/queries/vehicles/useVehicles';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import { countWarningCards } from '@/lib/warning';
import { getVehicleDisplayLabels } from '@/lib/vehicle-display';
import { VehicleStatusChip } from '@/components/vehicles/vehicle-status-chip';
import { cn } from '@/lib/utils';
import { DEFAULT_MILEAGE_WARNING_THRESHOLD_KM } from '@/constants';

type VehicleListItemProps = {
  vehicle: IVehicleResDTO;
  thresholdKm: number;
  isActive: boolean;
};

const VehicleListItem: FC<VehicleListItemProps> = ({
  vehicle,
  thresholdKm,
  isActive,
}) => {
  // N+1 assumption: each VehicleListItem fires its own useMaintenanceCards query.
  // This is acceptable only because TanStack Query caches per-vehicle card data
  // after the user visits VehicleDashboardPage — subsequent sidebar renders hit
  // the cache, not the network. On a cold-load with many vehicles this is N
  // parallel requests; consider fetching a summary count from the backend if
  // fleet sizes grow beyond ~10 vehicles.
  const { data: cards = [] } = useMaintenanceCards(vehicle.id);
  const warningCount = countWarningCards(
    cards,
    vehicle.mileage,
    vehicle.mileageUnit,
    thresholdKm,
  );
  const { primary } = getVehicleDisplayLabels(vehicle);

  return (
    <Link
      href={`/vehicles/${vehicle.id}`}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'block rounded-xl border px-3 py-2.5 transition-colors',
        isActive
          ? 'bg-[color:var(--bg-card)] border-[#00e5ff30] text-white'
          : 'bg-transparent border-[#ffffff10] text-[#888] hover-pointer:bg-[color:var(--bg-card)] hover-pointer:text-white',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-card-title truncate">{primary}</p>
          <p className="text-meta truncate">
            {vehicle.mileage.toLocaleString()} {vehicle.mileageUnit}
          </p>
        </div>
        <VehicleStatusChip count={warningCount} />
      </div>
    </Link>
  );
};

type VehiclesLayoutProps = {
  children: ReactNode;
};

export const VehiclesLayout: FC<VehiclesLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: config } = useAppConfig();
  const thresholdKm =
    config?.mileageWarningThresholdKm ?? DEFAULT_MILEAGE_WARNING_THRESHOLD_KM;

  return (
    <div className="flex min-h-screen">
      {/* Desktop-only vehicle list panel */}
      <aside className="hidden xl:flex flex-col w-[220px] flex-shrink-0 border-r border-[#ffffff10] bg-[color:var(--bg-base)] px-3 py-4 overflow-y-auto">
        <p className="text-eyebrow mb-3 px-1">YOUR VEHICLES</p>
        {isLoading ? (
          <p className="text-[#444] text-xs px-1">Loading…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {vehicles.map((vehicle) => (
              <VehicleListItem
                key={vehicle.id}
                vehicle={vehicle}
                thresholdKm={thresholdKm}
                isActive={pathname === `/vehicles/${vehicle.id}`}
              />
            ))}
          </div>
        )}
      </aside>

      {/* Detail content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
};

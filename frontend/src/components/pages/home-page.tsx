'use client';

import { useState } from 'react';
import type { FC } from 'react';
import Link from 'next/link';
import { User } from 'lucide-react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { VehicleCard } from '@/components/vehicles/vehicle-card';
import { VehicleFormDialog } from '@/components/vehicles/vehicle-form-dialog';
import { Button } from '@/components/ui/button';
import { useVehicles } from '@/hooks/queries/vehicles/useVehicles';
import { useAppConfig } from '@/hooks/queries/config/useAppConfig';
import { useGlobalWarningCount } from '@/hooks/queries/vehicles/useGlobalWarningCount';
import { DEFAULT_MILEAGE_WARNING_THRESHOLD_KM } from '@/constants';
import { useFeatureFlags } from '@/hooks/queries/feature-flag/useFeatureFlags';

const formatAttentionPill = (count: number): string => {
  if (count === 1) return '1 ITEM NEEDS ATTENTION';
  return `${count} ITEMS NEED ATTENTION`;
};

const HomeContent: FC = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: vehicles = [], isLoading } = useVehicles();
  const { data: config } = useAppConfig();
  const thresholdKm =
    config?.mileageWarningThresholdKm ?? DEFAULT_MILEAGE_WARNING_THRESHOLD_KM;
  const globalWarningCount = useGlobalWarningCount(vehicles, thresholdKm);
  const { data: featureFlags } = useFeatureFlags();

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-[color:var(--bg-surface)] to-[color:var(--bg-base)] px-[12px] pt-[10px] pb-[8px]">
        <div className="flex items-center justify-between mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00e5ff] to-[#0066ff] md:hidden" />
          {featureFlags?.enableProfile && (
            <Link
              href="/profile"
              aria-label="Profile"
              className="w-7 h-7 rounded-full bg-[color:var(--bg-card)] border border-[#ffffff10] flex items-center justify-center ml-auto md:ml-0"
            >
              <User
                size={14}
                className="text-[#444]"
              />
            </Link>
          )}
        </div>
        <p className="text-eyebrow mb-0.5">FLEET OVERVIEW</p>
        <h1 className="text-page-title">Your Vehicles</h1>

        {!isLoading && vehicles.length > 0 && globalWarningCount > 0 && (
          <div className="inline-flex items-center gap-2 mt-3 bg-[color:var(--danger-dim)] border border-[#ff444330] rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--danger)] flex-shrink-0" />
            <span className="text-[color:var(--danger)] text-status-chip">
              {formatAttentionPill(globalWarningCount)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-[10px] py-4 flex flex-col gap-3">
        {isLoading ? (
          <p className="text-[#555] text-sm">Loading vehicles…</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  thresholdKm={thresholdKm}
                />
              ))}
            </div>

            <Button
              variant="dashed-ghost"
              className="w-full py-4 text-xs tracking-widest"
              onClick={() => setCreateOpen(true)}
            >
              + ADD VEHICLE
            </Button>
          </>
        )}
      </div>

      <VehicleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
};

export const HomePage: FC = () => {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
};

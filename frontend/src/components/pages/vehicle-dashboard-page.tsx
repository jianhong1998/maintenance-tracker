'use client';

import { type FC, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth/auth-guard';
import { MileagePrompt } from '@/components/vehicles/mileage-prompt';
import { MaintenanceCardRow } from '@/components/maintenance-cards/maintenance-card-row';
import { MaintenanceCardFormDialog } from '@/components/maintenance-cards/maintenance-card-form-dialog';
import { MarkDoneDialog } from '@/components/maintenance-cards/mark-done-dialog';
import { DeleteConfirmDialog } from '@/components/maintenance-cards/delete-confirm-dialog';
import { VehicleFormDialog } from '@/components/vehicles/vehicle-form-dialog';
import { VehicleDeleteConfirmDialog } from '@/components/vehicles/vehicle-delete-confirm-dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  getVehicleDisplayLabels,
  getVehicleMetaLine,
} from '@/lib/vehicle-display';
import { useVehicle } from '@/hooks/queries/vehicles/useVehicle';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import type { IMaintenanceCardResDTO } from '@project/types';

type VehicleDashboardPageProps = {
  vehicleId: string;
};

const DashboardContent: FC<VehicleDashboardPageProps> = ({ vehicleId }) => {
  const [sort, setSort] = useState<'urgency' | 'name'>('urgency');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<IMaintenanceCardResDTO | null>(
    null,
  );
  const [markingDoneCard, setMarkingDoneCard] =
    useState<IMaintenanceCardResDTO | null>(null);
  const [deletingCard, setDeletingCard] =
    useState<IMaintenanceCardResDTO | null>(null);
  const [editVehicleOpen, setEditVehicleOpen] = useState(false);
  const [deleteVehicleOpen, setDeleteVehicleOpen] = useState(false);

  const router = useRouter();

  const {
    data: vehicle,
    isLoading: vehicleLoading,
    isError,
  } = useVehicle(vehicleId);
  const { data: cards = [], isLoading: cardsLoading } = useMaintenanceCards(
    vehicleId,
    sort,
  );

  useEffect(() => {
    const close = () => setActiveDropdownId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    if (!vehicleLoading && (isError || !vehicle)) {
      router.replace('/');
    }
  }, [vehicleLoading, isError, vehicle, router]);

  if (vehicleLoading) {
    return <p className="text-muted-foreground p-6 text-sm">Loading…</p>;
  }

  if (isError || !vehicle) {
    return null;
  }

  const { primary } = getVehicleDisplayLabels(vehicle);
  const metaLine = getVehicleMetaLine(vehicle);

  const handleEdit = (card: IMaintenanceCardResDTO) => {
    setActiveDropdownId(null);
    setEditingCard(card);
  };

  const handleMarkDone = (card: IMaintenanceCardResDTO) => {
    setActiveDropdownId(null);
    setMarkingDoneCard(card);
  };

  const handleDelete = (card: IMaintenanceCardResDTO) => {
    setActiveDropdownId(null);
    setDeletingCard(card);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Vehicle header */}
      <div className="bg-gradient-to-b from-[color:var(--bg-surface)] to-[color:var(--bg-base)] px-[12px] pt-[10px] pb-[8px]">
        {/* Back nav — hidden on desktop where the split pane owns navigation */}
        <Link
          href="/"
          aria-label="Back to fleet"
          className="inline-flex items-center gap-1 text-primary text-eyebrow mb-1 xl:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e5ff40] rounded"
        >
          <span aria-hidden="true">←</span>
          <span>GO BACK</span>
        </Link>

        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <h1 className="text-page-title truncate">{primary}</h1>
            <p
              data-testid="vehicle-meta-line"
              className="text-[color:var(--text-muted)] text-[0.625rem]"
            >
              {metaLine}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0 pt-1">
            <Button
              size="sm"
              variant="secondary"
              aria-label="Edit vehicle"
              onClick={() => setEditVehicleOpen(true)}
              className="text-xs"
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="secondary-destructive"
              aria-label="Delete vehicle"
              onClick={() => setDeleteVehicleOpen(true)}
              className="text-xs"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <MileagePrompt
          vehicleId={vehicleId}
          currentMileage={vehicle.mileage}
          mileageLastUpdatedAt={vehicle.mileageLastUpdatedAt}
        />

        {/* Sort toggle */}
        <div className="flex gap-2 mx-[10px] mb-[6px]">
          <Button
            size="sm"
            variant={sort === 'urgency' ? 'default' : 'secondary'}
            onClick={() => setSort('urgency')}
            className="text-xs tracking-widest"
          >
            URGENCY
          </Button>
          <Button
            size="sm"
            variant={sort === 'name' ? 'default' : 'secondary'}
            onClick={() => setSort('name')}
            className="text-xs tracking-widest"
          >
            NAME
          </Button>
        </div>

        {/* Card list */}
        <div className="flex flex-col gap-[5px] px-[10px] pb-4">
          <Button
            variant="dashed-ghost"
            aria-label="Add maintenance card"
            onClick={() => setCreateOpen(true)}
            className="w-full py-4 text-xs tracking-widest"
          >
            + ADD MAINTENANCE CARD
          </Button>

          {cardsLoading ? (
            <p className="text-[#555] text-sm">Loading cards…</p>
          ) : cards.length === 0 ? (
            <p className="text-[#555] text-sm">No maintenance cards yet.</p>
          ) : (
            cards.map((card) => (
              <MaintenanceCardRow
                key={card.id}
                card={card}
                vehicle={vehicle}
                isDropdownOpen={activeDropdownId === card.id}
                onDropdownToggle={setActiveDropdownId}
                onEdit={handleEdit}
                onMarkDone={handleMarkDone}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>

      {/* Dialogs — unchanged */}
      <MaintenanceCardFormDialog
        open={createOpen || !!editingCard}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditingCard(null);
          }
        }}
        vehicleId={vehicleId}
        vehicleMileage={vehicle.mileage}
        vehicleMileageUnit={vehicle.mileageUnit}
        card={editingCard ?? undefined}
      />

      {markingDoneCard && (
        <MarkDoneDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setMarkingDoneCard(null);
          }}
          card={markingDoneCard}
          vehicleId={vehicleId}
          currentMileage={vehicle.mileage}
        />
      )}

      {deletingCard && (
        <DeleteConfirmDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setDeletingCard(null);
          }}
          card={deletingCard}
          vehicleId={vehicleId}
        />
      )}

      <VehicleFormDialog
        open={editVehicleOpen}
        onOpenChange={setEditVehicleOpen}
        vehicle={vehicle}
        hasCards={cards.length > 0}
      />

      <VehicleDeleteConfirmDialog
        open={deleteVehicleOpen}
        onOpenChange={setDeleteVehicleOpen}
        vehicle={vehicle}
      />
    </div>
  );
};

export const VehicleDashboardPage: FC<VehicleDashboardPageProps> = ({
  vehicleId,
}) => {
  return (
    <AuthGuard>
      <DashboardContent vehicleId={vehicleId} />
    </AuthGuard>
  );
};

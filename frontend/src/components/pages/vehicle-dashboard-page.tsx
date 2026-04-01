'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth/auth-guard';
import { MileagePrompt } from '@/components/vehicles/mileage-prompt';
import { MaintenanceCardRow } from '@/components/maintenance-cards/maintenance-card-row';
import { MaintenanceCardFormDialog } from '@/components/maintenance-cards/maintenance-card-form-dialog';
import { MarkDoneDialog } from '@/components/maintenance-cards/mark-done-dialog';
import { DeleteConfirmDialog } from '@/components/maintenance-cards/delete-confirm-dialog';
import { Button } from '@/components/ui/button';
import { useVehicle } from '@/hooks/queries/vehicles/useVehicle';
import { useMaintenanceCards } from '@/hooks/queries/maintenance-cards/useMaintenanceCards';
import type { IMaintenanceCardResDTO } from '@project/types';

interface VehicleDashboardPageProps {
  vehicleId: string;
}

function DashboardContent({ vehicleId }: VehicleDashboardPageProps) {
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

  // Close dropdown when user clicks anywhere on the document
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
    <main className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">
          {vehicle.brand} {vehicle.model}
        </h1>
        <p className="text-muted-foreground text-sm">
          {vehicle.colour} &middot; {vehicle.mileage.toLocaleString()}{' '}
          {vehicle.mileageUnit}
        </p>
      </div>

      <MileagePrompt vehicleId={vehicleId} />

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={sort === 'urgency' ? 'default' : 'outline'}
          onClick={() => setSort('urgency')}
        >
          Urgency
        </Button>
        <Button
          size="sm"
          variant={sort === 'name' ? 'default' : 'outline'}
          onClick={() => setSort('name')}
        >
          Name
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-label="Add maintenance card"
          onClick={() => setCreateOpen(true)}
          className="flex w-full items-center justify-center rounded-md border-2 border-dashed border-gray-300 py-4 text-gray-400 hover:bg-gray-50"
        >
          <span className="text-2xl font-light leading-none">+</span>
        </button>

        {cardsLoading ? (
          <p className="text-muted-foreground text-sm">Loading cards…</p>
        ) : cards.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No maintenance cards yet.
          </p>
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

      {/* Dialogs */}
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
    </main>
  );
}

export function VehicleDashboardPage({ vehicleId }: VehicleDashboardPageProps) {
  return (
    <AuthGuard>
      <DashboardContent vehicleId={vehicleId} />
    </AuthGuard>
  );
}

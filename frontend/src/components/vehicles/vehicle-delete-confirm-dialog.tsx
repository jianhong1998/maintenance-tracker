'use client';

import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { IVehicleResDTO } from '@project/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeleteVehicle } from '@/hooks/mutations/vehicles/useDeleteVehicle';

interface VehicleDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: IVehicleResDTO;
}

export function VehicleDeleteConfirmDialog({
  open,
  onOpenChange,
  vehicle,
}: VehicleDeleteConfirmDialogProps) {
  const deleteMutation = useDeleteVehicle();
  const router = useRouter();

  const handleDelete = () => {
    deleteMutation.mutate(vehicle.id, {
      onSuccess: () => {
        toast.success('Vehicle deleted');
        onOpenChange(false);
        router.replace('/');
      },
      onError: (err) => {
        toast.error(err.message || 'Something went wrong');
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Vehicle"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Delete &ldquo;{vehicle.brand} {vehicle.model}&rdquo;? This cannot be
          undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

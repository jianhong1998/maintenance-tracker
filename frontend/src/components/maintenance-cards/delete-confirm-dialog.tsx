'use client';

import { toast } from 'sonner';
import type { IMaintenanceCardResDTO } from '@project/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeleteMaintenanceCard } from '@/hooks/mutations/maintenance-cards/useDeleteMaintenanceCard';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: IMaintenanceCardResDTO;
  vehicleId: string;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  card,
  vehicleId,
}: DeleteConfirmDialogProps) {
  const deleteMutation = useDeleteMaintenanceCard(vehicleId);

  const handleDelete = () => {
    deleteMutation.mutate(card.id, {
      onSuccess: () => {
        toast.success('Card deleted');
        onOpenChange(false);
      },
      onError: (err) => {
        toast.error(err.message ?? 'Something went wrong');
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Card"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Delete &ldquo;{card.name}&rdquo;? This cannot be undone.
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
